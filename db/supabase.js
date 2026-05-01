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

// --- Mutex Lock System ---
const coinLocks = new Map();

async function acquireLock(userId) {
  if (!coinLocks.has(userId)) {
    coinLocks.set(userId, Promise.resolve());
  }
  const prev = coinLocks.get(userId);
  let release;
  const next = new Promise(resolve => {
    release = resolve;
  });
  coinLocks.set(userId, next);
  await prev;
  return release;
}

function releaseLock(releaseFn) {
  if (typeof releaseFn === 'function') releaseFn();
}

// --- Internal Coin Logic (No Locks) ---

async function addCoinsInternal(userId, amount) {
  let { data: profile } = await supabase.from('profiles').select('coins').eq('user_id', userId).single();
  if (profile) {
    if (amount < 0 && (profile.coins || 0) < Math.abs(amount)) return false;
    const newCoins = (profile.coins || 0) + amount;
    if (amount >= 1000) console.log(`[COINS] Adding ${amount} to ${userId}. New balance: ${newCoins}`);
    await supabase.from('profiles').update({ coins: newCoins }).eq('user_id', userId);
    return newCoins;
  }
  return 0;
}

async function transferCoinsInternal(senderId, receiverId, amount) {
  const { data: sender } = await supabase.from('profiles').select('coins').eq('user_id', senderId).single();
  if (!sender || (sender.coins || 0) < amount) {
      return { success: false, error: `Insufficient coins! Balance: ${sender?.coins || 0}` };
  }
  
  const { data: receiver } = await supabase.from('profiles').select('coins').eq('user_id', receiverId).single();
  if (!receiver) return { success: false, error: 'Receiver not found' };
  
  await supabase.from('profiles').update({ coins: sender.coins - amount }).eq('user_id', senderId);
  await supabase.from('profiles').update({ coins: (receiver.coins || 0) + amount }).eq('user_id', receiverId);
  
  return { success: true, senderBalance: sender.coins - amount, receiverBalance: (receiver.coins || 0) + amount };
}

// --- Public API (With Locks) ---

async function recordWin(userId, firstName, chatId) {
  if (!supabase) return;
  const release = await acquireLock(userId);
  try {
    let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    if (profile) {
      const newCoins = (profile.coins || 0) + 200;
      await supabase.from('profiles').update({ 
          wins: profile.wins + 1, 
          matches_played: profile.matches_played + 1, 
          first_name: firstName, 
          coins: newCoins 
      }).eq('user_id', userId);
    } else {
      await supabase.from('profiles').insert({ user_id: userId, first_name: firstName, wins: 1, matches_played: 1, coins: 2200 });
    }
  } finally {
    releaseLock(release);
  }
  // No lock needed for group stats (no coins)
  await updateGroupStat(userId, chatId, firstName, true);
}

async function recordLoss(userId, firstName, chatId) {
  if (!supabase) return;
  const release = await acquireLock(userId);
  try {
    let { data: profile } = await supabase.from('profiles').select('*').eq('user_id', userId).single();
    if (profile) {
      await supabase.from('profiles').update({ matches_played: profile.matches_played + 1, first_name: firstName }).eq('user_id', userId);
    } else {
      await supabase.from('profiles').insert({ user_id: userId, first_name: firstName, wins: 0, matches_played: 1, coins: 2000 });
    }
  } finally {
    releaseLock(release);
  }
  await updateGroupStat(userId, chatId, firstName, false);
}

async function updateGroupStat(userId, chatId, firstName, isWin) {
  let { data: gstat } = await supabase.from('group_stats').select('*').eq('user_id', userId).eq('chat_id', chatId).single();
  if (gstat) {
    await supabase.from('group_stats').update({ 
        wins: gstat.wins + (isWin ? 1 : 0), 
        matches_played: gstat.matches_played + 1, 
        first_name: firstName 
    }).eq('user_id', userId).eq('chat_id', chatId);
  } else {
    await supabase.from('group_stats').insert({ user_id: userId, chat_id: chatId, first_name: firstName, wins: isWin ? 1 : 0, matches_played: 1 });
  }
}

async function addCoins(userId, amount) {
  if (!supabase) return 0;
  const release = await acquireLock(userId);
  try {
      return await addCoinsInternal(userId, amount);
  } finally {
      releaseLock(release);
  }
}

async function transferCoins(senderId, receiverId, amount) {
  if (!supabase || amount <= 0) return { success: false, error: 'Invalid transfer' };
  const [firstId, secondId] = senderId < receiverId ? [senderId, receiverId] : [receiverId, senderId];
  const release1 = await acquireLock(firstId);
  const release2 = await acquireLock(secondId);
  try {
      return await transferCoinsInternal(senderId, receiverId, amount);
  } finally {
      releaseLock(release1);
      releaseLock(release2);
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

async function getUserGlobalRank(userId) {
  if (!supabase) return null;
  const profile = await getProfile(userId);
  if (!profile) return null;
  const { count } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true }).gt('wins', profile.wins);
  return (count !== null ? count : 0) + 1;
}

async function getUserGroupRank(chatId, userId) {
  if (!supabase) return null;
  const { data: gstat } = await supabase.from('group_stats').select('wins').eq('user_id', userId).eq('chat_id', chatId).single();
  if (!gstat) return null;
  const { count } = await supabase.from('group_stats').select('user_id', { count: 'exact', head: true }).eq('chat_id', chatId).gt('wins', gstat.wins);
  return (count !== null ? count : 0) + 1;
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

async function getGroupSettings(chatId) {
  if (settingsCache.has(chatId)) return settingsCache.get(chatId);
  if (!supabase) return { ...DEFAULT_SETTINGS };
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
  const defaults = { ...DEFAULT_SETTINGS };
  try { await supabase.from('group_settings').insert({ chat_id: chatId, ...defaults }); } catch (e) {}
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
    await supabase.from('group_settings').insert({ chat_id: chatId, [key]: value });
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
  if (!supabase || !userId || userCache.has(userId)) return;
  const release = await acquireLock(userId);
  try {
    if (userCache.has(userId)) return;
    const { data: existing } = await supabase.from('profiles').select('user_id').eq('user_id', userId).single();
    if (!existing) {
      await supabase.from('profiles').insert({ user_id: userId, first_name: firstName || 'User', wins: 0, matches_played: 0, coins: 2000 });
    }
    userCache.add(userId);
  } catch (e) {} finally {
    releaseLock(release);
  }
}

// --- Hilo Persistence ---
async function saveHiloGame(state) {
  if (!supabase) return;
  const { error } = await supabase.from('hilo_games').upsert({
    user_id: state.userId,
    bet_amount: state.betAmount,
    multiplier: state.multiplier,
    current_player: state.currentPlayer,
    next_player: state.nextPlayer,
    constraint_name: state.constraint,
    seen_players: state.seenPlayers,
    message_id: state.messageId,
    chat_id: state.chatId
  });
  if (error) console.error("Error saving Hilo game:", error);
}

async function getHiloGame(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase.from('hilo_games').select('*').eq('user_id', userId).single();
  if (error || !data) return null;
  return {
    userId: data.user_id,
    betAmount: data.bet_amount,
    multiplier: data.multiplier,
    currentPlayer: data.current_player,
    nextPlayer: data.next_player,
    constraint: data.constraint_name,
    seenPlayers: data.seen_players,
    messageId: data.message_id,
    chatId: data.chat_id
  };
}

async function deleteHiloGame(userId) {
  if (!supabase) return;
  await supabase.from('hilo_games').delete().eq('user_id', userId);
}

async function cleanupStaleHiloGames() {
  if (!supabase) return;
  // Cleanup games older than 24 hours
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('hilo_games').delete().lt('created_at', yesterday);
}

module.exports = {
  supabase,
  recordWin,
  recordLoss,
  getProfile,
  addCoins,
  addCoinsInternal,
  transferCoins,
  transferCoinsInternal,
  acquireLock,
  releaseLock,
  getGlobalLeaderboard,
  getGroupLeaderboard,
  getUserGlobalRank,
  getUserGroupRank,
  getGlobalStats,
  getGroupSettings,
  updateGroupSetting,
  getAllGroupIds,
  getAllUserIds,
  ensureUser,
  saveHiloGame,
  getHiloGame,
  deleteHiloGame,
  cleanupStaleHiloGames,
  DEFAULT_SETTINGS
};
