const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log("Supabase Client Initialized");
} else {
  console.log("WARNING: Supabase URL or Key missing. Database features will be bypassed.");
}

async function recordWin(userId, firstName, chatId) {
  if (!supabase) return;
  // Update Profile
  let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
  if (profile) {
    await supabase.from('profiles').update({ wins: profile.wins + 1, matches_played: profile.matches_played + 1, first_name: firstName }).eq('user_id', userId);
  } else {
    await supabase.from('profiles').insert({ user_id: userId, first_name: firstName, wins: 1, matches_played: 1 });
  }

  // Update Group Stat
  let { data: gstat } = await supabase.from('group_stats').select('*').eq('user_id', userId).eq('chat_id', chatId).single();
  if (gstat) {
    await supabase.from('group_stats').update({ wins: gstat.wins + 1, matches_played: gstat.matches_played + 1, first_name: firstName }).eq('user_id', userId).eq('chat_id', chatId);
  } else {
    await supabase.from('group_stats').insert({ user_id: userId, chat_id: chatId, first_name: firstName, wins: 1, matches_played: 1 });
  }
}

async function recordLoss(userId, firstName, chatId) {
  if (!supabase) return;
  let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
  if (profile) {
    await supabase.from('profiles').update({ matches_played: profile.matches_played + 1, first_name: firstName }).eq('user_id', userId);
  } else {
    await supabase.from('profiles').insert({ user_id: userId, first_name: firstName, wins: 0, matches_played: 1 });
  }

  let { data: gstat } = await supabase.from('group_stats').select('*').eq('user_id', userId).eq('chat_id', chatId).single();
  if (gstat) {
    await supabase.from('group_stats').update({ matches_played: gstat.matches_played + 1, first_name: firstName }).eq('user_id', userId).eq('chat_id', chatId);
  } else {
    await supabase.from('group_stats').insert({ user_id: userId, chat_id: chatId, first_name: firstName, wins: 0, matches_played: 1 });
  }
}

async function getProfile(userId) {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
  return data;
}

async function getGlobalLeaderboard() {
  if (!supabase) return [];
  const { data } = await supabase.from('profiles').select('*').order('wins', { ascending: false }).limit(10);
  return data;
}

async function getGroupLeaderboard(chatId) {
  if (!supabase) return [];
  const { data } = await supabase.from('group_stats').select('*').eq('chat_id', chatId).order('wins', { ascending: false }).limit(10);
  return data;
}

async function getGlobalStats() {
  if (!supabase) return { totalUsers: 0, totalGroups: 0 };
  const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
  const { data: groupData } = await supabase.from('group_stats').select('chat_id');
  const uniqueGroups = new Set((groupData || []).map(g => g.chat_id)).size;
  return { totalUsers: userCount || 0, totalGroups: uniqueGroups };
}

// --- Group Settings ---

const DEFAULT_SETTINGS = {
  discussion_time: 90,
  voting_time: 60,
  impostor_guess_time: 30,
  clue_words: 1,
  anonymous_voting: false
};

const settingsCache = new Map();

function getDefaults() {
  return { ...DEFAULT_SETTINGS };
}

async function getGroupSettings(chatId) {
  if (settingsCache.has(chatId)) return settingsCache.get(chatId);

  if (!supabase) return getDefaults();

  const { data } = await supabase.from('group_settings').select('*').eq('chat_id', chatId).single();
  if (data) {
    const settings = {
      discussion_time: data.discussion_time ?? DEFAULT_SETTINGS.discussion_time,
      voting_time: data.voting_time ?? DEFAULT_SETTINGS.voting_time,
      impostor_guess_time: data.impostor_guess_time ?? DEFAULT_SETTINGS.impostor_guess_time,
      clue_words: data.clue_words ?? DEFAULT_SETTINGS.clue_words,
      anonymous_voting: data.anonymous_voting ?? DEFAULT_SETTINGS.anonymous_voting
    };
    settingsCache.set(chatId, settings);
    return settings;
  }
  
  const defaults = getDefaults();
  // Auto-register the group in the database
  try {
    await supabase.from('group_settings').insert({ chat_id: chatId, ...defaults });
  } catch (e) {
    // Ignore insertion errors (e.g. duplicate keys or network issues during discovery)
  }
  settingsCache.set(chatId, defaults);
  return defaults;
}

async function updateGroupSetting(chatId, key, value) {
  const settings = await getGroupSettings(chatId);
  settings[key] = value;
  settingsCache.set(chatId, settings);

  if (!supabase) return settings;

  const { data: existing } = await supabase.from('group_settings').select('chat_id').eq('chat_id', chatId).single();
  if (existing) {
    await supabase.from('group_settings').update({ [key]: value }).eq('chat_id', chatId);
  } else {
    await supabase.from('group_settings').insert({ chat_id: chatId, ...settings });
  }
  return settings;
}

async function getAllGroupIds() {
  if (!supabase) return [];
  const { data } = await supabase.from('group_settings').select('chat_id');
  return [...new Set((data || []).map(g => g.chat_id))];
}

async function getAllUserIds() {
  if (!supabase) return [];
  const { data } = await supabase.from('profiles').select('user_id');
  return (data || []).map(u => u.user_id);
}

const userCache = new Set();

async function ensureUser(userId, firstName) {
  if (!supabase || !userId) return;
  if (userCache.has(userId)) return;

  try {
    const { data: existing } = await supabase.from('profiles').select('user_id').eq('user_id', userId).single();
    if (!existing) {
      await supabase.from('profiles').insert({ user_id: userId, first_name: firstName || 'User', wins: 0, matches_played: 0 });
    }
    userCache.add(userId);
  } catch (e) {
    // Ignore errors
  }
}

module.exports = {
  supabase,
  recordWin,
  recordLoss,
  getProfile,
  getGlobalLeaderboard,
  getGroupLeaderboard,
  getGlobalStats,
  getGroupSettings,
  updateGroupSetting,
  getDefaults,
  getAllGroupIds,
  getAllUserIds,
  ensureUser,
  DEFAULT_SETTINGS
};
