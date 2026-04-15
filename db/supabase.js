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

module.exports = {
  supabase,
  recordWin,
  recordLoss,
  getProfile,
  getGlobalLeaderboard,
  getGroupLeaderboard,
  getGlobalStats
};
