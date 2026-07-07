require('dotenv').config();
const { Bot, InlineKeyboard, InputFile } = require('grammy');
const gameManager = require('./game/gameManager');
const mafiaManager = require('./game/mafiaManager');
const liesManager = require('./game/liesManager');
const hiloManager = require('./game/hiloManager');
const guessManager = require('./game/guessManager');
const crashManager = require('./game/crashManager');
const bjManager = require('./game/blackjackManager');
const { normalizeWord, escapeHTML } = require('./utils');
const sb = require('./db/supabase');
const path = require('path');
const footballPlayers = require('./data/footballPlayers.json');
const matchManager = require('./game/matchManager');
const tournamentManager = require('./game/tournamentManager');
const campaignStore = require('./db/campaignStore');
const squadsData = require('./data/squads.json');

// Support for legacy pricing to prevent players selling corrected cheap cards for new high prices
const legacyPrices = require('./db/legacyPrices.json');
const MIGRATION_CUTOFF = new Date('2026-06-05T09:00:00Z');

function resolvePlayerPrice(player, acquiredAt) {
  if (player.sport === 'cricket' && acquiredAt) {
    const acqDate = new Date(acquiredAt);
    if (acqDate < MIGRATION_CUTOFF) {
      const legacyPrice = legacyPrices[player.id];
      if (legacyPrice !== undefined) {
        return legacyPrice;
      }
    }
  }
  return player.buy_price;
}
const gameConstants = require('./constants/game');
const ai = require('./game/ai');
const { DEFAULT_XI } = require('./game/matchManager');
const fs = require('fs');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');

// Register Lemon Milk font
try {
  GlobalFonts.registerFromPath(path.join(__dirname, 'assets', 'fonts', 'LEMONMILK-BoldItalic.otf'), 'Lemon Milk');
} catch (e) {
  console.error("Error registering Lemon Milk:", e);
}

const activeLobbies = {};
const activeTransactions = new Map();
const cardFileIdCache = new Map();
let cardFilesCache = [];

// IPL 2026 squad pools (keyed by team code e.g. 'CSK', 'MI', ...)
const IPL_SQUADS_POOL = require('./data/ipl_2026_squads_pool.json');
const IPL_TEAM_NAMES = {
  CSK:  'Chennai Super Kings',
  MI:   'Mumbai Indians',
  RCB:  'Royal Challengers Bengaluru',
  KKR:  'Kolkata Knight Riders',
  SRH:  'Sunrisers Hyderabad',
  DC:   'Delhi Capitals',
  GT:   'Gujarat Titans',
  LSG:  'Lucknow Super Giants',
  PBKS: 'Punjab Kings',
  RR:   'Rajasthan Royals'
};

function refreshCardFilesCache() {
  try {
    const dir = path.join(__dirname, 'assets', 'cards');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cardFilesCache = fs.readdirSync(dir);
  } catch (e) {
    console.error("Error reading cards directory:", e);
  }
}
refreshCardFilesCache();

const countryFlags = {
  'India': '🇮🇳', 'Australia': '🇦🇺', 'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'New Zealand': '🇳🇿',
  'South Africa': '🇿🇦', 'Pakistan': '🇵🇰', 'West Indies': '🌴', 'West Indies': '🏝️', 'Sri Lanka': '🇱🇰',
  'Bangladesh': '🇧🇩', 'Afghanistan': '🇦🇫', 'Zimbabwe': '🇿🇼', 'Ireland': '🇮🇪',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Netherlands': '🇳🇱', 'Namibia': '🇳🇦', 'Nepal': '🇳🇵',
  'UAE': '🇦🇪', 'Oman': '🇴🇲', 'USA': '🇺🇸', 'Argentina': '🇦🇷', 'Portugal': '🇵🇹',
  'France': '🇫🇷', 'Norway': '🇳🇴', 'Belgium': '🇧🇪', 'Brazil': '🇧🇷', 'Egypt': '🇪🇬',
  'Croatia': '🇭🇷', 'Germany': '🇩🇪', 'Spain': '🇪🇸', 'Italy': '🇮🇹', 'Poland': '🇵🇱',
  'Senegal': '🇸🇳', 'South Korea': '🇰🇷', 'Korea Republic': '🇰🇷', 'Uruguay': '🇺🇾',
  'Canada': '🇨🇦', 'Morocco': '🇲🇦', 'Japan': '🇯🇵', 'Colombia': '🇨🇴'
};

function findPreexistingCard(playerName) {
  const target = playerName.toLowerCase().replace(/[\s_]+/g, '');
  const matchedFile = cardFilesCache.find(f => f.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_]+/g, '') === target);
  if (matchedFile) {
    return path.join(__dirname, 'assets', 'cards', matchedFile);
  }
  return null;
}

async function getOrGeneratePlayerCardPath(player) {
  const existingPath = findPreexistingCard(player.name);
  if (existingPath) {
    return existingPath;
  }

  const templatePath = path.join(__dirname, 'assets', 'CricTemplate.jpeg');
  const template = await loadImage(templatePath);
  const width = template.width;
  const height = template.height;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(template, 0, 0, width, height);

  const name = player.name.toUpperCase();
  const batting = String(player.batting_rating || 0);
  const bowling = String(player.bowling_rating || 0);
  const ovr = String(player.ovr || 0);

  const battingBowlingSize = 110;
  const overallSize = battingBowlingSize * 0.9;
  const nameSize = battingBowlingSize * 0.6;

  const nameX = 542.5;
  const nameY = 1020;

  const battingX = 200;
  const battingY = 1225;

  const bowlingX = 860;
  const bowlingY = 1225;

  const ovrX = 542.5;
  const ovrY = 1253;

  function drawGradientText(text, x, y, fontSize) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${fontSize}px "Lemon Milk"`;

    const yStart = y - fontSize / 2;
    const yEnd = y + fontSize / 2;
    const grad = ctx.createLinearGradient(0, yStart, 0, yEnd);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#ff1a1a');

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(6, fontSize * 0.08);
    ctx.lineJoin = 'miter';
    ctx.miterLimit = 2;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = grad;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  drawGradientText(name, nameX, nameY, nameSize);
  drawGradientText(batting, battingX, battingY, battingBowlingSize);
  drawGradientText(bowling, bowlingX, bowlingY, battingBowlingSize);
  drawGradientText(ovr, ovrX, ovrY, overallSize);

  const buffer = canvas.toBuffer('image/jpeg', 95);

  const cleanName = player.name.replace(/\s+/g, '_');
  const targetPath = path.join(__dirname, 'assets', 'cards', `${cleanName}.jpg`);
  
  try {
    fs.writeFileSync(targetPath, buffer);
    refreshCardFilesCache();
  } catch (err) {
    console.error("Error writing generated card image:", err);
  }

  return targetPath;
}

async function sendPlayerCard(ctx, player, extraOptions = {}) {
  const cachedFileId = cardFileIdCache.get(player.id);
  if (cachedFileId) {
    try {
      return await ctx.replyWithPhoto(cachedFileId, extraOptions);
    } catch (e) {
      console.warn("Cached file_id expired or invalid, refalling back:", e);
      cardFileIdCache.delete(player.id);
    }
  }

  try {
    const cardPath = await getOrGeneratePlayerCardPath(player);
    const file = new InputFile(cardPath);
    const msg = await ctx.replyWithPhoto(file, extraOptions);
    if (msg?.photo?.length > 0) {
      cardFileIdCache.set(player.id, msg.photo[msg.photo.length - 1].file_id);
    }
    return msg;
  } catch (err) {
    console.error("Failed to send player card:", err);
    const textFallback = `👤 <b>${escapeHTML(player.name)}</b> (OVR: ${player.ovr})\n🏏 Batting: ${player.batting_rating} | Bowling: ${player.bowling_rating}`;
    return await ctx.reply(textFallback, { parse_mode: 'HTML', ...extraOptions });
  }
}

async function resolvePlayerForUser(ctx, targetUserId, query) {
  if (!sb.supabase) {
    await ctx.reply("❌ Database stats are currently disabled.", { parse_mode: 'HTML' });
    return null;
  }

  if (!query) return null;

  try {
    const squad = await sb.getUserCricketTeam(targetUserId);
    const squadMatches = squad.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    
    if (squadMatches.length === 1) {
      return squadMatches[0];
    }
    
    if (squadMatches.length > 1) {
      const exactMatch = squadMatches.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exactMatch) return exactMatch;
      
      const list = squadMatches.slice(0, 10).map(p => `• <b>${escapeHTML(p.name)}</b> (OVR: ${p.ovr})`).join('\n');
      const truncated = squadMatches.length > 10 ? `\n...and ${squadMatches.length - 10} more.` : '';
      await ctx.reply(
        `🔍 <b>Multiple players found in the user's squad matching "${escapeHTML(query)}":</b>\n\n${list}${truncated}\n\n` +
        `<i>Please specify a more precise name.</i>`,
        { parse_mode: 'HTML' }
      );
      return null;
    }
    
    const cricketFromDb = await sb.getCricketPlayers();
    if (!cricketFromDb || cricketFromDb.length === 0) {
      await ctx.reply("❌ No players found in the database.", { parse_mode: 'HTML' });
      return null;
    }

    const globalMatches = cricketFromDb.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    if (globalMatches.length === 0) {
      await ctx.reply(`❌ No player matches your search for "<b>${escapeHTML(query)}</b>".`, { parse_mode: 'HTML' });
      return null;
    }

    if (globalMatches.length > 1) {
      const exactMatch = globalMatches.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        return exactMatch;
      } else {
        const list = globalMatches.slice(0, 10).map(p => `• <b>${escapeHTML(p.name)}</b> (OVR: ${p.ovr})`).join('\n');
        const truncated = globalMatches.length > 10 ? `\n...and ${globalMatches.length - 10} more.` : '';
        await ctx.reply(
          `🔍 <b>Multiple players found matching "${escapeHTML(query)}":</b>\n\n${list}${truncated}\n\n` +
          `<i>Please specify a more precise name.</i>`,
          { parse_mode: 'HTML' }
        );
        return null;
      }
    }

    return globalMatches[0];
  } catch (error) {
    console.error("Error in resolvePlayerForUser:", error);
    await ctx.reply("❌ An error occurred while searching for the player.", { parse_mode: 'HTML' });
    return null;
  }
}

async function resolveCaptain(userId) {
  try {
    const squad = await sb.getUserCricketTeam(userId);
    if (!squad || squad.length === 0) return null;

    const assignedCaptainId = await sb.getCaptain(userId, 'cricket');
    if (assignedCaptainId) {
      const captainPlayer = squad.find(p => p.id === assignedCaptainId);
      if (captainPlayer) {
        return captainPlayer;
      }
    }

    // Fallback: highest rated player in the team
    const sorted = [...squad].sort((a, b) => {
      if (b.ovr !== a.ovr) return b.ovr - a.ovr;
      const bBat = b.batting_rating || 0;
      const aBat = a.batting_rating || 0;
      if (bBat !== aBat) return bBat - aBat;
      return a.name.localeCompare(b.name);
    });

    return sorted[0];
  } catch (e) {
    console.error("Error in resolveCaptain:", e);
    return null;
  }
}

function getUserActiveLobby(userId) {
  for (const lobby of Object.values(activeLobbies)) {
    if (lobby.host && lobby.host.telegramId === userId) return lobby;
    if (lobby.guest && lobby.guest.telegramId === userId) return lobby;
  }
  return null;
}


function getWebAppUrl(chatId, tab = '') {
  let host = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_HOSTNAME || 'undercover-fuxy.onrender.com';
  if (host === 'undefined' || !host) {
    host = 'undercover-fuxy.onrender.com';
  }
  const cleanHost = host.replace(/^https?:\/\//, '');
  return `https://${cleanHost}/bonus-app?msg_id=0&chat_id=${chatId}${tab ? `&tab=${tab}` : ''}`;
}

function getMatchPlayUrl(match) {
  let host = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_HOSTNAME || 'undercover-fuxy.onrender.com';
  if (host === 'undefined' || !host) {
    host = 'undercover-fuxy.onrender.com';
  }
  const cleanHost = host.replace(/^https?:\/\//, '');
  return `https://${cleanHost}/cricket?match_id=${match.id}&chat_id=${match.chatId}`;
}

const DRAFT_ROLES = [
  'wicket_keeper', // Round 1
  'batsman',       // Round 2
  'batsman',       // Round 3
  'batsman',       // Round 4
  'bowler',        // Round 5
  'bowler',        // Round 6
  'bowler',        // Round 7
  'all_rounder',   // Round 8
  'batsman',       // Round 9
  'bowler',        // Round 10
  'all_rounder'    // Round 11
];

const DRAFT_ROLE_ICONS = {
  wicket_keeper: '🧤 WICKET KEEPER',
  batsman: '🏏 BATSMAN',
  bowler: '🥎 BOWLER',
  all_rounder: '⚡ ALL-ROUNDER'
};

function generateDraftOptionsForRole(allPlayers, role, excludedIds) {
  let pool = allPlayers.filter(p => p.role === role && p.ovr >= 92 && !excludedIds.includes(p.id));
  
  if (pool.length < 2) {
    pool = allPlayers.filter(p => p.role === role && p.ovr >= 90 && !excludedIds.includes(p.id));
  }
  if (pool.length < 2) {
    pool = allPlayers.filter(p => p.role === role && p.ovr >= 85 && !excludedIds.includes(p.id));
  }
  if (pool.length < 2) {
    pool = allPlayers.filter(p => p.role === role && !excludedIds.includes(p.id));
  }

  if (pool.length < 2) return null;

  const idx1 = Math.floor(Math.random() * pool.length);
  const P1 = pool[idx1];

  const remaining = pool.filter((_, idx) => idx !== idx1);
  remaining.sort((a, b) => {
    const diffA = Math.abs(a.ovr - P1.ovr);
    const diffB = Math.abs(b.ovr - P1.ovr);
    return diffA - diffB;
  });

  const bestDiff = Math.abs(remaining[0].ovr - P1.ovr);
  const candidates = remaining.filter(p => Math.abs(p.ovr - P1.ovr) <= Math.max(1, bestDiff));
  const P2 = candidates[Math.floor(Math.random() * candidates.length)];

  return [P1, P2];
}

function renderDraftMessage(match) {
  const currentRole = DRAFT_ROLES[match.draftRound - 1];
  const roleName = DRAFT_ROLE_ICONS[currentRole] || currentRole.toUpperCase();
  const P1 = match.draftOptions[0];
  const P2 = match.draftOptions[1];

  const chooserName = match.draftTurn.toString() === match.host.telegramId.toString()
    ? match.host.username
    : match.guest.username;

  const hostAvgOvr = match.host.xi.length > 0 
    ? (match.host.xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / match.host.xi.length).toFixed(1)
    : '0.0';
  const guestAvgOvr = match.guest.xi.length > 0
    ? (match.guest.xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / match.guest.xi.length).toFixed(1)
    : '0.0';

  const hostList = match.host.xi.map(p => `${p.name.split(' ').pop()} (${p.ovr})`).join(', ') || 'None';
  const guestList = match.guest.xi.map(p => `${p.name.split(' ').pop()} (${p.ovr})`).join(', ') || 'None';

  return `⚡ <b>DRAFT MODE: ROUND ${match.draftRound}/11</b> ⚡\n` +
         `═════════════════════════════\n` +
         `👤 <b>Chooser:</b> <a href="tg://user?id=${match.draftTurn}">@${escapeHTML(chooserName)}</a>\n` +
         `🏷️ <b>Role:</b> ${roleName}\n\n` +
         `<b>Options:</b>\n` +
         `1️⃣ <b>${escapeHTML(P1.name)}</b> (OVR: <code>${P1.ovr}</code>) - ${escapeHTML(P1.country || 'N/A')}\n` +
         `2️⃣ <b>${escapeHTML(P2.name)}</b> (OVR: <code>${P2.ovr}</code>) - ${escapeHTML(P2.country || 'N/A')}\n` +
         `═════════════════════════════\n` +
         `🟢 <b>@${escapeHTML(match.host.username)}</b> (${match.host.xi.length}/11, Avg: ${hostAvgOvr}):\n` +
         `<i>${escapeHTML(hostList)}</i>\n\n` +
         `🔵 <b>@${escapeHTML(match.guest.username)}</b> (${match.guest.xi.length}/11, Avg: ${guestAvgOvr}):\n` +
         `<i>${escapeHTML(guestList)}</i>\n` +
         `═════════════════════════════\n` +
         `<i>Chooser gets the selected player, opponent gets the other!</i>`;
}

function addShopButton(kb, ctx, label = "🛒 Visit Player Shop", tab = "shop") {
  const isPrivate = ctx.chat?.type === 'private';
  const botUsername = ctx.me?.username || botInfo?.username || 'Imposter0_bot';
  
  if (isPrivate) {
    const miniAppUrl = getWebAppUrl(ctx.chat.id, tab);
    kb.webApp(label, miniAppUrl);
  } else {
    const directLink = `https://t.me/${botUsername}/bonus?startapp=${tab}`;
    kb.url(label, directLink);
  }
  return kb;
}

function addMatchPlayButton(kb, match, ctx = null) {
  const isPrivate = ctx ? (ctx.chat?.type === 'private') : (match.chatId > 0);
  const botUsername = ctx?.me?.username || botInfo?.username || 'Imposter0_bot';
  const playUrl = getMatchPlayUrl(match);

  if (isPrivate) {
    kb.webApp("🎮 Play Match", playUrl);
  } else {
    const directLink = `https://t.me/${botUsername}/bonus?startapp=cricket_${match.id}_${match.chatId}`;
    kb.url("🎮 Play Match", directLink);
  }
  return kb;
}



const SUPER_ADMIN_IDS = [7361215114]; // Super Admins
const HARDCODED_ADMIN_IDS = [7361215114, 8483239518, 1315564307]; // Bot Owners
let ADMIN_IDS = [...HARDCODED_ADMIN_IDS];

async function loadAdmins() {
  if (!sb.supabase) return;
  try {
    const { data: addedAdmins } = await sb.supabase
      .from('user_owned_players')
      .select('user_id')
      .eq('sport', 'admin')
      .eq('player_id', 'admin');
    
    const { data: removedAdmins } = await sb.supabase
      .from('user_owned_players')
      .select('user_id')
      .eq('sport', 'removed_admin')
      .eq('player_id', 'removed_admin');

    const addedIds = (addedAdmins || []).map(a => Number(a.user_id));
    const removedIds = (removedAdmins || []).map(r => Number(r.user_id));

    const currentAdmins = new Set(HARDCODED_ADMIN_IDS);
    for (const id of addedIds) {
      currentAdmins.add(id);
    }
    for (const id of removedIds) {
      currentAdmins.delete(id);
    }

    ADMIN_IDS = Array.from(currentAdmins);
    console.log("Loaded admins from database:", ADMIN_IDS);
  } catch (e) {
    console.error("Error loading admins from database:", e);
  }
}

async function notifySuperAdmins(ctx, actionName, details) {
  for (const id of SUPER_ADMIN_IDS) {
    if (id === ctx.from.id) continue;
    const adminName = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    const msg = `🛡️ <b>Admin Action: ${actionName}</b>\n👤 <b>Admin:</b> <a href="tg://user?id=${ctx.from.id}">${escapeHTML(adminName)}</a>\n📝 <b>Details:</b> ${details}`;
    await ctx.api.sendMessage(id, msg, { parse_mode: 'HTML' }).catch(() => {});
  }
}
const dropCooldowns = new Map();
const claimCooldowns = new Map();
const spinCooldowns = new Map();
const adSpinCooldowns = new Map();
const pendingSpinReminders = new Map();
const rainCooldowns = new Map();

function getRandomSpinReward() {
  const rand = Math.random() * 100;
  if (rand < 40) return 100; // 40%
  if (rand < 68) return 500; // 28%
  if (rand < 88) return 1000; // 20%
  if (rand < 98.7) return 2000; // 10.7%
  return 10000; // 1.3% Jackpot
}

function getRandomReward() {
  const rand = Math.random() * 100;
  if (rand < 70) return Math.floor(Math.random() * (600 - 300 + 1)) + 300; // 300 - 600 (70%)
  if (rand < 90) return Math.floor(Math.random() * (1500 - 601 + 1)) + 601; // 601 - 1500 (20%)
  if (rand < 98) return Math.floor(Math.random() * (3000 - 1501 + 1)) + 1501; // 1501 - 3000 (8%)
  return Math.floor(Math.random() * (5000 - 3001 + 1)) + 3001; // 3001 - 5000 (2%)
}

/**
 * Pick a random cricket player for the Mystery Drop.
 * OVR range: ~50 to 86 (capped by DB data).
 *
 * Weight formula: w(ovr) = e^(-k * (ovr - 50))   where k = 0.28
 *
 * This gives an exponential decay so that high OVR players (80+)
 * represent about 10% of drops, and players 76 OVR or above represent about 51% of drops.
 *
 * @param {Array} players - Full cricketplayers array from DB
 * @param {Array} ownedIds - Player IDs the user already owns (excluded)
 * @returns {Object|null} player object, or null if pool empty
 */
function getRandomPlayerDrop(players, ownedIds = []) {
  const MAX_OVR = 86;
  const K = 0.28; // decay constant

  // Filter to only unowned cricket players at or below the cap
  const ownedSet = new Set(ownedIds);
  const pool = players.filter(p => p.ovr <= MAX_OVR && !ownedSet.has(p.id));

  if (pool.length === 0) return null;

  // Assign a weight to each player
  const weights = pool.map(p => Math.exp(-K * (p.ovr - 50)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // Weighted random pick
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < pool.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return pool[i];
  }
  // Fallback (floating-point safety)
  return pool[pool.length - 1];
}

/**
 * Human-readable rarity label based on OVR tier.
 */
function getPlayerDropRarity(ovr) {
  if (ovr >= 83) return { label: 'ELITE', color: '#ff007f', emoji: '💎' };
  if (ovr >= 78) return { label: 'GOLD',  color: '#FFD700', emoji: '⭐' };
  if (ovr >= 70) return { label: 'SILVER', color: '#94A3B8', emoji: '🥈' };
  return             { label: 'BRONZE', color: '#cd7f32', emoji: '🥉' };
}

process.on('unhandledRejection', (reason, promise) => {
  console.error("Ignored Unhandled Rejection:", reason.description || reason.message || reason);
});
process.on('uncaughtException', (error) => {
  console.error("Ignored Uncaught Exception:", error.description || error.message || error);
});

// --- 24-Hour Analytics Tracking ---
const activity24h = new Map();
const adCooldowns = new Map();

// --- Group Activity Tracking for /rain ---
const groupActivity = new Map();

function trackGroupActivity(chatId, userId, firstName) {
    if (!groupActivity.has(chatId)) {
        groupActivity.set(chatId, new Map());
    }
    const chatMap = groupActivity.get(chatId);
    if (!chatMap.has(userId)) {
        chatMap.set(userId, { name: firstName, count: 0 });
    }
    const data = chatMap.get(userId);
    data.name = firstName;
    data.count++;
}


function trackActivity(userId, name) {
    const now = Date.now();
    if (!activity24h.has(userId)) {
        activity24h.set(userId, { name, cmds: 0, ts: now });
    }
    const data = activity24h.get(userId);
    data.name = name;
    data.cmds++;
    data.ts = now;
}

setInterval(() => {
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const [uid, data] of activity24h.entries()) {
        if (now - data.ts > ONE_DAY) activity24h.delete(uid);
    }
}, 60 * 60 * 1000);

// Cleanup task for stale Hilo games (every 1 hour)
setInterval(() => {
    console.log("[CLEANUP] Running stale Hilo game cleanup...");
    sb.cleanupStaleHiloGames();
}, 60 * 60 * 1000);

const bot = new Bot(process.env.BOT_TOKEN);
const { autoRetry } = require('@grammyjs/auto-retry');
bot.api.config.use(autoRetry({
  maxRetryAttempts: 10,
  maxDelaySeconds: 300,
}));
let botInfo = null;
const pendingReminders = new Map();

function getActiveLobbyForUser(userId) {
    const regular = gameManager.getLobbyByUserId(userId);
    if (regular) return regular;
    const mafia = mafiaManager.getLobbyByUserId(userId);
    if (mafia) return mafia;
    const lies = liesManager.getLobbyByUserId(userId);
    if (lies) return lies;
    
    // Check guess game host
    for (const game of guessManager.getAllGames().values()) {
        if (game.host.id === userId) return game;
    }
    return null;
}

bot.use((ctx, next) => {
  if (ctx.from && !ctx.from.is_bot) {
    trackActivity(ctx.from.id, ctx.from.first_name);
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      trackGroupActivity(ctx.chat.id, ctx.from.id, ctx.from.first_name);
    }
  }
  return next();
});



function processGameEnd(lobby, winners) {
  if (!sb.supabase) return;
  const isImpostorWin = winners === 'IMPOSTOR';
  
  lobby.players.forEach(p => {
     const isImpostor = p.id === lobby.impostorId;
     if (isImpostor && isImpostorWin) sb.recordWin(p.id, p.first_name, lobby.chatId);
     else if (isImpostor && !isImpostorWin) sb.recordLoss(p.id, p.first_name, lobby.chatId);
     else if (!isImpostor && !isImpostorWin) sb.recordWin(p.id, p.first_name, lobby.chatId);
     else if (!isImpostor && isImpostorWin) sb.recordLoss(p.id, p.first_name, lobby.chatId);
  });
}

// --- Discovery Helpers ---
async function ensureRegistered(ctx) {
  try {
    if (ctx.from && !ctx.from.is_bot) {
      sb.ensureUser(ctx.from.id, ctx.from.first_name).catch(() => {});
    }
    if (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup')) {
      sb.getGroupSettings(ctx.chat.id).catch(() => {});
    }
  } catch (e) {}
}

async function handleGroupInvite(ctx) {
    if (!sb.supabase) return;
    
    const update = ctx.myChatMember;
    // Check if the bot was added (status changed to 'member' or 'administrator')
    const isAdded = (update.new_chat_member.status === 'member' || update.new_chat_member.status === 'administrator') &&
                    (update.old_chat_member.status === 'left' || update.old_chat_member.status === 'kicked');
    
    if (!isAdded) return;

    const userId = update.from.id;
    if (update.from.is_bot) return;

    const chatId = ctx.chat.id;
    const chatTitle = ctx.chat.title;

    try {
        const count = await ctx.api.getChatMemberCount(chatId);
        
        if (count < 50) return; // No reward for small groups

        let amount = 0;
        if (count >= 50 && count <= 100) amount = 2000;
        else if (count <= 500) amount = 5000;
        else if (count <= 2000) amount = 10000;
        else amount = 20000;

        const result = await sb.claimGroupInviteReward(userId, chatId, amount);
        
        if (result.success) {
            await ctx.api.sendMessage(chatId, 
                `🎉 <b>Bot Added to Group!</b>\n\n` +
                `Thank you <a href="tg://user?id=${userId}">${escapeHTML(update.from.first_name)}</a> for inviting me to <b>${escapeHTML(chatTitle)}</b>!\n\n` +
                `💰 You have been rewarded with <b>${amount}</b> coins for this active group (${count} members).\n` +
                `New Balance: <b>${result.newBalance}</b>`,
                { parse_mode: 'HTML' }
            );
            
            // Also notify user in private to be safe
            await ctx.api.sendMessage(userId, `✅ You earned <b>${amount}</b> coins for adding me to <b>${chatTitle}</b>!`, { parse_mode: 'HTML' }).catch(()=>{});
        }
    } catch (e) {
        console.error("Error in handleGroupInvite:", e);
    }
}

bot.on('my_chat_member', async (ctx) => {
    await handleGroupInvite(ctx);
});

bot.command('help', async (ctx) => {
  const text = `📖 <b>The Undercover Bot — Help Menu</b>\n\n` +
               `🎮 <b>Main Games:</b>\n` +
               `• /play — Start an Undercover lobby (3+ players)\n` +
               `• /mafia — Start a Mafia lobby (3+ players)\n` +
               `• /lies — Challenge a friend to Game of Lies (1v1)\n` +
               `• /guessword — Start a Guess the Word game\n\n` +
               `💰 <b>Gambling & Economy:</b>\n` +
               `• /blackjack — Play Blackjack against the Dealer\n` +
               `• /hilo — Play High-Low Cricket Stats\n` +
               `• /fly — Bet on the crashing plane (Aviator)\n` +
               `• /daily — Claim your daily coin bonus\n` +
               `• /drop — Claim a Mystery Coin Drop (Video Ad)\n` +
               `• /spin — Spin the Lucky Wheel for up to 10k Coins\n` +
               `• /shop — Browse & buy cricket/football players\n\n` +
               `👤 <b>User Info:</b>\n` +
               `• /profile — Check your wins, losses, and coins\n` +
               `• /myteam — Show your full squad (Cricket & Football)\n` +
               `• /xi — Show your Playing XI with roles\n` +
               `• /swap — Swap squad positions (/swap 4 12)\n` +
               `• /claim — Claim your free starter pack\n` +
               `• /sell — Sell a player back for 75% value\n` +
               `• /ps — Show player team stats (/ps Virat Kohli)\n` +
               `• /cs — Show player global stats (/cs Virat Kohli)\n` +
               `• /leaderboard — View top players globally\n` +
               `• /balance — Check your coin balance\n` +
               `• /send — Send coins to a friend (reply to them)\n\n` +
               `⚙️ <b>Others:</b>\n` +
               `• /settings — Configure game timers and rules\n` +
               `• /cancel — Stop the current game in a group\n` +
               `• /quit — Quit the current game\n` +
               `• /feedback — Send a message to the developers\n\n` +
               `📢 <b>Join our community:</b> ${OFFICIAL_GC_USER}`;
  
  await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('rules', async (ctx) => {
    const text = `⚖️ <b>Game Rules & How to Play</b>\n\n` +
                 `🕵️‍♂️ <b>Undercover:</b>\n` +
                 `Everyone gets a secret word. One person (The Impostor) has a slightly different word. Give 1-word clues to find out who is the Impostor without revealing your own word!\n\n` +
                 `🔫 <b>Mafia:</b>\n` +
                 `Similar to Undercover, but with multiple roles like the Joker. The Joker wins if they get voted out, so be careful who you target!\n\n` +
                 `🤥 <b>Game of Lies:</b>\n` +
                 `A 1v1 trivia battle. You can answer correctly for points, or send a wrong answer to bait your opponent into "stealing" and losing points.\n\n` +
                 `🃏 <b>Blackjack:</b>\n` +
                 `Get as close to 21 as possible without going over. Aces are 1 or 11. Dealer must hit until 17.\n\n` +
                 `⚖️ <b>Economy Rules:</b>\n` +
                 `• Coins have no real-world value.\n` +
                 `• Multi-accounting to farm coins is prohibited.\n` +
                 `• Be respectful in group chats!`;
    
    await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('start', async (ctx) => {
  ensureRegistered(ctx);
  
  // Handle Deep Links
  if (ctx.match === 'drop') {
    return handleDropCommand(ctx);
  }
  if (ctx.match === 'spin') {
    const miniAppUrl = getWebAppUrl(ctx.chat.id, 'spin');
    const kb = new InlineKeyboard().webApp("🎡 Spin the Lucky Wheel", miniAppUrl);
    return ctx.reply(
        "🎡 <b>Lucky Spin Wheel</b>\n\nTry your luck! Spin the wheel to win up to <b>10,000 Coins</b>!\n\n<i>You get 1 free spin every 24 hours. Additional spins require watching a short ad.</i>",
        { parse_mode: 'HTML', reply_markup: kb }
    );
  }
  if (ctx.match === 'tournament') {
    const cleanHost = process.env.WEBAPP_URL ? process.env.WEBAPP_URL.replace(/^https?:\/\//, '') : 'undercover-fuxy.onrender.com';
    const webAppUrl = `https://${cleanHost}/cricket/tournament?userId=${ctx.from.id}`;
    const kb = new InlineKeyboard().webApp("🎮 Launch Campaign", webAppUrl);
    return ctx.reply(
      "🏆 <b>Cricket Tournament Campaign</b> 🏆\n\nLead your team through a full tournament like IPL or the World Cup, matching real-life rosters with your own card upgrades!\n\nClick the button below to launch the campaign interface:",
      { parse_mode: 'HTML', reply_markup: kb }
    );
  }

  if (ctx.chat.type === 'private') {
    await ctx.reply("🕵️‍♂️ <b>Welcome to The Undercover Bot!</b>\n\nAdd me to a group chat and send /play to start an intense game of deception.", { parse_mode: 'HTML' });
  } else {
    await ctx.reply("🕵️‍♂️ <b>The Undercover Bot</b> is ready! Send /play to start a new lobby.", { parse_mode: 'HTML' });
  }
});

bot.command('tournament', async (ctx) => {
  const telegramId = ctx.from.id;
  if (sb.supabase) {
    await sb.ensureUser(telegramId, ctx.from.first_name).catch(() => {});
  }

  const isGroup = ctx.chat.id < 0;
  const botInfo = await bot.api.getMe().catch(() => null);
  const botUsername = botInfo?.username || 'Imposter0_bot';
  const cleanHost = process.env.WEBAPP_URL ? process.env.WEBAPP_URL.replace(/^https?:\/\//, '') : 'undercover-fuxy.onrender.com';
  const webAppUrl = `https://${cleanHost}/cricket/tournament?userId=${telegramId}`;

  if (isGroup) {
    const redirectUrl = `https://t.me/${botUsername}?start=tournament`;
    const kb = new InlineKeyboard().url("🎮 Play Tournament Campaign", redirectUrl);
    return ctx.reply(
      "🏆 <b>Cricket Tournament Campaign</b> 🏆\n\n" +
      "Lead your team through a full tournament like IPL or the World Cup, matching real-life rosters with your own card upgrades!\n\n" +
      "👇 Click below to play in private chat:",
      {
        parse_mode: 'HTML',
        reply_markup: kb
      }
    );
  } else {
    const kb = new InlineKeyboard().webApp("🎮 Launch Campaign", webAppUrl);
    return ctx.reply(
      "🏆 <b>Cricket Tournament Campaign</b> 🏆\n\n" +
      "Lead your team through a full tournament like IPL or the World Cup, matching real-life rosters with your own card upgrades!\n\n" +
      "Click the button below to launch the campaign interface:",
      {
        parse_mode: 'HTML',
        reply_markup: kb
      }
    );
  }
});

bot.command('ping', async (ctx) => {
  const activeGames = gameManager.getActiveGamesCount() + mafiaManager.getActiveGamesCount() + liesManager.getActiveGamesCount() + hiloManager.getActiveGamesCount();
  let totalUsers = "Unknown";
  let totalGroups = "Unknown";
  
  if (sb.supabase) {
      const stats = await sb.getGlobalStats();
      totalUsers = stats.totalUsers;
      totalGroups = stats.totalGroups;
  }

  const uptimeSeconds = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSeconds / 3600);
  const minutes = Math.floor((uptimeSeconds % 3600) / 60);
  const upStr = `${hours}h ${minutes}m`;
  
  await ctx.reply(`🏓 <b>Bot Status</b>\n\n🟢 <b>Active Lobbies:</b> ${activeGames}\n👥 <b>Total Players (All Time):</b> ${totalUsers}\n🏠 <b>Total Groups Played In:</b> ${totalGroups}\n⏱️ <b>Uptime:</b> ${upStr}`, { parse_mode: 'HTML' });
});

bot.command('admin_stats', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return;
  const ucCount = gameManager.getActiveGamesCount();
  const mafCount = mafiaManager.getActiveGamesCount();
  const liesCount = liesManager.getActiveGamesCount();
  const hiloCount = hiloManager.getActiveGamesCount();
  const cricLiveCount = new Set(Object.values(matchManager.activeMatches).map(m => m.id)).size;

  const stats = await sb.getGlobalStats().catch(() => ({ 
      totalUsers: "Error", 
      totalGroups: "Error", 
      totalBonusClaims: 0, 
      uniqueBonusClaimers: 0,
      completedCricketMatches: 0,
      activeCricketMatches: 0
  }));
  
  const completedCric = stats.completedCricketMatches ?? 0;
  const activeCricDb = stats.activeCricketMatches ?? 0;

  // Build 24h stats
  const active24 = Array.from(activity24h.values());
  const activeUsers24Count = active24.length;
  active24.sort((a, b) => b.cmds - a.cmds);
  let topPlayersStr = "";
  for (let i = 0; i < Math.min(3, active24.length); i++) {
      const safeName = escapeHTML(active24[i].name || 'Unknown');
     topPlayersStr += `  ${i+1}. ${safeName} (${active24[i].cmds} interactions)\n`;
  }
  if (!topPlayersStr) topPlayersStr = "  None yet\n";

  const text = `📊 <b>Admin Activity Dashboard</b>\n\n` +
               `👥 <b>Total Users (DB):</b> ${stats.totalUsers}\n` +
               `🏘️ <b>Total Groups (DB):</b> ${stats.totalGroups}\n\n` +
               `🏏 <b>Crickidex Matches:</b>\n` +
               `  Active (DB): ${activeCricDb}\n` +
               `  Completed (DB): ${completedCric}\n\n` +
               `💰 <b>Drop Rewards:</b>\n` +
               `  Total Claims: ${stats.totalBonusClaims}\n` +
               `  Unique Claimers: ${stats.uniqueBonusClaimers}\n\n` +
               `🔥 <b>24-Hour Activity:</b>\n` +
               `  Active Players: ${activeUsers24Count}\n` +
               `  <b>Most Active:</b>\n${topPlayersStr}\n` +
               `🎮 <b>Live Games:</b>\n` +
               `- Undercover: ${ucCount}\n` +
               `- Mafia: ${mafCount}\n` +
               `- Lies: ${liesCount}\n` +
               `- Hilo: ${hiloCount}\n` +
               `- Cricket: ${cricLiveCount}\n\n` +
               `⏳ <i>Cleanup interval: 30m</i>`;
                 
  await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('cancel', async (ctx) => {
  if (ctx.chat.type === 'private') return;
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  
  // Check if there is an active cricket lobby or match for this user/chat
  const cricLobby = activeLobbies[chatId];
  const cricMatch = matchManager.getActiveMatch(userId);

  if (cricMatch) {
    if (cricMatch.status === 'completed') {
        return ctx.reply("❌ Match has already completed.");
    }
    const ballsBowled = (cricMatch.innings[0]?.balls || 0) + (cricMatch.innings[1]?.balls || 0);
    let penalty = 0;
    if (ballsBowled > 0) {
        const totalBalls = cricMatch.totalOvers * 12;
        const ratio = Math.min(1, ballsBowled / totalBalls);
        penalty = Math.round(ratio * cricMatch.totalOvers * 1000);
    }

    let penaltyText = penalty > 0 ? `${penalty} coins penalty` : "No penalty";
    const keyboard = new InlineKeyboard()
        .text(`⚠️ Confirm Quit (${penalty > 0 ? `-${penalty} Coins` : 'No Penalty'})`, `cric_quit_confirm:${cricMatch.id}:${userId}`)
        .text(`❌ Cancel`, `cric_quit_cancel:${cricMatch.id}:${userId}`);

    await ctx.reply(
        `🚨 <b>Are you sure you want to cancel the match?</b>\n\n` +
        `• Played: <b>${ballsBowled}</b> balls\n` +
        `• Penalty: <b>${penaltyText}</b>\n\n` +
        `<i>Opponent will receive compensation coins and the win.</i>`,
        { parse_mode: 'HTML', reply_markup: keyboard }
    );
    return;
  }

  if (cricLobby) {
    const member = await ctx.getChatMember(userId).catch(() => ({ status: 'member' }));
    const isAdmin = member.status === 'administrator' || member.status === 'creator' || ADMIN_IDS.includes(userId);
    if (cricLobby.host.telegramId === userId || isAdmin) {
        delete activeLobbies[chatId];
        await ctx.reply("🛑 Cricket match lobby has been cancelled.");
        return;
    }
  }
  
  const lobby = gameManager.getLobby(chatId) || 
                mafiaManager.getLobby(chatId) || 
                liesManager.getLobby(chatId) || 
                guessManager.getGame(chatId);
                
  if (!lobby) {
    return ctx.reply("No active game to cancel.");
  }
  
  const member = await ctx.getChatMember(ctx.from.id).catch(() => ({ status: 'member' }));
  const isAdmin = member.status === 'administrator' || member.status === 'creator' || ADMIN_IDS.includes(ctx.from.id);
  
  // Use .host (all managers store host info)
  const hostId = lobby.host?.id || (lobby.players ? lobby.players[0]?.id : null);

  if (hostId && hostId !== ctx.from.id && !isAdmin) {
      return ctx.reply("Only the host or group admins can cancel the game.");
  }
  
  if (lobby.pinnedMessageId) {
     try { await ctx.api.unpinChatMessage(chatId, lobby.pinnedMessageId); } catch(e) {}
  }
  
  if (gameManager.hasLobby(chatId)) gameManager.deleteLobby(chatId);
  if (mafiaManager.hasLobby(chatId)) mafiaManager.deleteLobby(chatId);
  if (liesManager.hasLobby(chatId)) liesManager.deleteLobby(chatId);
  if (guessManager.getGame(chatId)) guessManager.endGame(chatId);

  const hiloGames = hiloManager.getActiveGames();
  for (const [uid, hstate] of hiloGames) {
      if (hstate.chatId === chatId) {
          hiloManager.endGame(uid);
      }
  }
  
  await ctx.reply("🛑 The game has been cancelled and cleaned up.");
});

bot.command('profile', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  await sb.ensureUser(user.id, user.first_name).catch(() => {});
  const profile = await sb.getProfile(user.id);
  
  if (!profile) {
     return ctx.reply(`👤 <b><a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a></b> has not played any games yet!`, { parse_mode: 'HTML' });
  }
  
  const winRate = profile.matches_played > 0 ? Math.round((profile.wins / profile.matches_played) * 100) : 0;
  await ctx.reply(
    `👤 <b>Profile: <a href="tg://user?id=${user.id}">${escapeHTML(profile.first_name)}</a></b>\n\n🏆 <b>Wins:</b> ${profile.wins}\n🎮 <b>Matches Played:</b> ${profile.matches_played}\n📈 <b>Win Rate:</b> ${winRate}%\n💰 <b>Coins:</b> ${profile.coins || 0}`,
    { parse_mode: 'HTML' }
  );
});

bot.command('myteam', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  await sb.ensureUser(user.id, user.first_name).catch(() => {});
  
  const text = `👥 <b><a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a>'s Club Squads</b>\n\n` +
               `<blockquote>Select which sport's squad you would like to view. You can purchase more players in the Shop!</blockquote>`;
  
  const kb = new InlineKeyboard()
    .text("🏏 Cricket Squad", `myteam:cricket:${user.id}`)
    .text("⚽ Football Squad", `myteam:football:${user.id}`)
    .row();
  
  addShopButton(kb, ctx, "🛒 Visit Player Shop", "shop");
  
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });
});

bot.command('xi', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  await sb.ensureUser(user.id, user.first_name).catch(() => {});

  try {
    const squad = await sb.getUserCricketTeam(user.id);
    if (!squad || squad.length === 0) {
      return ctx.reply("🏏 You don't have any cricket players yet! Use /claim to get your starter pack.", { parse_mode: 'HTML' });
    }
    if (squad.length < 11) {
      return ctx.reply(`🏏 You only have <b>${squad.length}</b> player(s). You need at least 11 to form a Playing XI.\n\nUse /claim or /shop to get more players.`, { parse_mode: 'HTML' });
    }

    const xi = squad.slice(0, 11);
    const roleIcon = (role) => {
      if (role === 'batsman') return '🏏';
      if (role === 'wicket_keeper') return '🧤';
      if (role === 'all_rounder') return '⚡';
      if (role === 'bowler') return '🥎';
      return '👤';
    };
    const roleLabel = (role) => {
      if (role === 'batsman') return 'BAT';
      if (role === 'wicket_keeper') return 'WK';
      if (role === 'all_rounder') return 'ALR';
      if (role === 'bowler') return 'BOWL';
      return '';
    };

    const profile = await sb.getProfile(user.id);
    let msg = `🏏 <b><u>PLAYING XI</u></b> — <b><a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a></b>\n`;
    if (profile && profile.team_name) {
      msg += `<blockquote>🏷️ <b>"${escapeHTML(profile.team_name)}"</b></blockquote>\n`;
    }
    msg += `═════════════════════════════\n`;

    const roleGroups = {
      batsman: { title: '<b>━━━ 🏏 BATSMEN ━━━</b>', players: [] },
      wicket_keeper: { title: '<b>━━━ 🧤 WICKET KEEPERS ━━━</b>', players: [] },
      all_rounder: { title: '<b>━━━ ⚡ ALL-ROUNDERS ━━━</b>', players: [] },
      bowler: { title: '<b>━━━ 🥎 BOWLERS ━━━</b>', players: [] }
    };

    xi.forEach((p, idx) => {
      const role = p.role || 'bowler';
      if (roleGroups[role]) {
        roleGroups[role].players.push({ ...p, displayIdx: idx + 1 });
      } else {
        roleGroups.bowler.players.push({ ...p, displayIdx: idx + 1 });
      }
    });

    const rolesOrder = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler'];
    rolesOrder.forEach(roleKey => {
      const group = roleGroups[roleKey];
      if (group.players.length > 0) {
        msg += `\n${group.title}\n`;
        group.players.forEach(p => {
          const tierIndicator = p.tier === 'Legendary' ? ' 💎' : p.tier === 'Gold' ? ' ⭐' : '';
          msg += `• <b>${p.displayIdx}.</b> ${roleIcon(p.role)} <b>${escapeHTML(p.name)}</b> (<code>${p.ovr} OVR</code>)${tierIndicator}\n`;
        });
      }
    });

    const teamRating = Math.round(xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / 11);
    msg += `═════════════════════════════\n`;
    msg += `📊 <b>XI Rating:</b> <code>${teamRating} OVR</code>`;
    msg += `\n\n💡 <i>Use <code>/swap [pos1] [pos2]</code> to rearrange your playing 11.</i>`;

    await ctx.reply(msg, { parse_mode: 'HTML' });
  } catch (e) {
    console.error("Error in /xi command:", e);
    await ctx.reply("❌ An error occurred while fetching your Playing XI.");
  }
});

// Helper to draw a rounded rectangle on a canvas context (compatible with older @napi-rs/canvas)
function drawRoundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
    radius = { ...defaultRadius, ...radius };
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

bot.command('image', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  await sb.ensureUser(user.id, user.first_name).catch(() => {});

  // Send a typing/processing action so user knows it's working
  await ctx.replyWithChatAction('upload_photo').catch(() => {});

  try {
    const squad = await sb.getUserCricketTeam(user.id);
    if (!squad || squad.length === 0) {
      return ctx.reply("🏏 You don't have any cricket players yet! Use /claim to get your starter pack.", { parse_mode: 'HTML' });
    }
    if (squad.length < 11) {
      return ctx.reply(`🏏 You only have <b>${squad.length}</b> player(s). You need at least 11 to form a Playing XI.\n\nUse /claim or /shop to get more players.`, { parse_mode: 'HTML' });
    }

    const xi = squad.slice(0, 11);
    const profile = await sb.getProfile(user.id);
    const teamName = profile && profile.team_name ? profile.team_name : `${user.first_name}'s XI`;
    const captain = await resolveCaptain(user.id);

    const { createCanvas, loadImage } = require('@napi-rs/canvas');

    const width = 1200;
    const height = 980; // slightly taller to fit 225px tall cards
    const canvas = createCanvas(width, height);
    const ctxCanvas = canvas.getContext('2d');

    // 1. Draw Stadium Background
    try {
      const bgImg = await loadImage(path.join(__dirname, 'assets', 'stadium_bg.png'));
      ctxCanvas.drawImage(bgImg, 0, 0, width, height);
    } catch (err) {
      console.error("Failed to load stadium background, using fallback gradient:", err);
      const bgGrad = ctxCanvas.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#0a0d1a');
      bgGrad.addColorStop(0.5, '#120f26');
      bgGrad.addColorStop(1, '#05060d');
      ctxCanvas.fillStyle = bgGrad;
      ctxCanvas.fillRect(0, 0, width, height);
    }

    // 2. Apply a dark atmospheric glass overlay
    ctxCanvas.fillStyle = 'rgba(11, 10, 26, 0.72)';
    ctxCanvas.fillRect(0, 0, width, height);

    // Draw premium cyber stadium grid overlay
    ctxCanvas.strokeStyle = 'rgba(0, 242, 254, 0.03)';
    ctxCanvas.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctxCanvas.beginPath();
      ctxCanvas.moveTo(x, 0);
      ctxCanvas.lineTo(x, height);
      ctxCanvas.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctxCanvas.beginPath();
      ctxCanvas.moveTo(0, y);
      ctxCanvas.lineTo(width, y);
      ctxCanvas.stroke();
    }

    // Draw glowing stadium arch effect
    ctxCanvas.fillStyle = 'rgba(79, 70, 229, 0.05)';
    ctxCanvas.beginPath();
    ctxCanvas.arc(width / 2, height + 100, 600, Math.PI, 0);
    ctxCanvas.fill();

    // 3. Draw Premium Header Banner
    ctxCanvas.save();
    ctxCanvas.fillStyle = 'rgba(255, 255, 255, 0.02)';
    drawRoundRect(ctxCanvas, 300, 20, 600, 100, 12);
    ctxCanvas.fill();
    ctxCanvas.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctxCanvas.lineWidth = 1;
    ctxCanvas.stroke();
    ctxCanvas.restore();

    // Draw Glowing "PLAYING XI" Title
    ctxCanvas.save();
    ctxCanvas.fillStyle = '#ffffff';
    ctxCanvas.font = 'bold 36px sans-serif';
    ctxCanvas.textAlign = 'center';
    ctxCanvas.shadowColor = '#00f2fe';
    ctxCanvas.shadowBlur = 15;
    ctxCanvas.fillText('PLAYING XI', width / 2, 65);
    ctxCanvas.restore();

    ctxCanvas.fillStyle = '#a78bfa';
    ctxCanvas.font = 'italic 18px sans-serif';
    ctxCanvas.fillText(`"${teamName}"`, width / 2, 98);

    const teamRating = Math.round(xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / 11);
    
    // Draw OVR badge
    ctxCanvas.fillStyle = 'rgba(167, 139, 250, 0.12)';
    ctxCanvas.beginPath();
    ctxCanvas.arc(1080, 80, 45, 0, Math.PI * 2);
    ctxCanvas.fill();
    ctxCanvas.strokeStyle = '#a78bfa';
    ctxCanvas.lineWidth = 2;
    ctxCanvas.stroke();

    ctxCanvas.fillStyle = '#ffffff';
    ctxCanvas.font = 'bold 28px sans-serif';
    ctxCanvas.fillText(String(teamRating), 1080, 78);
    ctxCanvas.fillStyle = '#a78bfa';
    ctxCanvas.font = 'bold 12px sans-serif';
    ctxCanvas.fillText('TEAM OVR', 1080, 100);

    // Pre-load all card images
    const loadedCards = await Promise.all(
      xi.map(async (p) => {
        try {
          const cardPath = await getOrGeneratePlayerCardPath(p);
          return await loadImage(cardPath);
        } catch (err) {
          console.error(`Failed to load card for ${p.name}:`, err);
          return null;
        }
      })
    );

    const cardWidth = 180;
    const cardHeight = 225; // 4:5 ratio
    const positions = [];

    // Row 1 (y = 170)
    let marginRow1 = (width - (4 * cardWidth)) / 5;
    for (let i = 0; i < 4; i++) {
      positions.push({ x: marginRow1 + i * (cardWidth + marginRow1), y: 170 });
    }

    // Row 2 (y = 435)
    let marginRow2 = (width - (4 * cardWidth)) / 5;
    for (let i = 0; i < 4; i++) {
      positions.push({ x: marginRow2 + i * (cardWidth + marginRow2), y: 435 });
    }

    // Row 3 (y = 700)
    let marginRow3 = (width - (3 * cardWidth)) / 4;
    for (let i = 0; i < 3; i++) {
      positions.push({ x: marginRow3 + i * (cardWidth + marginRow3), y: 700 });
    }

    for (let i = 0; i < 11; i++) {
      const p = xi[i];
      const pos = positions[i];
      const cardImg = loadedCards[i];
      const isCaptain = captain && p.id === captain.id;

      if (!cardImg) continue;

      if (isCaptain) {
        ctxCanvas.save();
        // Golden glowing shadow aura
        ctxCanvas.shadowColor = '#ffd700';
        ctxCanvas.shadowBlur = 30;
        ctxCanvas.shadowOffsetX = 0;
        ctxCanvas.shadowOffsetY = 0;

        // Draw card image with shadow applied
        ctxCanvas.drawImage(cardImg, pos.x, pos.y, cardWidth, cardHeight);
        ctxCanvas.restore();

        // Draw a premium gold border around the captain card
        ctxCanvas.strokeStyle = '#ffd700';
        ctxCanvas.lineWidth = 3;
        ctxCanvas.strokeRect(pos.x, pos.y, cardWidth, cardHeight);

        // Draw Gold Crown above the card
        ctxCanvas.fillStyle = '#ffd700';
        ctxCanvas.save();
        ctxCanvas.shadowColor = '#ffd700';
        ctxCanvas.shadowBlur = 10;
        ctxCanvas.beginPath();
        const cx = pos.x + cardWidth / 2;
        const cy = pos.y - 22;
        const cw = 24;
        const ch = 16;
        ctxCanvas.moveTo(cx - cw/2, cy + ch/2);
        ctxCanvas.lineTo(cx + cw/2, cy + ch/2);
        ctxCanvas.lineTo(cx + cw/2, cy - ch/4);
        ctxCanvas.lineTo(cx + cw/4, cy + ch/8);
        ctxCanvas.lineTo(cx, cy - ch/2);
        ctxCanvas.lineTo(cx - cw/4, cy + ch/8);
        ctxCanvas.lineTo(cx - cw/2, cy - ch/4);
        ctxCanvas.closePath();
        ctxCanvas.fill();
        ctxCanvas.restore();

        // Draw Captain Badge: A clean gold pill badge with text "CAPTAIN"
        const badgeW = 90;
        const badgeH = 20;
        const badgeX = pos.x + cardWidth / 2 - badgeW / 2;
        const badgeY = pos.y - 7;

        ctxCanvas.fillStyle = '#ffd700';
        drawRoundRect(ctxCanvas, badgeX, badgeY, badgeW, badgeH, 4);
        ctxCanvas.fill();

        // Write "CAPTAIN" inside badge
        ctxCanvas.fillStyle = '#000000';
        ctxCanvas.font = 'bold 11px sans-serif';
        ctxCanvas.textAlign = 'center';
        ctxCanvas.fillText('CAPTAIN', pos.x + cardWidth / 2, badgeY + 14);
      } else {
        // Draw normal card
        ctxCanvas.drawImage(cardImg, pos.x, pos.y, cardWidth, cardHeight);
      }

      // Draw Pos Number Badge at top-left of each card
      ctxCanvas.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctxCanvas.beginPath();
      ctxCanvas.arc(pos.x + 20, pos.y + 20, 14, 0, Math.PI * 2);
      ctxCanvas.fill();
      
      ctxCanvas.strokeStyle = isCaptain ? '#ffd700' : 'rgba(255, 255, 255, 0.4)';
      ctxCanvas.lineWidth = 1.5;
      ctxCanvas.stroke();

      ctxCanvas.fillStyle = '#ffffff';
      ctxCanvas.font = 'bold 12px sans-serif';
      ctxCanvas.textAlign = 'center';
      ctxCanvas.fillText(String(i + 1), pos.x + 20, pos.y + 24);
    }

    const buffer = canvas.toBuffer('image/png');
    await ctx.replyWithPhoto(new InputFile(buffer, 'playing11.png'), {
      caption: `🏏 <b>PLAYING XI — ${escapeHTML(teamName)}</b>\n\n📊 <b>XI Rating:</b> <code>${teamRating} OVR</code>\n\n💡 <i>Use <code>/swap [pos1] [pos2]</code> to swap players.</i>`,
      parse_mode: 'HTML'
    });

  } catch (e) {
    console.error("Error in /image command:", e);
    await ctx.reply("❌ Failed to generate the Playing XI image. Please try again.");
  }
});

bot.command('captain', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");

  const userId = ctx.from.id;
  const query = ctx.match?.trim();

  try {
    const squad = await sb.getUserCricketTeam(userId);
    if (!squad || squad.length === 0) {
      return ctx.reply("❌ You don't have any players in your Cricket squad yet. Use /claim or /shop to get players!", { parse_mode: 'HTML' });
    }

    if (query) {
      // Find matching player in user's cricket squad
      const matches = squad.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
      if (matches.length === 0) {
        return ctx.reply(`❌ No player matching "<b>${escapeHTML(query)}</b>" was found in your Cricket squad.`, { parse_mode: 'HTML' });
      }

      let chosen = null;
      if (matches.length === 1) {
        chosen = matches[0];
      } else {
        const exactMatch = matches.find(p => p.name.toLowerCase() === query.toLowerCase());
        if (exactMatch) {
          chosen = exactMatch;
        } else {
          const list = matches.slice(0, 10).map(p => `• <b>${escapeHTML(p.name)}</b> (OVR: ${p.ovr})`).join('\n');
          const truncated = matches.length > 10 ? `\n...and ${matches.length - 10} more.` : '';
          return ctx.reply(
            `🔍 <b>Multiple matching players found in your squad:</b>\n\n${list}${truncated}\n\n` +
            `<i>Please specify a more precise name.</i>`,
            { parse_mode: 'HTML' }
          );
        }
      }

      const res = await sb.setCaptain(userId, chosen.id, 'cricket');
      if (res.success) {
        return ctx.reply(`👑 <b>${escapeHTML(chosen.name)}</b> (OVR: ${chosen.ovr}) has been successfully appointed as your Cricket Team Captain!`, { parse_mode: 'HTML' });
      } else {
        return ctx.reply(`❌ Failed to update captain: ${res.error}`);
      }
    } else {
      // Resolve and display current captain
      const assignedCaptainId = await sb.getCaptain(userId, 'cricket');
      let captain = null;
      let isDefault = true;

      if (assignedCaptainId) {
        captain = squad.find(p => p.id === assignedCaptainId);
        if (captain) {
          isDefault = false;
        }
      }

      if (!captain) {
        // Fallback: highest rated player
        const sorted = [...squad].sort((a, b) => {
          if (b.ovr !== a.ovr) return b.ovr - a.ovr;
          const bBat = b.batting_rating || 0;
          const aBat = a.batting_rating || 0;
          if (bBat !== aBat) return bBat - aBat;
          return a.name.localeCompare(b.name);
        });
        captain = sorted[0];
        isDefault = true;
      }

      let msg = `👑 <b>CRICKET TEAM CAPTAIN</b>\n\n`;
      msg += `• <b>Name:</b> <b>${escapeHTML(captain.name)}</b>\n`;
      msg += `• <b>Rating:</b> <code>${captain.ovr} OVR</code>\n`;
      msg += `• <b>Role:</b> <code>${captain.role.toUpperCase().replace('_', ' ')}</code>\n`;
      msg += `• <b>Status:</b> ${isDefault ? '⚠️ <i>Default Captain (highest OVR)</i>' : '✅ <i>Appointed Captain</i>'}\n\n`;
      msg += `ℹ️ <i>To assign a different player as captain, use:</i>\n<code>/captain &lt;player_name&gt;</code>`;
      return ctx.reply(msg, { parse_mode: 'HTML' });
    }
  } catch (error) {
    console.error("Error in /captain command:", error);
    ctx.reply("❌ An error occurred while processing the /captain command.");
  }
});

bot.command('swap', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");

  const userId = ctx.from.id;
  const args = ctx.match ? ctx.match.trim().split(/\s+/) : [];
  
  if (args.length < 2) {
    return ctx.reply("ℹ️ <b>Usage:</b> <code>/swap &lt;pos1&gt; &lt;pos2&gt;</code>\n\nExample: <code>/swap 4 12</code> swaps the player at position 4 with the one at position 12.", { parse_mode: 'HTML' });
  }

  const pos1 = parseInt(args[0]);
  const pos2 = parseInt(args[1]);

  if (isNaN(pos1) || isNaN(pos2) || pos1 < 1 || pos2 < 1 || pos1 > 25 || pos2 > 25) {
    return ctx.reply("❌ Positions must be numbers between 1 and 25.");
  }
  if (pos1 === pos2) {
    return ctx.reply("❌ You can't swap a player with themselves!");
  }

  await sb.ensureUser(userId, ctx.from.first_name).catch(() => {});

  try {
    const result = await sb.swapSquadOrder(userId, pos1, pos2);
    if (result.success) {
      await ctx.reply(`✅ Swapped position <b>${pos1}</b> ↔ <b>${pos2}</b> successfully!\n\n💡 Use /xi to see your updated Playing XI.`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ ${result.error}`);
    }
  } catch (e) {
    console.error("Error in /swap command:", e);
    await ctx.reply("❌ An error occurred while swapping players.");
  }
});

bot.command('shop', async (ctx) => {
  const kb = addShopButton(new InlineKeyboard(), ctx, "🛒 Open Player Shop", "shop");
  
  await ctx.reply(
    "🛒 <b>Welcome to the Player Shop!</b>\n\nDirectly buy Cricket and Football players using your coins to build your ultimate dream team!\n\nClick the button below to browse available players, filter by role/rating, and sign them to your squad.",
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

bot.command('sell', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply(
      "⚠️ <b>Please mention a player name.</b>\n" +
      "Example: `/sell KL Rahul` or `/sell kl`",
      { parse_mode: 'HTML' }
    );
  }

  const userId = ctx.from.id;

  // Check active transaction
  const active = activeTransactions.get(userId);
  if (active && Date.now() < active.expiresAt) {
    return ctx.reply("⚠️ You already have a pending transaction active. Please complete, cancel, or wait for it to expire.");
  }

  await sb.ensureUser(userId, ctx.from.first_name).catch(() => {});

  try {
    const owned = await sb.getUserOwnedPlayers(userId);
    if (!owned || owned.length === 0) {
      return ctx.reply("❌ You do not own any players yet!");
    }

    const cricketFromDb = await sb.getCricketPlayers();
    
    // Find all matches
    const matches = [];

    // Check Cricket players
    const ownedCricketIds = owned.filter(o => o.sport === 'cricket').map(o => o.player_id);
    const matchedCricket = cricketFromDb.filter(p => 
      ownedCricketIds.includes(p.id) && 
      p.name.toLowerCase().includes(query.toLowerCase())
    );
    matchedCricket.forEach(p => {
      const ownedRecord = owned.find(o => o.player_id === p.id && o.sport === 'cricket');
      matches.push({
        id: p.id,
        name: p.name,
        ovr: p.ovr,
        buy_price: p.buy_price,
        sport: 'cricket',
        acquired_at: ownedRecord ? ownedRecord.acquired_at : null
      });
    });

    // Check Football players
    const ownedFootballIds = owned.filter(o => o.sport === 'football').map(o => o.player_id);
    const matchedFootball = footballPlayers.filter(p => 
      ownedFootballIds.includes(p.id) && 
      p.name.toLowerCase().includes(query.toLowerCase())
    );
    matchedFootball.forEach(p => {
      matches.push({
        id: p.id,
        name: p.name,
        ovr: p.ovr,
        buy_price: p.buy_price,
        sport: 'football'
      });
    });

    if (matches.length === 0) {
      return ctx.reply(`❌ No owned player matches your search for "<b>${escapeHTML(query)}</b>".`, { parse_mode: 'HTML' });
    }

    if (matches.length > 1) {
      // Check if there is an exact name match (case-insensitive) to resolve ambiguity immediately
      const exactMatch = matches.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        // Use the exact match and clear the others
        matches.length = 0;
        matches.push(exactMatch);
      } else {
        const list = matches.map(p => `• <b>${escapeHTML(p.name)}</b> (OVR: ${p.ovr}, ${p.sport === 'cricket' ? '🏏' : '⚽'})`).join('\n');
        return ctx.reply(
          `🔍 <b>Multiple players found matching "${escapeHTML(query)}":</b>\n\n${list}\n\n` +
          `<i>Please specify a more precise name (e.g., /sell ${escapeHTML(matches[0].name)}).</i>`,
          { parse_mode: 'HTML' }
        );
      }
    }

    // Exactly one player match
    const player = matches[0];
    const actualBuyPrice = resolvePlayerPrice(player, player.acquired_at);
    const sellPrice = Math.round(actualBuyPrice * 0.55);

    // Register active transaction
    activeTransactions.set(userId, {
      type: 'sell',
      expiresAt: Date.now() + 3 * 60 * 1000,
      playerId: player.id
    });

    const text = `⚠️ <b>Confirm Player Sale</b>\n\n` +
                 `Are you sure you want to sell <b>${escapeHTML(player.name)}</b>?\n` +
                 `• OVR: <b>${player.ovr}</b>\n` +
                 `• Sport: <b>${player.sport === 'cricket' ? '🏏 Cricket' : '⚽ Football'}</b>\n` +
                 `• Original Price: 💰 <b>${actualBuyPrice.toLocaleString()}</b>\n\n` +
                 `💰 You will receive: <b>${sellPrice.toLocaleString()} coins</b>.\n\n` +
                 `<i>Do you want to proceed?</i>`;

    const kb = new InlineKeyboard()
      .text("✅ Yes, Sell", `sell_y:${player.sport === 'cricket' ? 'c' : 'f'}:${player.id}:${userId}`)
      .text("❌ No, Cancel", `sell_n:${userId}`);

    const sentMsg = await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb });

    // 3 minute timeout
    const timeoutId = setTimeout(async () => {
      const currentActive = activeTransactions.get(userId);
      if (currentActive && currentActive.type === 'sell' && currentActive.messageId === sentMsg.message_id) {
        activeTransactions.delete(userId);
        try {
          await ctx.api.editMessageText(ctx.chat.id, sentMsg.message_id, `❌ Sale request for <b>${escapeHTML(player.name)}</b> has expired.`, { reply_markup: null });
        } catch (e) {}
      }
    }, 3 * 60 * 1000);

    // Update with message details
    activeTransactions.set(userId, {
      type: 'sell',
      expiresAt: Date.now() + 3 * 60 * 1000,
      playerId: player.id,
      chatId: ctx.chat.id,
      messageId: sentMsg.message_id,
      timeoutId: timeoutId
    });

  } catch (error) {
    console.error("Error in /sell command:", error);
    activeTransactions.delete(userId);
    await ctx.reply("❌ An error occurred while processing the sale request.");
  }
});

bot.command('buy', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");

  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply("❌ Usage: <code>/buy &lt;player name&gt;</code>\nExample: <code>/buy Virat Kohli</code>", { parse_mode: 'HTML' });
  }

  const userId = ctx.from.id;
  
  // Check active transaction
  const active = activeTransactions.get(userId);
  if (active && Date.now() < active.expiresAt) {
    return ctx.reply("⚠️ You already have a pending transaction active. Please complete, cancel, or wait for it to expire.");
  }

  const player = await resolveCricketPlayer(ctx, query);
  if (!player) return;

  // Set lock immediately
  activeTransactions.set(userId, {
    type: 'buy',
    expiresAt: Date.now() + 3 * 60 * 1000,
    playerId: player.id
  });

  const roleStr = (player.role || 'N/A').toUpperCase().replace('_', ' ');
  const flag = countryFlags[player.country] || '🏳️';
  const priceStr = player.buy_price ? player.buy_price.toLocaleString() : 'N/A';
  const caption = `<b>${roleStr}</b> ${flag}\n\n<blockquote>💰 <b>${priceStr}</b> coins</blockquote>`;

  const kb = new InlineKeyboard()
    .text("Buy", `buy_confirm:${player.id}:${userId}`)
    .text("Cancel", `buy_cancel:${player.id}:${userId}`);

  try {
    const sentMsg = await sendPlayerCard(ctx, player, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: kb
    });

    const timeoutId = setTimeout(async () => {
      const currentActive = activeTransactions.get(userId);
      if (currentActive && currentActive.type === 'buy' && currentActive.messageId === sentMsg.message_id) {
        activeTransactions.delete(userId);
        try {
          await ctx.api.editMessageCaption(ctx.chat.id, sentMsg.message_id, {
            caption: `❌ Buying request for <b>${escapeHTML(player.name)}</b> has expired.`,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] }
          });
        } catch (e) {}
      }
    }, 3 * 60 * 1000);

    activeTransactions.set(userId, {
      type: 'buy',
      expiresAt: Date.now() + 3 * 60 * 1000,
      playerId: player.id,
      chatId: ctx.chat.id,
      messageId: sentMsg.message_id,
      timeoutId: timeoutId
    });

  } catch (err) {
    console.error("Error sending buy player card:", err);
    activeTransactions.delete(userId);
    ctx.reply(`❌ Failed to initiate purchase: ${err.message}`);
  }
});

const OFFICIAL_GC_ID = -1003906592838;
const OFFICIAL_GC_USER = "@UnderCoverOfficialGroup";

async function handleDropCommand(ctx) {
  const userId = ctx.from.id;
  
  // If they manually claim, remove any pending reminder
  pendingReminders.delete(userId);

  const msg = await ctx.reply("🔄 <i>Preparing your mystery drop...</i>", { parse_mode: 'HTML' });
  
  const startParam = `drop_${msg.message_id}_${ctx.chat.id}`;
  const directLink = `https://t.me/${ctx.me.username}/bonus?startapp=${startParam}`;
  
  const kb = new InlineKeyboard().url("📺 Watch & Claim Mystery Drop", directLink);

  await ctx.api.editMessageText(ctx.chat.id, msg.message_id,
    "🃏 <b>Mystery Drop is here!</b>\n\nTap below to claim your reward.",
    { parse_mode: 'HTML', reply_markup: kb }
  );
}

bot.command('drop', async (ctx) => {
  await handleDropCommand(ctx);
});

bot.command('spin', async (ctx) => {
    const directLink = `https://t.me/${ctx.me.username}/bonus?startapp=spin`;
    const kb = new InlineKeyboard().url("🎡 Spin the Lucky Wheel", directLink);
    
    await ctx.reply(
        "🎡 <b>Lucky Spin Wheel</b>\n\nTry your luck! Spin the wheel to win the Grand Prize: 👑 <b>Glenn Maxwell</b> (88 OVR All-Rounder)!\n\n<i>You get 1 free spin every 24 hours. Additional spins require watching a short ad.</i>",
        { parse_mode: 'HTML', reply_markup: kb }
    );
});

bot.command('claim', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const userId = ctx.from.id;
  const firstName = ctx.from.first_name || 'Player';
  
  await sb.ensureUser(userId, firstName).catch(() => {});
  
  try {
    const result = await sb.claimStarterPack(userId);
    
    if (result.success) {
      let msg = '';
      if (result.isBackfill) {
        msg += `🔧 <b>Starter Pack Backfilled!</b> 🔧\n`;
        msg += `══════════════════════════\n`;
        msg += `We detected your squad was incomplete. We have awarded you the missing players to complete your Playing XI!\n\n`;
        msg += `🏏 <b>ADDED PLAYERS (${result.players.length}):</b>\n`;
        result.players.forEach(p => {
          msg += `• 👤 <b>${escapeHTML(p.name)}</b> (${p.ovr} OVR) - <i>${escapeHTML(p.role || 'Player')}</i>\n`;
        });
      } else {
        const starPlayer = result.players.find(p => p.ovr === 84);
        const lowPlayers = result.players.filter(p => p.ovr !== 84);
        
        msg += `🎁 <b>Starter Pack Claimed!</b> 🎁\n`;
        msg += `══════════════════════════\n`;
        msg += `Congratulations <a href="tg://user?id=${userId}">${escapeHTML(firstName)}</a>! You have successfully claimed your Cricket Starter Pack.\n\n`;
        
        msg += `🌟 <b>STAR PLAYER (1):</b>\n`;
        if (starPlayer) {
          msg += `• 🏆 <b>${escapeHTML(starPlayer.name)}</b> (${starPlayer.ovr} OVR) - <i>${escapeHTML(starPlayer.role || 'All-Rounder')}</i>\n\n`;
        } else {
          msg += `• None (Error fetching star player)\n\n`;
        }
        
        msg += `🏏 <b>LOW OVR PLAYERS (10):</b>\n`;
        lowPlayers.forEach(p => {
          msg += `• 👤 <b>${escapeHTML(p.name)}</b> (${p.ovr} OVR) - <i>${escapeHTML(p.role || 'Player')}</i>\n`;
        });
      }
      
      msg += `\n🎯 Build your Playing XI and start challenging players using <code>/cric</code>!`;
      
      await ctx.reply(msg, { parse_mode: 'HTML' });
    } else {
      if (result.error === 'ALREADY_CLAIMED') {
        await ctx.reply("⚠️ You have already claimed your starter pack!");
      } else if (result.error === 'NO_PLAYERS' || result.error === 'INSUFFICIENT_LOW_POOL' || result.error === 'INSUFFICIENT_STAR_POOL') {
        await ctx.reply(`❌ <b>Claim Failed:</b> There are not enough players in the database pool to generate a starter pack.`);
      } else {
        await ctx.reply(`❌ <b>Claim Failed:</b> ${escapeHTML(result.error || 'An error occurred while claiming.')}`);
      }
    }
  } catch (e) {
    console.error("Error in /claim command:", e);
    await ctx.reply("❌ An error occurred while processing your starter pack claim.");
  }
});

bot.command('daily', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const userId = ctx.from.id;
  let isMember = false;
  
  if (ctx.chat && ctx.chat.id === OFFICIAL_GC_ID) {
      isMember = true;
  } else {
      try {
          const member = await ctx.api.getChatMember(OFFICIAL_GC_ID, userId);
          isMember = ['member', 'administrator', 'creator', 'restricted'].includes(member.status);
      } catch (e) {
          isMember = false;
      }
  }
  
  const amount = isMember ? 1000 : 500;
  const result = await sb.claimDaily(userId, amount);
  
  if (result.success) {
      let msg = `💰 <b>Daily Reward Claimed!</b>\n\n`;
      msg += `You received <b>${amount}</b> coins.\n`;
      msg += `New Balance: <b>${result.newBalance}</b> coins.\n\n`;
      
      if (!isMember) {
          msg += `💡 <b>Tip:</b> Join our ${OFFICIAL_GC_USER} to get <b>1000 coins</b> every day!`;
      }
      
      await ctx.reply(msg, { parse_mode: 'HTML' });
  } else if (result.remaining) {
      await ctx.reply(`⏳ <b>Cooldown</b>\n\nYou've already claimed your daily reward. Please wait <b>${result.remaining}</b> before claiming again.`, { parse_mode: 'HTML' });
  } else {
      await ctx.reply(`❌ ${result.error}`);
  }
});

bot.command('balance', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  await sb.ensureUser(user.id, user.first_name).catch(() => {});
  const profile = await sb.getProfile(user.id);
  if (!profile) return ctx.reply("You have not registered yet.");
  await ctx.reply(`💰 <b>Balance for <a href="tg://user?id=${user.id}">${escapeHTML(profile.first_name)}</a>:</b> ${profile.coins || 0} Coins`, { parse_mode: 'HTML' });
});

bot.command('addcoins', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return;
  const args = ctx.message.text.split(' ');
  if (args.length < 3) return ctx.reply("❌ Usage: /addcoins <userId> <amount>");
  
  const targetUserId = parseInt(args[1]);
  const amount = parseInt(args[2]);
  
  if (isNaN(amount) || isNaN(targetUserId)) return ctx.reply("❌ Invalid numeric values.");
  
  const newBal = await sb.addCoins(targetUserId, amount);
  if (newBal === 0 && amount !== 0) {
      const profile = await sb.getProfile(targetUserId);
      if (!profile) return ctx.reply("❌ Failed to add coins. User might not exist in the DB.");
  }
  
  await ctx.reply(`✅ Successfully added <b>${amount}</b> coins to User ID: <code>${targetUserId}</code>.\nNew Balance: <b>${newBal}</b> 💰`, { parse_mode: 'HTML' });
  await notifySuperAdmins(ctx, 'Add Coins', `Added ${amount} coins to User ID: <code>${targetUserId}</code>.`);
});

bot.command('addmod', async (ctx) => {
  if (!ADMIN_IDS.includes(ctx.from.id)) return;
  
  let targetUserId = null;
  let targetFirstName = "User";

  if (ctx.message.reply_to_message) {
      targetUserId = ctx.message.reply_to_message.from.id;
      targetFirstName = ctx.message.reply_to_message.from.first_name || "User";
  } else {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
          return ctx.reply("❌ Usage: Reply to a user with `/addmod` or use `/addmod <userId>`", { parse_mode: 'HTML' });
      }
      targetUserId = parseInt(args[1]);
      if (isNaN(targetUserId)) {
          return ctx.reply("❌ Invalid User ID specified.");
      }
  }

  await sb.ensureUser(targetUserId, targetFirstName).catch(() => {});
  
  const success = await sb.addModerator(targetUserId);
  if (success) {
      await ctx.reply(`✅ Successfully added <b>${escapeHTML(targetFirstName)}</b> (ID: <code>${targetUserId}</code>) as a Moderator!`, { parse_mode: 'HTML' });
      await notifySuperAdmins(ctx, 'Add Moderator', `Added <b>${escapeHTML(targetFirstName)}</b> (ID: <code>${targetUserId}</code>) as a Moderator.`);
  } else {
      await ctx.reply("❌ Failed to add Moderator. Please try again.", { parse_mode: 'HTML' });
  }
});

bot.command('addadmin', async (ctx) => {
  if (!SUPER_ADMIN_IDS.includes(ctx.from.id)) return;
  
  let targetUserId = null;
  let targetFirstName = "User";

  if (ctx.message.reply_to_message) {
      targetUserId = ctx.message.reply_to_message.from.id;
      targetFirstName = ctx.message.reply_to_message.from.first_name || "User";
  } else {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
          return ctx.reply("❌ Usage: Reply to a user with `/addadmin` or use `/addadmin <userId>`", { parse_mode: 'HTML' });
      }
      targetUserId = parseInt(args[1]);
      if (isNaN(targetUserId)) {
          return ctx.reply("❌ Invalid User ID specified.");
      }
  }

  await sb.ensureUser(targetUserId, targetFirstName).catch(() => {});
  
  const success = await sb.addAdmin(targetUserId);
  if (success) {
      await loadAdmins();
      await ctx.reply(`✅ Successfully added <b>${escapeHTML(targetFirstName)}</b> (ID: <code>${targetUserId}</code>) as an Admin!`, { parse_mode: 'HTML' });
      await notifySuperAdmins(ctx, 'Add Admin', `Added <b>${escapeHTML(targetFirstName)}</b> (ID: <code>${targetUserId}</code>) as an Admin.`);
  } else {
      await ctx.reply("❌ Failed to add Admin. Please try again.", { parse_mode: 'HTML' });
  }
});

bot.command('removeadmin', async (ctx) => {
  if (!SUPER_ADMIN_IDS.includes(ctx.from.id)) return;
  
  let targetUserId = null;
  let targetFirstName = "User";

  if (ctx.message.reply_to_message) {
      targetUserId = ctx.message.reply_to_message.from.id;
      targetFirstName = ctx.message.reply_to_message.from.first_name || "User";
  } else {
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
          return ctx.reply("❌ Usage: Reply to a user with `/removeadmin` or use `/removeadmin <userId>`", { parse_mode: 'HTML' });
      }
      targetUserId = parseInt(args[1]);
      if (isNaN(targetUserId)) {
          return ctx.reply("❌ Invalid User ID specified.");
      }
  }

  const success = await sb.removeAdmin(targetUserId);
  if (success) {
      await loadAdmins();
      await ctx.reply(`✅ Successfully removed User ID <code>${targetUserId}</code> from Admins!`, { parse_mode: 'HTML' });
      await notifySuperAdmins(ctx, 'Remove Admin', `Removed User ID: <code>${targetUserId}</code> from Admins.`);
  } else {
      await ctx.reply("❌ Failed to remove Admin. Please try again.", { parse_mode: 'HTML' });
  }
});

bot.command('remove', async (ctx) => {
  const isMod = await sb.checkIsModerator(ctx.from.id);
  const isAdmin = ADMIN_IDS.includes(ctx.from.id);
  if (!isAdmin && !isMod) return;

  let targetUserId = null;
  if (ctx.message.reply_to_message) {
    targetUserId = ctx.message.reply_to_message.from.id;
  } else {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
      return ctx.reply("❌ Usage: Reply to a user with `/remove` or use `/remove <userId>`", { parse_mode: 'HTML' });
    }
    targetUserId = parseInt(args[1]);
    if (isNaN(targetUserId)) {
      return ctx.reply("❌ Invalid User ID specified.");
    }
  }

  const cricLobby = getUserActiveLobby(targetUserId);
  if (cricLobby) {
    const chatId = cricLobby.chatId;
    delete activeLobbies[chatId];
    await ctx.reply(`✅ Successfully cancelled the active cricket match lobby in chat <code>${chatId}</code> for User ID <code>${targetUserId}</code>.`, { parse_mode: 'HTML' });
    await notifySuperAdmins(ctx, 'Remove Lobby', `Cancelled active cricket match lobby in chat <code>${chatId}</code> for User ID <code>${targetUserId}</code>.`);
    return;
  }

  const match = matchManager.getActiveMatch(targetUserId);
  if (!match) {
    return ctx.reply(`❌ No active cricket match or lobby found for User ID <code>${targetUserId}</code>.`, { parse_mode: 'HTML' });
  }

  match.status = 'completed';
  matchManager.saveToDb(match);
  
  // Cleanup from activeMatches
  delete matchManager.activeMatches[match.host.telegramId];
  delete matchManager.activeMatches[match.id];
  if (match.guest && match.guest.telegramId !== 'ai') {
    delete matchManager.activeMatches[match.guest.telegramId];
  }

  await ctx.reply(`✅ Successfully removed User ID <code>${targetUserId}</code> from active cricket match <code>${match.id}</code>. Match has been cancelled with no penalties or rewards.`, { parse_mode: 'HTML' });
  await bot.api.sendMessage(match.chatId, `🛠️ Match has been terminated by an Admin/Moderator. No penalties or rewards applied.`, { parse_mode: 'HTML' }).catch(()=>{});
  await notifySuperAdmins(ctx, 'Remove Match', `Removed User ID <code>${targetUserId}</code> from active cricket match <code>${match.id}</code>.`);
});

bot.command('rain', async (ctx) => {
  const isMod = await sb.checkIsModerator(ctx.from.id);
  const isAdmin = ADMIN_IDS.includes(ctx.from.id);
  if (!isAdmin && !isMod) return;
  
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return ctx.reply("❌ This command can only be used in group chats.");
  }

  // Check 1-hour cooldown
  const lastRain = rainCooldowns.get(ctx.chat.id);
  const now = Date.now();
  const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
  if (lastRain && (now - lastRain < COOLDOWN_MS)) {
      const remainingMin = Math.ceil((COOLDOWN_MS - (now - lastRain)) / (60 * 1000));
      return ctx.reply(`❌ <b>Rain is on cooldown!</b> Please wait <b>${remainingMin}</b> more minute(s) before summoning another rain in this group.`, { parse_mode: 'HTML' });
  }
  
  const chatMap = groupActivity.get(ctx.chat.id);
  if (!chatMap || chatMap.size === 0) {
      return ctx.reply("🌧️ <b>No activity recorded in this chat yet!</b>", { parse_mode: 'HTML' });
  }
  
  const sortedUsers = [];
  for (const [userId, userStats] of chatMap.entries()) {
      if (userStats.count > 0) {
          sortedUsers.push({ userId, name: userStats.name, count: userStats.count });
      }
  }
  
  if (sortedUsers.length === 0) {
      return ctx.reply("🌧️ <b>No active users since last rain!</b>", { parse_mode: 'HTML' });
  }
  
  sortedUsers.sort((a, b) => b.count - a.count);
  const topUsers = sortedUsers.slice(0, 10);
  
  const results = [];
  for (const u of topUsers) {
      const base = u.count * 8;
      const randomOffset = Math.floor(Math.random() * 7) - 3; // -3 to +3
      const reward = Math.min(1000, Math.max(5, base + randomOffset));
      if (reward > 0) {
          await sb.ensureUser(u.userId, u.name).catch(() => {});
          await sb.addCoins(u.userId, reward);
          results.push({ name: u.name, reward });
      }
  }
  
  if (results.length === 0) {
      return ctx.reply("🌧️ <b>No users qualified for the rain reward yet!</b>", { parse_mode: 'HTML' });
  }

  // Set cooldown
  rainCooldowns.set(ctx.chat.id, now);
  
  // Reset activity for this group chat
  groupActivity.delete(ctx.chat.id);
  
  let msg = `🌧️ <b>THE COIN RAIN HAS FALLEN!</b> 🌧️\n\n`;
  results.forEach((res, index) => {
      msg += `${index + 1}. <b>${escapeHTML(res.name)}</b> - 💰 <b>${res.reward}</b> coins\n`;
  });
  
  await ctx.reply(msg, { parse_mode: 'HTML' });
  await notifySuperAdmins(ctx, 'Rain', `Initiated coin rain in group chat <code>${ctx.chat.id}</code>. Rewarded ${results.length} users.`);
});

const sendCooldowns = new Map();

bot.command('send', async (ctx) => {
  if (ctx.chat.id !== -1003906592838) {
      const kb = new InlineKeyboard().url("📢 Join Official Group", "https://t.me/UnderCoverOfficialGroup");
      return ctx.reply("❌ The <code>/send</code> command is restricted to the Official Group Chat.", { 
          reply_markup: kb, 
          parse_mode: 'HTML' 
      });
  }
  if (!sb.supabase) return ctx.reply("Database is currently disabled.");
  
  const senderId = ctx.from.id;
  
  const lastSend = sendCooldowns.get(senderId);
  if (lastSend && Date.now() - lastSend < 5000) {
      return ctx.reply("⏳ Please wait a few seconds before sending again.");
  }
  sendCooldowns.set(senderId, Date.now());
  
  const replyTo = ctx.message.reply_to_message;
  if (!replyTo) {
      return ctx.reply("❌ You must reply to the user you want to send coins to.\nUsage: Reply to a user with <code>/send 100</code>", { parse_mode: 'HTML' });
  }
  
  if (replyTo.from.is_bot) {
      return ctx.reply("❌ You cannot send coins to a bot.");
  }
  
  if (replyTo.from.id === ctx.from.id) {
      return ctx.reply("❌ You cannot send coins to yourself.");
  }
  
  const args = ctx.message.text.split(' ');
  if (args.length < 2) {
      return ctx.reply("❌ Usage: Reply to a user with <code>/send &lt;amount&gt;</code>", { parse_mode: 'HTML' });
  }
  
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
      return ctx.reply("❌ Invalid amount. Please specify a positive number of coins.");
  }
  
  const receiverId = replyTo.from.id;
  
  await sb.ensureUser(senderId, ctx.from.first_name).catch(() => {});
  await sb.ensureUser(receiverId, replyTo.from.first_name).catch(() => {});
  
  const result = await sb.transferCoins(senderId, receiverId, amount);
  
  if (result.success) {
      await ctx.reply(`💸 <b>Transfer Successful!</b>\n\n<a href="tg://user?id=${senderId}">${escapeHTML(ctx.from.first_name)}</a> sent <b>${amount}</b> coins to <a href="tg://user?id=${receiverId}">${escapeHTML(replyTo.from.first_name)}</a>!`, { parse_mode: 'HTML' });
  } else {
      await ctx.reply(`❌ ${result.error}`);
  }
});

function sendHiloMsg(ctx, state, isEdit = false, chatId = null, msgId = null, extraMsg = '') {
  const text = `${extraMsg}🎲 <b>HIGH-LOW</b> 🎲\n\n` + 
               `💰 Bet: <b>${state.betAmount}</b>\n` +
               `🔥 Multiplier: <b>${state.multiplier}x</b>\n\n` +
               `👤 Base Player: <b>${state.currentPlayer.name}</b> (${state.currentPlayer[state.constraint]})\n` +
               `📊 Constraint: <b>${state.constraint}</b>\n\n` +
               `Will the next random player's <b>${state.constraint}</b> be Higher or Lower than ${state.currentPlayer.name}'s?`;
               
  let withdrawAmount = Math.floor(state.betAmount * state.multiplier);
  if (state.multiplier <= 1.0) withdrawAmount = Math.floor(state.betAmount * 0.9);

  const kb = new InlineKeyboard()
    .text("🔼 Higher", "hilo_higher")
    .text("🔽 Lower", "hilo_lower").row()
    .text(`💰 Withdraw (${withdrawAmount})`, "hilo_withdraw");

  if (isEdit) {
      return bot.api.editMessageText(chatId, msgId, text, { reply_markup: kb, parse_mode: 'HTML' }).catch(()=>{});
  }
  return ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
}

bot.command('cric', async (ctx) => {
  const args = ctx.match ? ctx.match.trim().split(/\s+/) : [];
  const lArgs = args.map(a => a.toLowerCase());
  const isDraft = lArgs.includes('draft');
  const isIpl   = lArgs.includes('ipl');
  
  const telegramId = ctx.from.id;
  const username   = ctx.from.username || ctx.from.first_name || 'Host';

  if (sb.supabase) {
    await sb.ensureUser(telegramId, ctx.from.first_name).catch(() => {});
  }

  // ── Normal / Draft / IPL Mode ──────────────────────────────────────────
  try {
    let teamName = `${username}'s XI`;
    let squad = [];
    let xi = [];

    if (!isDraft && !isIpl) {
      if (sb.supabase) {
        squad = await sb.getUserCricketTeam(telegramId);
        const profile = await sb.getCricketProfile(telegramId);
        if (profile && profile.team_name) {
          teamName = profile.team_name;
        }
      }
      const xiResult = ai.selectValidPlayingXI(squad);
      if (!xiResult.success) {
        return ctx.reply(`❌ <b>Lobby Creation Failed!</b>\n\n${xiResult.error}`, { parse_mode: 'HTML' });
      }
      xi = xiResult.xi;
    } else {
      if (sb.supabase) {
        const profile = await sb.getCricketProfile(telegramId).catch(() => null);
        if (profile && profile.team_name) {
          teamName = profile.team_name;
        }
      }
    }

    if (matchManager.getActiveMatch(telegramId) || getUserActiveLobby(telegramId)) {
      return ctx.reply("⚠️ You already have an active match or lobby running!");
    }
    if (activeLobbies[ctx.chat.id]) {
      return ctx.reply("⚠️ There is already a match lobby waiting to be joined in this chat!");
    }

    activeLobbies[ctx.chat.id] = {
      chatId: ctx.chat.id,
      host: {
        telegramId,
        username,
        teamName,
        squad,
        xi
      },
      guest: null,
      status: 'waiting_join',
      overs: null,
      draftMode: isDraft,
      iplMode: isIpl,
      createdAt: Date.now()
    };

    const keyboard = new InlineKeyboard()
      .text('🤝 Join', 'cric_join')
      .text('❌ Cancel', 'cric_cancel_lobby');
    
    const modeLabel = isIpl ? " (IPL Mode 🏆)" : (isDraft ? " (Draft Mode ⚡)" : "");
    await ctx.reply(
      `🏏 <b>CRICKET MATCH LOBBY CREATED${modeLabel}!</b> 🏏\n` +
      `═════════════════════════════\n` +
      `• <b>Host:</b> @${escapeHTML(username)}\n\n` +
      `Click the button below to join the match!`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
  } catch (err) {
    console.error("Lobby creation error:", err);
    ctx.reply("❌ Failed to create lobby: " + err.message);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// IPL 2026 Mode: Team picker callbacks (triggered from /cric ipl)
// ─────────────────────────────────────────────────────────────────────────────

// Handle host team pick
bot.callbackQuery(/^cipl_host_team:/, async (ctx) => {
  const parts    = ctx.callbackQuery.data.split(':');
  const teamCode = parts[1];
  const chatId   = ctx.chat.id;
  const user     = ctx.from;

  if (activeLobbies[chatId]) {
    return ctx.answerCallbackQuery({ text: '⚠️ Lobby already exists!', show_alert: true });
  }

  const pool = IPL_SQUADS_POOL[teamCode];
  if (!pool) return ctx.answerCallbackQuery({ text: '❌ Invalid team.', show_alert: true });

  await ctx.answerCallbackQuery();

  const username = user.username || user.first_name || 'Host';
  const teamName = IPL_TEAM_NAMES[teamCode] || teamCode;

  // Create the lobby in IPL mode — XI is empty, pool is the full squad
  activeLobbies[chatId] = {
    chatId,
    host: {
      telegramId: user.id,
      username,
      teamName,
      teamCode,
      squad: pool,
      xi:    []       // will be picked via web app roster builder
    },
    guest:     null,
    status:    'waiting_join',
    overs:     null,
    iplMode:   true,
    createdAt: Date.now()
  };

  const kb = new InlineKeyboard()
    .text('🤝 Join', 'cipl_join')
    .text('❌ Cancel', 'cric_cancel_lobby');

  try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch (_) {}

  await ctx.reply(
    `🏆 <b>IPL 2026 LOBBY CREATED!</b> 🏆\n` +
    `═══════════════════════════════\n` +
    `• <b>Host:</b> @${escapeHTML(username)}\n` +
    `• <b>Team:</b> ${teamCode} — ${escapeHTML(teamName)}\n\n` +
    `👇 Opponent — tap <b>Join</b> and pick your team!`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

// Handle guest join for IPL mode
bot.callbackQuery('cipl_join', async (ctx) => {
  const chatId = ctx.chat.id;
  const user   = ctx.from;
  const lobby  = activeLobbies[chatId];

  if (!lobby || !lobby.iplMode) {
    return ctx.answerCallbackQuery({ text: '❌ No IPL lobby to join.', show_alert: true });
  }
  if (user.id === lobby.host.telegramId) {
    return ctx.answerCallbackQuery({ text: '⚠️ You cannot join your own lobby!', show_alert: true });
  }
  if (lobby.guest) {
    return ctx.answerCallbackQuery({ text: '⚠️ Lobby is already full!', show_alert: true });
  }
  if (matchManager.getActiveMatch(user.id) || getUserActiveLobby(user.id)) {
    return ctx.answerCallbackQuery({ text: '⚠️ You already have an active match!', show_alert: true });
  }

  await ctx.answerCallbackQuery();

  // Show team picker to guest (exclude host's team to force unique teams)
  const takenTeam = lobby.host.teamCode;
  const teams = Object.keys(IPL_SQUADS_POOL).filter(t => t !== takenTeam);
  const kb = new InlineKeyboard();
  for (let i = 0; i < teams.length; i += 2) {
    const row = [teams[i], teams[i + 1]].filter(Boolean);
    kb.row(...row.map(t => ({ text: t, callback_data: `cipl_guest_team:${t}` })));
  }

  const username = user.username || user.first_name || 'Guest';
  await ctx.reply(
    `🏆 @${escapeHTML(username)} is joining the IPL lobby!\n\n` +
    `👇 Pick <b>your team:</b>`,
    { parse_mode: 'HTML', reply_markup: kb }
  );
});

// Handle guest team pick — finalise lobby and do toss
bot.callbackQuery(/^cipl_guest_team:/, async (ctx) => {
  const teamCode = ctx.callbackQuery.data.split(':')[1];
  const chatId   = ctx.chat.id;
  const user     = ctx.from;
  const lobby    = activeLobbies[chatId];

  if (!lobby || !lobby.iplMode) {
    return ctx.answerCallbackQuery({ text: '❌ No active IPL lobby.', show_alert: true });
  }
  if (user.id === lobby.host.telegramId) {
    return ctx.answerCallbackQuery({ text: '⚠️ You are the host!', show_alert: true });
  }

  const pool = IPL_SQUADS_POOL[teamCode];
  if (!pool) return ctx.answerCallbackQuery({ text: '❌ Invalid team.', show_alert: true });

  await ctx.answerCallbackQuery();

  const username = user.username || user.first_name || 'Guest';
  const teamName = IPL_TEAM_NAMES[teamCode] || teamCode;

  if (sb.supabase) await sb.ensureUser(user.id, user.first_name).catch(() => {});

  lobby.guest = {
    telegramId: user.id,
    username,
    teamName,
    teamCode,
    squad: pool,
    xi:    []
  };
  lobby.status = 'waiting_overs';

  try { await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } }); } catch (_) {}

  await ctx.reply(
    `🤝 <b>@${escapeHTML(username)} joined the IPL lobby!</b>\n` +
    `═══════════════════════════════\n` +
    `• <b>${lobby.host.teamCode}</b> (${escapeHTML(lobby.host.teamName)}) → @${escapeHTML(lobby.host.username)}\n` +
    `• <b>${teamCode}</b> (${escapeHTML(teamName)}) → @${escapeHTML(username)}\n\n` +
    `👉 @${escapeHTML(lobby.host.username)}, please reply to this chat with the number of overs for this match (e.g. 1, 5, 10):`,
    { parse_mode: 'HTML' }
  );
});

async function resolveCricketPlayer(ctx, query) {
  if (!sb.supabase) {
    await ctx.reply("❌ Database stats are currently disabled.", { parse_mode: 'HTML' });
    return null;
  }
  
  if (!query) {
    return null;
  }

  try {
    const cricketFromDb = await sb.getCricketPlayers();
    if (!cricketFromDb || cricketFromDb.length === 0) {
      await ctx.reply("❌ No players found in the database.", { parse_mode: 'HTML' });
      return null;
    }

    const matches = cricketFromDb.filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    if (matches.length === 0) {
      await ctx.reply(`❌ No player matches your search for "<b>${escapeHTML(query)}</b>".`, { parse_mode: 'HTML' });
      return null;
    }

    if (matches.length > 1) {
      const exactMatch = matches.find(p => p.name.toLowerCase() === query.toLowerCase());
      if (exactMatch) {
        return exactMatch;
      } else {
        const list = matches.slice(0, 10).map(p => `• <b>${escapeHTML(p.name)}</b> (OVR: ${p.ovr})`).join('\n');
        const truncated = matches.length > 10 ? `\n...and ${matches.length - 10} more.` : '';
        await ctx.reply(
          `🔍 <b>Multiple players found matching "${escapeHTML(query)}":</b>\n\n${list}${truncated}\n\n` +
          `<i>Please specify a more precise name.</i>`,
          { parse_mode: 'HTML' }
        );
        return null;
      }
    }

    return matches[0];
  } catch (error) {
    console.error("Error resolving player name:", error);
    await ctx.reply("❌ An error occurred while searching for the player.", { parse_mode: 'HTML' });
    return null;
  }
}

bot.command('cs', async (ctx) => {
  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply("❌ Usage: <code>/cs &lt;player name&gt;</code>\nExample: <code>/cs Virat Kohli</code>", { parse_mode: 'HTML' });
  }

  const player = await resolvePlayerForUser(ctx, ctx.from.id, query);
  if (!player) return;

  const completedMatches = await sb.getAllCompletedMatches();
  
  let matchesPlayed = 0;
  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let dismissals = 0;
  let highestScore = { runs: 0, isOut: true };
  
  let runsConceded = 0;
  let wickets = 0;
  let ballsBowled = 0;
  let bestBowling = { wickets: 0, runsConceded: Infinity };

  const cleanPlayerId = (pid) => pid.replace(/^(host_|guest_)+/, '');

  completedMatches.forEach(match => {
    const state = match.state_json;
    if (!state) return;

    let foundInXI = null;
    if (state.host && state.host.xi) {
      foundInXI = state.host.xi.find(p => cleanPlayerId(p.id) === player.id || p.name.toLowerCase() === player.name.toLowerCase());
    }
    if (!foundInXI && state.guest && state.guest.xi) {
      foundInXI = state.guest.xi.find(p => cleanPlayerId(p.id) === player.id || p.name.toLowerCase() === player.name.toLowerCase());
    }

    if (foundInXI && state.stats) {
      matchesPlayed++;
      const pStats = state.stats[foundInXI.id];
      if (pStats) {
        const currentRuns = pStats.runs || 0;
        const currentBalls = pStats.balls || 0;
        const currentFours = pStats.fours || 0;
        const currentSixes = pStats.sixes || 0;
        const isOut = !!pStats.isOut;

        runs += currentRuns;
        balls += currentBalls;
        fours += currentFours;
        sixes += currentSixes;
        if (isOut) dismissals++;

        if (currentRuns > highestScore.runs) {
          highestScore = { runs: currentRuns, isOut };
        } else if (currentRuns === highestScore.runs && !isOut && highestScore.isOut) {
          highestScore = { runs: currentRuns, isOut };
        }

        const currentWickets = pStats.wickets || 0;
        const currentRunsConceded = pStats.runsConceded || 0;
        const oversVal = pStats.overs || 0;
        const oversInt = Math.floor(oversVal);
        const ballsFraction = Math.round((oversVal % 1) * 10);
        const matchBallsBowled = (oversInt * 6) + ballsFraction;

        runsConceded += currentRunsConceded;
        wickets += currentWickets;
        ballsBowled += matchBallsBowled;

        if (matchBallsBowled > 0 || currentRunsConceded > 0 || currentWickets > 0) {
          if (currentWickets > bestBowling.wickets) {
            bestBowling = { wickets: currentWickets, runsConceded: currentRunsConceded };
          } else if (currentWickets === bestBowling.wickets && currentRunsConceded < bestBowling.runsConceded) {
            bestBowling = { wickets: currentWickets, runsConceded: currentRunsConceded };
          }
        }
      }
    }
  });

  const battingAvg = dismissals > 0 ? (runs / dismissals).toFixed(2) : (runs > 0 ? `${runs}*` : '0.00');
  const battingSR = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';
  const highestScoreStr = highestScore.runs > 0 ? `${highestScore.runs}${highestScore.isOut ? '' : '*'}` : '0';

  const oversBowled = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`;
  const bowlingAvg = wickets > 0 ? (runsConceded / wickets).toFixed(2) : 'N/A';
  const bowlingEcon = ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6).toFixed(2) : '0.00';
  const bestBowlingStr = bestBowling.runsConceded !== Infinity ? `${bestBowling.wickets}/${bestBowling.runsConceded}` : 'N/A';

  const roleIcon = (role) => {
    if (role === 'batsman') return '🏏';
    if (role === 'wicket_keeper') return '🧤';
    if (role === 'all_rounder') return '⚡';
    if (role === 'bowler') return '🥎';
    return '👤';
  };

  const formattedPrice = player.buy_price ? player.buy_price.toLocaleString() : 'N/A';
  const tierIcon = player.tier === 'Legendary' ? ' 💎' : player.tier === 'Gold' ? ' ⭐' : '';

  let message = `🌎 <b>GLOBAL PLAYER STATS</b> 🌎\n` +
                `═════════════════════════════\n` +
                `👤 <b>Name:</b> <b>${escapeHTML(player.name)}</b>${tierIcon}\n` +
                `📊 <b>OVR:</b> <code>${player.ovr}</code>\n` +
                `🏷️ <b>Role:</b> ${roleIcon(player.role)} ${player.role ? player.role.toUpperCase().replace('_', ' ') : 'N/A'}\n` +
                `🏳️ <b>Country:</b> ${escapeHTML(player.country || 'N/A')}\n` +
                `💰 <b>Buy Price:</b> 💰 ${formattedPrice} coins\n`;

  if (player.batting_archetype) {
    message += `🏏 <b>Batting Archetype:</b> ${escapeHTML(player.batting_archetype)}\n`;
  }
  if (player.bowling_archetype) {
    message += `🥎 <b>Bowling Archetype:</b> ${escapeHTML(player.bowling_archetype)}\n`;
  }
  if (player.bowler_type) {
    message += `⚙️ <b>Bowler Type:</b> ${escapeHTML(player.bowler_type.toUpperCase().replace('_', ' '))}\n`;
  }

  message += `═════════════════════════════\n` +
             `🎮 <b>Global Matches Played:</b> <code>${matchesPlayed}</code>\n\n` +
             `🏏 <b>BATTING STATS:</b>\n` +
             `• <b>Runs:</b> <code>${runs}</code>\n` +
             `• <b>Balls Faced:</b> <code>${balls}</code>\n` +
             `• <b>Average:</b> <code>${battingAvg}</code>\n` +
             `• <b>Strike Rate:</b> <code>${battingSR}</code>\n` +
             `• <b>Highest Score:</b> <code>${highestScoreStr}</code>\n` +
             `• <b>Boundaries:</b> 4s: <code>${fours}</code> | 6s: <code>${sixes}</code>\n\n` +
             `🥎 <b>BOWLING STATS:</b>\n` +
             `• <b>Overs Bowled:</b> <code>${oversBowled}</code>\n` +
             `• <b>Wickets:</b> <code>${wickets}</code>\n` +
             `• <b>Runs Conceded:</b> <code>${runsConceded}</code>\n` +
             `• <b>Economy:</b> <code>${bowlingEcon}</code>\n` +
             `• <b>Average:</b> <code>${bowlingAvg}</code>\n` +
             `• <b>Best Figures:</b> <code>${bestBowlingStr}</code>\n` +
             `═════════════════════════════`;

  await sendPlayerCard(ctx, player, { caption: message, parse_mode: 'HTML' });
});

bot.command('ps', async (ctx) => {
  const query = ctx.match?.trim();
  if (!query) {
    return ctx.reply("❌ Usage: <code>/ps &lt;player name&gt;</code>\nExample: <code>/ps Virat Kohli</code>", { parse_mode: 'HTML' });
  }

  const targetUserId = ctx.message.reply_to_message?.from?.id || ctx.from.id;
  const targetFirstName = ctx.message.reply_to_message?.from?.first_name || ctx.from.first_name || "User";

  const player = await resolvePlayerForUser(ctx, targetUserId, query);
  if (!player) return;

  if (sb.supabase) {
    await sb.ensureUser(targetUserId, targetFirstName).catch(() => {});
  }

  const userMatches = await sb.getAllUserCompletedMatches(targetUserId);

  let matchesPlayed = 0;
  let runs = 0;
  let balls = 0;
  let fours = 0;
  let sixes = 0;
  let dismissals = 0;
  let highestScore = { runs: 0, isOut: true };
  
  let runsConceded = 0;
  let wickets = 0;
  let ballsBowled = 0;
  let bestBowling = { wickets: 0, runsConceded: Infinity };

  const cleanPlayerId = (pid) => pid.replace(/^(host_|guest_)+/, '');

  userMatches.forEach(match => {
    const state = match.state_json;
    if (!state) return;

    const isHost = match.host_id.toString() === targetUserId.toString();
    const isGuest = match.guest_id && match.guest_id.toString() === targetUserId.toString();

    let foundInXI = null;
    if (isHost && state.host && state.host.xi) {
      foundInXI = state.host.xi.find(p => cleanPlayerId(p.id) === player.id || p.name.toLowerCase() === player.name.toLowerCase());
    } else if (isGuest && state.guest && state.guest.xi) {
      foundInXI = state.guest.xi.find(p => cleanPlayerId(p.id) === player.id || p.name.toLowerCase() === player.name.toLowerCase());
    }

    if (foundInXI && state.stats) {
      matchesPlayed++;
      const pStats = state.stats[foundInXI.id];
      if (pStats) {
        const currentRuns = pStats.runs || 0;
        const currentBalls = pStats.balls || 0;
        const currentFours = pStats.fours || 0;
        const currentSixes = pStats.sixes || 0;
        const isOut = !!pStats.isOut;

        runs += currentRuns;
        balls += currentBalls;
        fours += currentFours;
        sixes += currentSixes;
        if (isOut) dismissals++;

        if (currentRuns > highestScore.runs) {
          highestScore = { runs: currentRuns, isOut };
        } else if (currentRuns === highestScore.runs && !isOut && highestScore.isOut) {
          highestScore = { runs: currentRuns, isOut };
        }

        const currentWickets = pStats.wickets || 0;
        const currentRunsConceded = pStats.runsConceded || 0;
        const oversVal = pStats.overs || 0;
        const oversInt = Math.floor(oversVal);
        const ballsFraction = Math.round((oversVal % 1) * 10);
        const matchBallsBowled = (oversInt * 6) + ballsFraction;

        runsConceded += currentRunsConceded;
        wickets += currentWickets;
        ballsBowled += matchBallsBowled;

        if (matchBallsBowled > 0 || currentRunsConceded > 0 || currentWickets > 0) {
          if (currentWickets > bestBowling.wickets) {
            bestBowling = { wickets: currentWickets, runsConceded: currentRunsConceded };
          } else if (currentWickets === bestBowling.wickets && currentRunsConceded < bestBowling.runsConceded) {
            bestBowling = { wickets: currentWickets, runsConceded: currentRunsConceded };
          }
        }
      }
    }
  });

  const profile = await sb.getProfile(targetUserId);
  const teamName = profile?.team_name ? `"${profile.team_name}"` : `${targetFirstName}'s XI`;

  if (matchesPlayed === 0) {
    const emptyMsg = `🏏 <b>${escapeHTML(player.name)}</b> hasn't played any matches for <b>${escapeHTML(teamName)}</b> yet!`;
    return await sendPlayerCard(ctx, player, { caption: emptyMsg, parse_mode: 'HTML' });
  }

  const battingAvg = dismissals > 0 ? (runs / dismissals).toFixed(2) : (runs > 0 ? `${runs}*` : '0.00');
  const battingSR = balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00';
  const highestScoreStr = highestScore.runs > 0 ? `${highestScore.runs}${highestScore.isOut ? '' : '*'}` : '0';

  const oversBowled = `${Math.floor(ballsBowled / 6)}.${ballsBowled % 6}`;
  const bowlingAvg = wickets > 0 ? (runsConceded / wickets).toFixed(2) : 'N/A';
  const bowlingEcon = ballsBowled > 0 ? ((runsConceded / ballsBowled) * 6).toFixed(2) : '0.00';
  const bestBowlingStr = bestBowling.runsConceded !== Infinity ? `${bestBowling.wickets}/${bestBowling.runsConceded}` : 'N/A';

  const roleIcon = (role) => {
    if (role === 'batsman') return '🏏';
    if (role === 'wicket_keeper') return '🧤';
    if (role === 'all_rounder') return '⚡';
    if (role === 'bowler') return '🥎';
    return '👤';
  };

  const tierIcon = player.tier === 'Legendary' ? ' 💎' : player.tier === 'Gold' ? ' ⭐' : '';

  const message = `🏏 <b>PLAYER TEAM STATS</b> 🏏\n` +
                  `═════════════════════════════\n` +
                  `👤 <b>Name:</b> <b>${escapeHTML(player.name)}</b>${tierIcon}\n` +
                  `👥 <b>Team:</b> <b>${escapeHTML(teamName)}</b> (Owner: <a href="tg://user?id=${targetUserId}">${escapeHTML(targetFirstName)}</a>)\n` +
                  `🏷️ <b>Role:</b> ${roleIcon(player.role)} ${player.role ? player.role.toUpperCase().replace('_', ' ') : 'N/A'}\n` +
                  `═════════════════════════════\n` +
                  `🎮 <b>Matches Played:</b> <code>${matchesPlayed}</code>\n\n` +
                  `🏏 <b>BATTING STATS:</b>\n` +
                  `• <b>Runs:</b> <code>${runs}</code>\n` +
                  `• <b>Balls Faced:</b> <code>${balls}</code>\n` +
                  `• <b>Average:</b> <code>${battingAvg}</code>\n` +
                  `• <b>Strike Rate:</b> <code>${battingSR}</code>\n` +
                  `• <b>Highest Score:</b> <code>${highestScoreStr}</code>\n` +
                  `• <b>Boundaries:</b> 4s: <code>${fours}</code> | 6s: <code>${sixes}</code>\n\n` +
                  `🥎 <b>BOWLING STATS:</b>\n` +
                  `• <b>Overs Bowled:</b> <code>${oversBowled}</code>\n` +
                  `• <b>Wickets:</b> <code>${wickets}</code>\n` +
                  `• <b>Runs Conceded:</b> <code>${runsConceded}</code>\n` +
                  `• <b>Economy:</b> <code>${bowlingEcon}</code>\n` +
                  `• <b>Average:</b> <code>${bowlingAvg}</code>\n` +
                  `• <b>Best Figures:</b> <code>${bestBowlingStr}</code>\n` +
                  `═════════════════════════════`;

  await sendPlayerCard(ctx, player, { caption: message, parse_mode: 'HTML' });
});

bot.command('addplayer', async (ctx) => {
  const isMod = await sb.checkIsModerator(ctx.from.id);
  const isAdmin = ADMIN_IDS.includes(ctx.from.id);
  if (!isAdmin && !isMod) return;

  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");

  let targetUserId = null;
  let targetFirstName = "User";
  let playerQuery = "";

  if (ctx.message.reply_to_message) {
    targetUserId = ctx.message.reply_to_message.from.id;
    targetFirstName = ctx.message.reply_to_message.from.first_name || "User";
    playerQuery = ctx.match?.trim() || "";
  } else {
    const args = ctx.match ? ctx.match.trim().split(/\s+/) : [];
    if (args.length < 2) {
      return ctx.reply("❌ <b>Usage:</b> Reply to a user with <code>/addplayer &lt;player name&gt;</code> or use <code>/addplayer &lt;userId&gt; &lt;player name&gt;</code>", { parse_mode: 'HTML' });
    }
    targetUserId = parseInt(args[0]);
    if (isNaN(targetUserId)) {
      return ctx.reply("❌ Invalid User ID specified.");
    }
    playerQuery = args.slice(1).join(" ");
  }

  if (!playerQuery) {
    return ctx.reply("❌ Please specify a player name.");
  }

  const player = await resolveCricketPlayer(ctx, playerQuery);
  if (!player) return;

  await sb.ensureUser(targetUserId, targetFirstName).catch(() => {});

  try {
    const result = await sb.awardPlayer(targetUserId, player.id, 'cricket');
    if (result.success) {
      if (result.alreadyOwned) {
        await ctx.reply(`⚠️ User <a href="tg://user?id=${targetUserId}"><b>${escapeHTML(targetFirstName)}</b></a> already owns <b>${escapeHTML(player.name)}</b>.`, { parse_mode: 'HTML' });
      } else {
        await ctx.reply(`✅ Successfully added <b>${escapeHTML(player.name)}</b> (OVR: ${player.ovr}) to <a href="tg://user?id=${targetUserId}"><b>${escapeHTML(targetFirstName)}</b></a>'s team!`, { parse_mode: 'HTML' });
        await notifySuperAdmins(ctx, 'Add Player', `Added player <b>${escapeHTML(player.name)}</b> to User ID <code>${targetUserId}</code>.`);
      }
    } else {
      await ctx.reply(`❌ Failed to add player: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in /addplayer:", error);
    await ctx.reply("❌ An error occurred while adding the player.");
  }
});

bot.command('removeplayer', async (ctx) => {
  const isMod = await sb.checkIsModerator(ctx.from.id);
  const isAdmin = ADMIN_IDS.includes(ctx.from.id);
  if (!isAdmin && !isMod) return;

  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");

  let targetUserId = null;
  let targetFirstName = "User";
  let playerQuery = "";

  if (ctx.message.reply_to_message) {
    targetUserId = ctx.message.reply_to_message.from.id;
    targetFirstName = ctx.message.reply_to_message.from.first_name || "User";
    playerQuery = ctx.match?.trim() || "";
  } else {
    const args = ctx.match ? ctx.match.trim().split(/\s+/) : [];
    if (args.length < 2) {
      return ctx.reply("❌ <b>Usage:</b> Reply to a user with <code>/removeplayer &lt;player name&gt;</code> or use <code>/removeplayer &lt;userId&gt; &lt;player name&gt;</code>", { parse_mode: 'HTML' });
    }
    targetUserId = parseInt(args[0]);
    if (isNaN(targetUserId)) {
      return ctx.reply("❌ Invalid User ID specified.");
    }
    playerQuery = args.slice(1).join(" ");
  }

  if (!playerQuery) {
    return ctx.reply("❌ Please specify a player name.");
  }

  const player = await resolveCricketPlayer(ctx, playerQuery);
  if (!player) return;

  await sb.ensureUser(targetUserId, targetFirstName).catch(() => {});

  try {
    const result = await sb.removePlayerFromSquad(targetUserId, player.id, 'cricket');
    if (result.success) {
      await ctx.reply(`✅ Successfully removed <b>${escapeHTML(player.name)}</b> from <a href="tg://user?id=${targetUserId}"><b>${escapeHTML(targetFirstName)}</b></a>'s team!`, { parse_mode: 'HTML' });
      await notifySuperAdmins(ctx, 'Remove Player', `Removed player <b>${escapeHTML(player.name)}</b> from User ID <code>${targetUserId}</code>.`);
    } else {
      await ctx.reply(`❌ Failed to remove player: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error in /removeplayer:", error);
    await ctx.reply("❌ An error occurred while removing the player.");
  }
});

bot.command('history', async (ctx) => {
  const telegramId = ctx.from.id;
  
  if (!sb.supabase) {
    return ctx.reply("Database is currently disabled.");
  }

  try {
    const userMatches = await sb.getUserCricketMatchHistory(telegramId);

    if (!userMatches || userMatches.length === 0) {
      return ctx.reply("📜 <b>Match History</b>\n\nNo matches found in your history yet! Start playing using `/cric`.", { parse_mode: 'HTML' });
    }

    let text = `📜 <b>Match History (Last ${userMatches.length} Games)</b>\n`;
    text += `═════════════════════════════\n\n`;

    const inlineKeyboard = new InlineKeyboard();

    let hostStr = process.env.WEBAPP_URL || process.env.RENDER_EXTERNAL_HOSTNAME || 'undercover-fuxy.onrender.com';
    const cleanHost = hostStr.replace(/^https?:\/\//, '');

    userMatches.forEach((row, idx) => {
      const m = row.state_json;
      if (!m) return;
      
      const isHost = m.host.telegramId.toString() === telegramId.toString();
      const opponentName = isHost ? (m.guest ? m.guest.username : 'AI Bot') : m.host.username;
      
      // Find scores
      const hostInn = m.innings.find(i => i.battingId === m.host.telegramId) || { runs: 0, wickets: 0 };
      const guestInn = m.guest ? (m.innings.find(i => i.battingId === m.guest.telegramId) || { runs: 0, wickets: 0 }) : { runs: 0, wickets: 0 };

      const hostScore = `${hostInn.runs}/${hostInn.wickets}`;
      const guestScore = `${guestInn.runs}/${guestInn.wickets}`;

      let resultText = "Tie";
      const inn1 = m.innings[0];
      const inn2 = m.innings[1];
      let matchWinner = null;

      if (inn2.runs >= inn2.target) {
        matchWinner = inn2.battingId === m.host.telegramId ? m.host : m.guest;
      } else if (inn2.runs < inn1.runs) {
        matchWinner = inn1.battingId === m.host.telegramId ? m.host : m.guest;
      }

      if (matchWinner) {
        const isWinner = matchWinner.telegramId.toString() === telegramId.toString();
        resultText = isWinner ? "🟢 Win" : "🔴 Loss";
      }

      const matchSummary = `${idx + 1}. vs ${opponentName} [${resultText}]`;
      const scoreSummary = `Host: ${hostScore} | Guest: ${guestScore}`;
      text += `👉 <b>${matchSummary}</b>\n   <code>${scoreSummary}</code>\n\n`;

      const playUrl = `https://${cleanHost}/cricket?match_id=${m.id}&chat_id=${m.chatId}`;
      const isPrivate = ctx.chat?.type === 'private';
      if (isPrivate) {
        inlineKeyboard.webApp(`↗️ View Match ${idx + 1}`, playUrl);
      } else {
        const botUsername = ctx.me?.username || botInfo?.username || 'Imposter0_bot';
        const directLink = `https://t.me/${botUsername}/bonus?startapp=cricket_${m.id}_${m.chatId}`;
        inlineKeyboard.url(`↗️ View Match ${idx + 1}`, directLink);
      }
      inlineKeyboard.row();
    });

    await ctx.reply(text, { parse_mode: 'HTML', reply_markup: inlineKeyboard });
  } catch (err) {
    console.error("Failed to load match history:", err);
    ctx.reply("❌ Failed to retrieve match history: " + err.message);
  }
});

bot.command('setteamname', async (ctx) => {
  if (!sb.supabase) {
    return ctx.reply("Database is currently disabled.");
  }

  const telegramId = ctx.from.id;
  const match = ctx.message.text.match(/^\/setteamname\s+(.+)$/i);
  
  if (!match) {
    return ctx.reply("❌ <b>Usage:</b> <code>/setteamname &lt;your_team_name&gt;</code>\nExample: <code>/setteamname Mumbai Indians</code>", { parse_mode: 'HTML' });
  }

  let teamName = match[1].trim();

  if (teamName.length < 2 || teamName.length > 25) {
    return ctx.reply("⚠️ Team name must be between 2 and 25 characters long.");
  }

  try {
    await sb.ensureUser(telegramId, ctx.from.first_name).catch(() => {});
    const res = await sb.updateCricketTeamName(telegramId, teamName);
    if (res.success) {
      await ctx.reply(`✅ Your cricket team name has been set to: <b>${escapeHTML(teamName)}</b>`, { parse_mode: 'HTML' });
    } else {
      await ctx.reply(`❌ Failed to update team name: ${res.error}`);
    }
  } catch (err) {
    console.error("Set team name error:", err);
    ctx.reply("❌ An error occurred while setting your team name.");
  }
});

bot.command('hilo', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database disabled.");
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  const betStr = args[1];
  
  if (!betStr || isNaN(betStr) || parseInt(betStr) <= 0) {
      return ctx.reply("❌ Usage: /hilo <bet_amount>\nExample: /hilo 100");
  }
  const bet = parseInt(betStr);
  
  const profile = await sb.getProfile(userId);
  if (!profile || (profile.coins || 0) < bet) {
      return ctx.reply(`❌ You don't have enough coins! Balance: ${profile?.coins || 0}`);
  }
  
  if (await hiloManager.getGame(userId)) {
      return ctx.reply("❌ You already have an active High-Low game. Finish it first!");
  }
  
  const deduct = await sb.addCoins(userId, -bet);
  if (deduct === false) return ctx.reply("❌ Error processing bet. Please try again.");
  
  const state = hiloManager.createGame(userId, bet);
  const msg = await sendHiloMsg(ctx, state);
  state.messageId = msg.message_id;
});

const flyCooldowns = new Map();

bot.command('fly', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database disabled.");
    const userId = ctx.from.id;
    
    // Prevent spam clogging the telegram API limit
    const lastFly = flyCooldowns.get(userId);
    if (lastFly && Date.now() - lastFly < 4000) {
        return; // Silently ignore to avoid ratelimit
    }
    flyCooldowns.set(userId, Date.now());
    const args = ctx.message.text.split(' ');
    
    const betStr = args[1];
    const targetStr = args[2];
    
    if (!betStr || !targetStr || isNaN(betStr) || isNaN(targetStr)) {
        return ctx.reply("✈️ <b>Aviator</b>\n\nUsage: /fly &lt;bet&gt; &lt;target_multiplier&gt;\nExample: /fly 100 2.5", { parse_mode: 'HTML' });
    }
    
    const bet = parseInt(betStr);
    const target = parseFloat(targetStr);
    
    if (bet <= 0 || target < 1) {
        return ctx.reply("❌ Minimum bet is 1 and minimum multiplier is 1x.");
    }

    const profile = await sb.getProfile(userId);
    if (!profile || (profile.coins || 0) < bet) {
        return ctx.reply(`❌ Not enough coins! Balance: ${profile?.coins || 0}`);
    }

    // Deduct bet
    const deduct = await sb.addCoins(userId, -bet);
    if (deduct === false) return ctx.reply("❌ Error processing bet.");

    const result = crashManager.playAviator(bet, target);
    
    if (result.won) {
        await sb.addCoinsInternal(userId, result.payout);
        await ctx.reply(
            `🛫 <b>Plane reached ${result.crashPoint}x!</b>\n\n` +
            `✅ You WON <b>${result.payout}</b> coins!\n` +
            `💰 Target was ${target}x.`,
            { parse_mode: 'HTML' }
        );
    } else {
        await ctx.reply(
            `💥 <b>CRASHED at ${result.crashPoint}x!</b>\n\n` +
            `❌ You lost <b>${bet}</b> coins.\n` +
            `📉 You wanted ${target}x, but it failed.`,
            { parse_mode: 'HTML' }
        );
    }
});

bot.command('dice', async (ctx) => {
    if (!sb.supabase) return ctx.reply("Database disabled.");
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ');
    const betStr = args[1];

    if (!betStr || isNaN(betStr)) {
        return ctx.reply("🎲 <b>7 Up 7 Down Dice Game</b>\n\nUsage: /dice &lt;bet_amount&gt;\nExample: /dice 100", { parse_mode: 'HTML' });
    }

    const bet = parseInt(betStr);
    if (bet <= 0) {
        return ctx.reply("❌ Minimum bet is 1 coin.");
    }

    const profile = await sb.getProfile(userId);
    if (!profile || (profile.coins || 0) < bet) {
        return ctx.reply(`❌ Not enough coins! Balance: ${profile?.coins || 0}`);
    }

    const kb = new InlineKeyboard()
        .text("Below 7 (2x)", `dice_bet:below:${bet}:${userId}`)
        .text("Above 7 (2x)", `dice_bet:above:${bet}:${userId}`).row()
        .text("Exactly 7 (5x)", `dice_bet:exact:${bet}:${userId}`);

    await ctx.reply(
        `🎲 <b>7 Up 7 Down Dice Game</b>\n\n` +
        `Bet Amount: <b>${bet.toLocaleString()} coins</b>\n` +
        `Current Balance: <b>${(profile.coins || 0).toLocaleString()} coins</b>\n\n` +
        `Guess the total sum of 2 rolled dice:`,
        { parse_mode: 'HTML', reply_markup: kb }
    );
});

// --- BLACKJACK SYSTEM ---
const activeBJ = new Map();

function sendBJMsg(ctx, state, isEdit = false, chatId = null, msgId = null, extraMsg = '') {
  const playerScore = bjManager.calculateScore(state.playerHand);
  const dealerScore = bjManager.calculateScore(state.dealerHand);
  const isGameOver = state.status !== 'PLAYING';

  let text = `${extraMsg}🃏 <b>BLACKJACK</b> 🃏\n\n` +
             `💰 Bet: <b>${state.bet}</b>\n\n` +
             `👤 <b>Your Hand:</b> ${bjManager.renderHand(state.playerHand)} (<b>${playerScore}</b>)\n` +
             `🏦 <b>Dealer Hand:</b> ${bjManager.renderHand(state.dealerHand, !isGameOver)} (<b>${isGameOver ? dealerScore : '?'}</b>)\n\n`;

  if (state.status === 'WIN') {
    text += "🎊 <b>YOU WON!</b> 🎊";
  } else if (state.status === 'LOSS') {
    text += "💀 <b>YOU LOST!</b> 💀";
  } else if (state.status === 'PUSH') {
    text += "⚖️ <b>PUSH (DRAW)!</b> ⚖️";
  } else if (state.status === 'BUST') {
    text += "💥 <b>BUSTED! YOU LOST.</b> 💥";
  } else {
    text += "<i>What is your next move?</i>";
  }

  const kb = new InlineKeyboard();
  if (!isGameOver) {
    kb.text("➕ Hit", "bj_hit").text("✋ Stand", "bj_stand");
    if (state.playerHand.length === 2) kb.row().text("💰 Double", "bj_double");
  }

  if (isEdit) {
    return bot.api.editMessageText(chatId, msgId, text, { reply_markup: kb, parse_mode: 'HTML' }).catch(()=>{});
  }
  return ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
}

bot.command(['blackjack', 'deal'], async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database disabled.");
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ');
  const betStr = args[1];

  if (!betStr || isNaN(betStr) || parseInt(betStr) <= 0) {
    return ctx.reply("🃏 <b>Blackjack</b>\n\nUsage: /blackjack <bet>\nExample: /blackjack 500\nMaximum Bet: 1,00,000 coins", { parse_mode: 'HTML' });
  }
  const bet = parseInt(betStr);

  if (bet > 100000) {
    return ctx.reply("❌ The maximum bet limit for Blackjack is 1,00,000 coins.");
  }

  const profile = await sb.getProfile(userId);
  if (!profile || (profile.coins || 0) < bet) {
    return ctx.reply(`❌ Not enough coins! Balance: ${profile?.coins || 0}`);
  }

  if (activeBJ.has(userId)) {
    return ctx.reply("❌ You already have an active game! Finish it first.");
  }

  // Deduct bet
  const deduct = await sb.addCoins(userId, -bet);
  if (deduct === false) return ctx.reply("❌ Error processing bet.");

  let deck = bjManager.createDeck();
  let playerHand = [deck.pop(), deck.pop()];
  let dealerHand = [deck.pop(), deck.pop()];

  const shouldLose = Math.random() < 0.75; // 75% chance of forcing a loss

  if (shouldLose) {
    while (bjManager.calculateScore(playerHand) === 21) {
      deck = bjManager.createDeck();
      playerHand = [deck.pop(), deck.pop()];
      dealerHand = [deck.pop(), deck.pop()];
    }
  }

  const state = {
    userId,
    bet,
    deck,
    playerHand,
    dealerHand,
    status: 'PLAYING',
    shouldLose,
    chatId: ctx.chat.id
  };

  const pScore = bjManager.calculateScore(playerHand);
  if (pScore === 21) {
    state.status = 'WIN';
    const payout = Math.floor(bet * 2.5); // Blackjack payout 3:2
    await sb.addCoinsInternal(userId, payout);
    activeBJ.delete(userId);
    return sendBJMsg(ctx, state, false, null, null, "🃏 <b>NATURAL BLACKJACK!</b> 🔥 ");
  }

  const msg = await sendBJMsg(ctx, state);
  state.messageId = msg.message_id;
  activeBJ.set(userId, state);
});

function getPlayerHitCard(state) {
  const pScore = bjManager.calculateScore(state.playerHand);
  if (state.shouldLose && Math.random() < 0.8) {
    let targetIndices = [];
    for (let i = 0; i < state.deck.length; i++) {
      const tempHand = [...state.playerHand, state.deck[i]];
      const tempScore = bjManager.calculateScore(tempHand);
      if (pScore >= 12) {
        if (tempScore > 21) {
          targetIndices.push(i);
        }
      } else {
        if (tempScore >= 12 && tempScore <= 16) {
          targetIndices.push(i);
        }
      }
    }
    if (targetIndices.length > 0) {
      const idx = targetIndices[Math.floor(Math.random() * targetIndices.length)];
      return state.deck.splice(idx, 1)[0];
    }
  }
  return state.deck.pop();
}

async function handleBJStand(ctx, state) {
  // Dealer's Turn
  let dScore = bjManager.calculateScore(state.dealerHand);
  const pScore = bjManager.calculateScore(state.playerHand);

  while (dScore < 17 && state.deck.length > 0) {
    let cardIndex = -1;
    if (state.shouldLose) {
      // Find a card that gets dealer closest to pScore or 21 without busting
      let bestCardIdx = -1;
      let bestScore = -1;
      for (let i = 0; i < state.deck.length; i++) {
        const tempHand = [...state.dealerHand, state.deck[i]];
        const tempScore = bjManager.calculateScore(tempHand);
        if (tempScore <= 21) {
          if (tempScore > bestScore) {
            bestScore = tempScore;
            bestCardIdx = i;
          }
        }
      }
      if (bestCardIdx !== -1) {
        cardIndex = bestCardIdx;
      }
    }

    if (cardIndex !== -1) {
      state.dealerHand.push(state.deck.splice(cardIndex, 1)[0]);
    } else {
      state.dealerHand.push(state.deck.pop());
    }
    dScore = bjManager.calculateScore(state.dealerHand);
  }

  if (dScore > 21 || pScore > dScore) {
    state.status = 'WIN';
    await sb.addCoinsInternal(state.userId, state.bet * 2);
  } else if (dScore > pScore) {
    state.status = 'LOSS';
  } else {
    state.status = 'PUSH';
    await sb.addCoinsInternal(state.userId, state.bet);
  }

  activeBJ.delete(state.userId);
  await sendBJMsg(ctx, state, true, state.chatId, state.messageId);
}

bot.command('quit', async (ctx) => {
  const userId = ctx.from.id;

  // Check for Cricket match lobby
  const cricLobby = getUserActiveLobby(userId);
  if (cricLobby) {
      const chatId = cricLobby.chatId;
      delete activeLobbies[chatId];
      try {
          await bot.api.sendMessage(chatId, `🛑 <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a> has quit the cricket lobby. The lobby has been cancelled.`, { parse_mode: 'HTML' });
      } catch (e) {}
      return ctx.reply("✅ You quit the cricket match lobby. The lobby has been cancelled.");
  }

  // Check for Guess the Word game
  for (const [cid, gGame] of guessManager.getAllGames().entries()) {
      if (gGame.host && gGame.host.id === userId) {
          guessManager.endGame(cid);
          try {
              await bot.api.sendMessage(cid, `🛑 <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a> has quit. The Guess the Word game has been ended.`, { parse_mode: 'HTML' });
          } catch(e) {}
          return ctx.reply("✅ You quit the Guess the Word game.");
      }
  }

  const regularLobby = gameManager.getLobbyByUserId(userId);
  const mafiaLobby = mafiaManager.getLobbyByUserId(userId);
  
  if (regularLobby) {
      const chatId = regularLobby.chatId;
      if (regularLobby.state === 'LOBBY') {
          gameManager.leaveLobby(chatId, userId);
          await ctx.reply("✅ You have left the Undercover lobby.");
      } else {
          gameManager.deleteLobby(chatId);
          await bot.api.sendMessage(chatId, `🛑 <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a> has quit. The game has been cancelled.`, { parse_mode: 'HTML' });
          await ctx.reply("✅ You quit the match. The game was cancelled.");
      }
      return;
  } 
  
  if (mafiaLobby) {
      const chatId = mafiaLobby.chatId;
      if (mafiaLobby.state === 'LOBBY') {
          mafiaManager.leaveLobby(chatId, userId);
          await ctx.reply("✅ You have left the Mafia lobby.");
          const msgId = mafiaLobby.pinnedMessageId || mafiaLobby.joinMessageId;
          if (msgId) await updateMafiaLobbyMessage(chatId, mafiaLobby, msgId);
      } else {
          const { player, role } = mafiaManager.eliminatePlayer(chatId, userId);
          const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
          let msg = `🏳️ <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a> has <b>QUIT</b> the game!\n\nThey were a <b>${role}</b> ${RE[role]}.`;
          if (role === 'IMPOSTOR') msg += `\n🔑 Their word was: <tg-spoiler>${mafiaLobby.wordB}</tg-spoiler>`;
          
          await bot.api.sendMessage(chatId, msg, { parse_mode: 'HTML' });
          await ctx.reply("✅ You have quit the Mafia match.");
          
          const win = mafiaManager.checkWinCondition(chatId);
          if (win) await endMafiaGame(chatId, win);
      }
      return;
  }

  // Check for Game of Lies
  const liesLobby = liesManager.getLobbyByUserId(userId);
  if (liesLobby) {
      const chatId = liesLobby.chatId;
      const opponent = liesLobby.players.find(p => p.id !== userId);
      
      liesManager.deleteLobby(chatId);
      
      let msg = `🛑 <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a> has quit.`;
      if (opponent) {
          await sb.recordWin(opponent.id, opponent.first_name, chatId).catch(()=>{});
          msg += `\n🏆 <a href="tg://user?id=${opponent.id}">${escapeHTML(opponent.first_name)}</a> has been awarded the <b>WIN</b>!`;
      }
      
      await bot.api.sendMessage(chatId, msg, { parse_mode: 'HTML' });
      return ctx.reply("✅ You quit the quiz. Your opponent was awarded the win.");
  }

  // Check for Hilo (Quit = Withdraw)
  const hiloState = await hiloManager.getGame(userId);
  if (hiloState) {
      let payout = Math.floor(hiloState.betAmount * hiloState.multiplier);
      let penaltyMsg = '';
      if (hiloState.multiplier <= 1.0) {
          payout = Math.floor(hiloState.betAmount * 0.9);
          penaltyMsg = "\n⚠️ <i>Penalty applied for immediate withdrawal (0.9x).</i>";
      }
      
      hiloManager.endGame(userId);
      await sb.addCoinsInternal(userId, payout);
      
      await ctx.reply(`✅ You quit Hilo. Your current balance of <b>${payout}</b> coins has been withdrawn.${penaltyMsg}`, { parse_mode: 'HTML' });
      if (hiloState.messageId && hiloState.chatId) {
          bot.api.editMessageText(hiloState.chatId, hiloState.messageId, `💰 <b>Withdrawn via /quit!</b>\n\nYou walked away with ${payout} coins!${penaltyMsg}`, { parse_mode: 'HTML' }).catch(()=>{});
      }
      return;
  }

  // Check for Cricket match
  const cricMatch = matchManager.getActiveMatch(userId);
  if (cricMatch) {
      if (cricMatch.status === 'completed') {
          return ctx.reply("❌ Match has already completed.");
      }
      const ballsBowled = (cricMatch.innings[0]?.balls || 0) + (cricMatch.innings[1]?.balls || 0);
      let penalty = 0;
      if (ballsBowled > 0) {
          const totalBalls = cricMatch.totalOvers * 12;
          const ratio = Math.min(1, ballsBowled / totalBalls);
          penalty = Math.round(ratio * cricMatch.totalOvers * 1000);
      }

      let penaltyText = penalty > 0 ? `${penalty} coins penalty` : "No penalty";
      const keyboard = new InlineKeyboard()
          .text(`⚠️ Confirm Quit (${penalty > 0 ? `-${penalty} Coins` : 'No Penalty'})`, `cric_quit_confirm:${cricMatch.id}:${userId}`)
          .text(`❌ Cancel`, `cric_quit_cancel:${cricMatch.id}:${userId}`);

      await ctx.reply(
          `🚨 <b>Are you sure you want to quit the match?</b>\n\n` +
          `• Played: <b>${ballsBowled}</b> balls\n` +
          `• Penalty: <b>${penaltyText}</b>\n\n` +
          `<i>Opponent will receive compensation coins and the win.</i>`,
          { parse_mode: 'HTML', reply_markup: keyboard }
      );
      return;
  }

  return ctx.reply("You are not in any active game.");
});

// --- Admin Broadcast Commands ---

function convertTelegramToHtml(text, entities) {
    if (!entities || entities.length === 0) {
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    
    const startTags = Array.from({ length: text.length + 1 }, () => []);
    const endTags = Array.from({ length: text.length + 1 }, () => []);
    
    entities.forEach(ent => {
        let startTag = '';
        let endTag = '';
        switch (ent.type) {
            case 'bold':
                startTag = '<b>';
                endTag = '</b>';
                break;
            case 'italic':
                startTag = '<i>';
                endTag = '</i>';
                break;
            case 'underline':
                startTag = '<u>';
                endTag = '</u>';
                break;
            case 'strikethrough':
                startTag = '<s>';
                endTag = '</s>';
                break;
            case 'code':
                startTag = '<code>';
                endTag = '</code>';
                break;
            case 'pre':
                startTag = '<pre>';
                endTag = '</pre>';
                break;
            case 'text_link':
                startTag = `<a href="${ent.url}">`;
                endTag = '</a>';
                break;
            case 'spoiler':
                startTag = '<tg-spoiler>';
                endTag = '</tg-spoiler>';
                break;
            case 'blockquote':
                startTag = '<blockquote>';
                endTag = '</blockquote>';
                break;
        }
        if (startTag) {
            startTags[ent.offset].push({ tag: startTag, len: ent.length });
            endTags[ent.offset + ent.length].push({ tag: endTag, len: ent.length });
        }
    });
    
    let result = '';
    for (let i = 0; i <= text.length; i++) {
        const closing = endTags[i];
        if (closing && closing.length > 0) {
            closing.sort((a, b) => a.len - b.len);
            closing.forEach(c => result += c.tag);
        }
        
        const opening = startTags[i];
        if (opening && opening.length > 0) {
            opening.sort((a, b) => b.len - a.len);
            opening.forEach(o => result += o.tag);
        }
        
        if (i < text.length) {
            const char = text[i];
            if (char === '<') result += '&lt;';
            else if (char === '>') result += '&gt;';
            else if (char === '&') result += '&amp;';
            else result += char;
        }
    }
    
    return result;
}

let activeBroadcastCancel = false;  // Flag to cancel active broadcast

async function sendBroadcast(ctx, targetIds, messageText, replyMessageId, copyCurrentMessageWithCaption = null) {
    let success = 0;
    let failed = 0;
    const total = targetIds.length;
    
    // Clear last broadcast tracking in DB and reset cancel flag
    await sb.clearLastBroadcastMessages();
    activeBroadcastCancel = false;
    
    let statusMsg;
    try {
        statusMsg = await ctx.reply(`🚀 <b>Broadcast Started</b>\n\nTargeting ${total} chats. I will update this message with progress.`, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Failed to send initial broadcast status:", e);
        return;
    }
    
    for (let i = 0; i < total; i++) {
        // Check cancel flag
        if (activeBroadcastCancel) {
            try {
                await bot.api.sendMessage(ctx.chat.id, `🛑 <b>Broadcast Cancelled by Super Admin</b>\n\n✅ Success: ${success}\n❌ Failed: ${failed}`, { parse_mode: 'HTML' });
            } catch (e) {}
            // Reset flag
            activeBroadcastCancel = false;
            break;
        }

        const targetId = targetIds[i];
        try {
            let sentMsgId;
            if (replyMessageId) {
                // Using copyMessage perfectly preserves formatting, bold, quotes, links, and even photos/videos!
                const res = await bot.api.copyMessage(targetId, ctx.chat.id, replyMessageId);
                sentMsgId = res.message_id;
            } else if (copyCurrentMessageWithCaption) {
                // Copy the uploaded media message but override caption to strip command prefix
                const res = await bot.api.copyMessage(targetId, ctx.chat.id, copyCurrentMessageWithCaption, {
                    caption: messageText,
                    parse_mode: 'HTML'
                });
                sentMsgId = res.message_id;
            } else {
                // Standard text broadcast, no default "Announcement" prefix
                const res = await bot.api.sendMessage(targetId, messageText, { parse_mode: 'HTML' });
                sentMsgId = res.message_id;
            }
            
            if (sentMsgId) {
                await sb.saveBroadcastMessage(targetId, sentMsgId);
            }
            
            // Pin the message in both groups and private chats
            await bot.api.pinChatMessage(targetId, sentMsgId).catch(() => {});
            success++;
        } catch (e) {
            failed++;
        }
        
        // Update status UI every 10 messages or at the end (less frequent updates save API calls)
        if (i % 10 === 0 || i === total - 1) {
            try { 
                await bot.api.editMessageText(ctx.chat.id, statusMsg.message_id, 
                    `🚀 <b>Broadcasting...</b> (${i + 1}/${total})\n\n` +
                    `✅ Success: ${success}\n` +
                    `❌ Failed: ${failed}\n\n` +
                    `<i>Bot remains active for other users during this process.</i>`, 
                    { parse_mode: 'HTML' }
                ); 
            } catch (e) {}
        }
        
        // Small delay to avoid rate limits (100ms = 10 msgs/sec)
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Only send completion message if we didn't cancel early
    if (!activeBroadcastCancel) {
        try {
            await bot.api.sendMessage(ctx.chat.id, `🏁 <b>Broadcast Complete</b>\n\n✅ Success: ${success}\n❌ Failed: ${failed}`, { parse_mode: 'HTML' });
        } catch (e) {}
    }
}

bot.command('stopbroadcast', async (ctx) => {
  if (!SUPER_ADMIN_IDS.includes(ctx.from.id)) return;
  activeBroadcastCancel = true;
  await ctx.reply("⏳ <b>Signal sent to stop the active broadcast.</b>\nIt will cease on the next message iteration.", { parse_mode: 'HTML' });
});

bot.command(['revertbroadcast', 'deletebroadcast'], async (ctx) => {
  if (!SUPER_ADMIN_IDS.includes(ctx.from.id)) return;
  
  const messages = await sb.getLastBroadcastMessages();
  if (messages.length === 0) {
      return ctx.reply("❌ No broadcast messages in database to revert, or they have already been reverted.");
  }
  
  const total = messages.length;
  let success = 0;
  let failed = 0;
  
  const statusMsg = await ctx.reply(`🗑️ <b>Reverting last broadcast...</b>\n\nDeleting ${total} messages. Progress: 0/${total}`, { parse_mode: 'HTML' });
  
  for (let i = 0; i < total; i++) {
      const item = messages[i];
      try {
          // Unpin the message if possible first
          await bot.api.unpinChatMessage(item.chatId, item.messageId).catch(() => {});
          // Delete message
          await bot.api.deleteMessage(item.chatId, item.messageId);
          success++;
      } catch (e) {
          failed++;
      }
      
      if (i % 10 === 0 || i === total - 1) {
          try {
              await bot.api.editMessageText(ctx.chat.id, statusMsg.message_id,
                  `🗑️ <b>Reverting last broadcast...</b> (${i + 1}/${total})\n\n` +
                  `✅ Deleted: ${success}\n` +
                  `❌ Failed: ${failed}`,
                  { parse_mode: 'HTML' }
              );
          } catch (e) {}
      }
      
      // Delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // Clear the database tracking after reverting
  await sb.clearLastBroadcastMessages();
  
  await ctx.reply(`🏁 <b>Revert Complete</b>\n\n✅ Successfully deleted: ${success}\n❌ Failed/Skipped: ${failed}`, { parse_mode: 'HTML' });
});

bot.on(['message:text', 'message:caption'], async (ctx, next) => {
  const rawText = ctx.message.text || ctx.message.caption || '';
  if (!rawText.startsWith('/')) return next();
  
  const cmd = rawText.split(/\s+/)[0].replace('/', '').split('@')[0];
  if (!['broadcast', 'broadcast_groups', 'broadcast_users'].includes(cmd)) {
      return next();
  }
  
  if (!SUPER_ADMIN_IDS.includes(ctx.from.id)) return;
  
  const match = rawText.match(/^\/\S+\s*/);
  const offsetShift = match ? match[0].length : 0;
  const broadcastMsgText = rawText.slice(offsetShift);
  
  const isCaption = !ctx.message.text && ctx.message.caption;
  const rawEntities = isCaption ? ctx.message.caption_entities : ctx.message.entities;
  const adjustedEntities = [];
  if (rawEntities) {
      rawEntities.forEach(ent => {
          if (ent.offset + ent.length <= offsetShift) return;
          
          const newOffset = Math.max(0, ent.offset - offsetShift);
          const newLength = ent.offset >= offsetShift ? ent.length : ent.length - (offsetShift - ent.offset);
          if (newLength > 0) {
              adjustedEntities.push({
                  ...ent,
                  offset: newOffset,
                  length: newLength
              });
          }
      });
  }
  
  const broadcastMsg = convertTelegramToHtml(broadcastMsgText, adjustedEntities);
  const replyMsg = ctx.message.reply_to_message;
  
  if (!broadcastMsgText && !replyMsg && !isCaption) {
      return ctx.reply(`❌ Please provide a message.\n\n<b>Usage 1:</b> /${cmd} Hello world!\n<b>Usage 2:</b> Reply to ANY message (with bold, images, etc.) with /${cmd} to preserve exact formatting!\n<b>Usage 3:</b> Upload an image/media and write /${cmd} Your caption here!`, { parse_mode: 'HTML' });
  }
  
  let targetIds = [];
  if (cmd === 'broadcast' || cmd === 'broadcast_groups') {
      const groupIds = await sb.getAllGroupIds();
      targetIds.push(...groupIds);
  }
  if (cmd === 'broadcast' || cmd === 'broadcast_users') {
      const userIds = await sb.getAllUserIds();
      targetIds.push(...userIds);
  }
  
  // Unique IDs only
  targetIds = [...new Set(targetIds)];
  
  if (targetIds.length === 0) {
      return ctx.reply("❌ No target chats found in database.");
  }
  
  const copyCurrent = (isCaption && !replyMsg) ? ctx.message.message_id : null;
  sendBroadcast(ctx, targetIds, broadcastMsg, replyMsg ? replyMsg.message_id : null, copyCurrent)
      .catch(err => console.error("Broadcast Error:", err));
      
  await ctx.reply("✅ <b>Broadcast has been moved to background.</b>\n\nYou can continue using the bot while it sends messages.", { parse_mode: 'HTML' });
});

bot.command(['feedback', 'report'], async (ctx) => {
    const text = ctx.message.text.split(' ').slice(1).join(' ');
    if (!text) return ctx.reply("💬 <b>Feedback System</b>\n\nYou can send feedback or report bugs directly to the admin by typing:\n/feedback Your message here...", { parse_mode: 'HTML' });
    
    try {
        await bot.api.sendMessage(ADMIN_IDS[0], `🚨 <b>FEEDBACK RECEIVED</b>\n\nFrom: <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>\nGroup: ${escapeHTML(ctx.chat.title || 'Private')}\nMessage: ${escapeHTML(text)}`, { parse_mode: 'HTML' });
        await ctx.reply("✅ <b>Thank you!</b> Your feedback has been delivered to the admin.", { parse_mode: 'HTML' });
    } catch(e) {
        await ctx.reply("❌ Failed to send feedback. Please try again later.");
    }
});

// --- Player Utility Commands ---

bot.command('myword', async (ctx) => {
  const userId = ctx.from.id;
  const isPrivate = ctx.chat.type === 'private';
  
  let data = gameManager.getPlayerData(userId);
  let mode = 'standard';
  
  if (!data) {
      data = mafiaManager.getPlayerData(userId);
      mode = 'mafia';
  }

  if (!data) {
      return ctx.reply("❌ You are not currently in an active game or the game is still in the lobby phase.");
  }

  try {
      const maxW = data.maxWords || 1;
      const clueLabel = maxW === 1 ? 'exactly ONE word' : `up to ${maxW} words`;
      
      let msg = "";
      if (data.mode === 'standard') {
          msg = `🕵️‍♂️ <b>Undercover (Reminder)</b>\n\nTheme: <b>${data.theme}</b>\nYour Secret Word: <tg-spoiler>${data.word}</tg-spoiler>\n\nReply here with ${clueLabel} as your clue!`;
      } else {
          const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
          msg = `${RE[data.role]} <b>Mafia Round ${data.round} (Reminder)</b>\n\nTheme: <b>${data.theme}</b>\n`;
          if (data.role === 'JOKER') {
              msg += `🃏 <b>You are THE JOKER!</b>\nYou have no word. Your goal is to get voted out!\nReply here with ${clueLabel} as your fake clue.`;
          } else {
              msg += `Your Secret Word: <tg-spoiler>${data.word}</tg-spoiler>\n\nReply here with ${clueLabel} to describe your word.`;
          }
      }
      
      await bot.api.sendMessage(userId, msg, { parse_mode: 'HTML' });
      if (!isPrivate) {
          await ctx.reply(`✅ <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a>, I've re-sent your word to your DMs!`, { parse_mode: 'HTML' });
      } else {
          await ctx.reply("✅ Word re-sent!");
      }
  } catch (e) {
      if (!isPrivate) {
          await ctx.reply(`⚠️ <a href="tg://user?id=${userId}">${escapeHTML(ctx.from.first_name)}</a>, I couldn't DM you. Please make sure you have started the bot in private and haven't blocked me!`, { parse_mode: 'HTML' });
      } else {
          await ctx.reply("⚠️ I couldn't send the DM. Please check your privacy settings.");
      }
  }
});

bot.command('leaderboard', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply("Leaderboards are best viewed in group chats.");
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const user = ctx.from;
  const chatId = ctx.chat.id;
  const sortBy = 'rating';
  const isGlobal = true;

  const records = await sb.getGlobalLeaderboard(sortBy);
  
  let text = `🌍 <b>Global Top 10 — Rating</b> 🌍\n\n`;
  if (!records || records.length === 0) {
     text += "<i>No records found yet!</i>\n";
  } else {
     records.forEach((r, i) => {
        text += `${i+1}. <a href="tg://user?id=${r.user_id}"><b>${r.first_name || 'Player'}</b></a> - ${r.rating || 0} Rating 📈\n`;
     });
  }

  const userRank = await sb.getUserGlobalRank(user.id, sortBy);
  if (userRank !== null && userRank !== undefined) {
      text += `\n📌 <b>Your Position:</b> #${userRank}`;
  }

  const kb = new InlineKeyboard();
  kb.text("● Global", "lb_global_rating").text("Group", "lb_group_rating").row();
  kb.text("● Rating", "lb_global_rating").text("Wins", "lb_global_wins").text("Coins", "lb_global_coins");

  await ctx.reply(text, { reply_markup: kb, parse_mode: 'HTML' });
});

// --- Settings Command ---

function buildSettingsKeyboard(settings) {
  const kb = new InlineKeyboard();
  kb.text(`⏱️ Discussion: ${settings.discussion_time}s`, 'set_discussion').row();
  kb.text(`🗳️ Voting: ${settings.voting_time}s`, 'set_voting').row();
  kb.text(`🕵️ Impostor Guess: ${settings.impostor_guess_time}s`, 'set_impostor_guess').row();
  kb.text(`📝 Clue Words: ${settings.clue_words}`, 'set_clue_words').row();
  kb.text(`${settings.anonymous_voting ? '🔒' : '🔓'} Voting: ${settings.anonymous_voting ? 'Anonymous' : 'Public'}`, 'set_anon_vote').row();
  kb.text('🔄 Reset to Defaults', 'set_reset');
  return kb;
}

function buildSettingsText(settings) {
  return `⚙️ <b>Group Game Settings</b>\n\nThese settings apply to all games in this group.\n\n⏱️ <b>Discussion Time:</b> ${settings.discussion_time}s\n🗳️ <b>Voting Time:</b> ${settings.voting_time}s\n🕵️ <b>Impostor Guess Time:</b> ${settings.impostor_guess_time}s\n📝 <b>Clue Words Allowed:</b> ${settings.clue_words}\n${settings.anonymous_voting ? '🔒' : '🔓'} <b>Voting Mode:</b> ${settings.anonymous_voting ? 'Anonymous' : 'Public'}\n\n<i>Tap a button below to change a setting.</i>`;
}

bot.command('settings', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply("Settings can only be changed in group chats.");

  const member = await ctx.getChatMember(ctx.from.id);
  if (member.status !== 'administrator' && member.status !== 'creator') {
    return ctx.reply("⛔ Only group admins can change game settings.");
  }

  const settings = await sb.getGroupSettings(ctx.chat.id);
  await ctx.reply(buildSettingsText(settings), {
    reply_markup: buildSettingsKeyboard(settings),
    parse_mode: 'HTML'
  });
});

bot.command('play', async (ctx) => {
  ensureRegistered(ctx);
  if (ctx.chat.type === 'private') return ctx.reply("You can only play this game in a group chat.");
  
  try {
     await ctx.api.sendChatAction(ctx.from.id, 'typing');
  } catch (e) {
     return ctx.reply(`⚠️ <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>, you MUST start the bot in private messages first before hosting! Tap my profile picture, hit Start, and come back.`, { parse_mode: 'HTML' });
  }
  
  const chatId = ctx.chat.id;
  const creator = ctx.from;

  if (getActiveLobbyForUser(creator.id)) {
      return ctx.reply("❌ You are already in an active game or lobby! Use /quit first.");
  }
  
  if (gameManager.hasLobby(chatId) || mafiaManager.hasLobby(chatId)) return ctx.reply("A game is already ongoing or forming in this chat!");

  gameManager.createLobby(chatId, creator);
  
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "join_game")
    .text("❌ Leave", "leave_game")
    .row()
    .text("▶️ Start (Host only)", "start_game");
    
  const sentMsg = await ctx.reply(
    `🕵️‍♂️ <b>Undercover Lobby</b> 🕵️‍♂️\n\nHost: <a href="tg://user?id=${creator.id}">${escapeHTML(creator.first_name)}</a>\nPlayers joined: 1 (Minimum 3 required)\n\n1. <a href="tg://user?id=${creator.id}">${escapeHTML(creator.first_name)}</a>`, 
    { reply_markup: keyboard, parse_mode: 'HTML' }
  );
  
  const lobby = gameManager.getLobby(chatId);
  if (lobby) {
     try {
        await ctx.api.pinChatMessage(chatId, sentMsg.message_id, { disable_notification: true });
        lobby.pinnedMessageId = sentMsg.message_id;
     } catch (e) {
        // Ignored if bot is not an admin or lacks pin permissions
     }
  }
});

// --- Mafia Command ---

bot.command('mafia', async (ctx) => {
  ensureRegistered(ctx);
  if (ctx.chat.type === 'private') return ctx.reply("You can only play Mafia in a group chat.");
  try { await ctx.api.sendChatAction(ctx.from.id, 'typing'); }
  catch (e) { return ctx.reply(`⚠️ <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>, you MUST start the bot first!`, { parse_mode: 'HTML' }); }

  const chatId = ctx.chat.id;
  if (getActiveLobbyForUser(ctx.from.id)) {
      return ctx.reply("❌ You are already in an active game or lobby! Use /quit first.");
  }
  if (gameManager.hasLobby(chatId) || mafiaManager.hasLobby(chatId)) return ctx.reply("A game is already ongoing in this chat!");

  mafiaManager.createLobby(chatId, ctx.from);
  const dist = mafiaManager.getRoleDist(1);
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "maf_join").text("❌ Leave", "maf_leave").row()
    .text("▶️ Start (Host only)", "maf_start");

  const sentMsg = await ctx.reply(
    `🔫 <b>Mafia Lobby</b> 🔫\n\nHost: <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>\nPlayers: 1 (Minimum 3 required)\nRoles: ${dist.impostors} Impostor | ${dist.joker} Joker\n\n👤 Civilians don't know who the Impostors are\n🔫 Impostors don't know they're Impostors!\n🃏 Joker wins by getting voted out — game ends!\n\n1. <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>`,
    { reply_markup: keyboard, parse_mode: 'HTML' }
  );

  const lobby = mafiaManager.getLobby(chatId);
  if (lobby) {
    try { await ctx.api.pinChatMessage(chatId, sentMsg.message_id, { disable_notification: true }); lobby.pinnedMessageId = sentMsg.message_id; } catch(e) {}
  }
});

bot.command('liesrules', async (ctx) => {
    const text = `🤥 <b>Game of Lies: Rules & How to Play</b> 🤥\n\n` +
                 `1. Each match has 5 Cricket questions.\n` +
                 `2. For each question, you have 90 seconds to reply in DM.\n\n` +
                 `<b>Scoring:</b>\n` +
                 `✅ <b>Answer Correctly</b>: +1 Pt\n` +
                 `❌ <b>Wrong Answer</b>: 0 Pts (unless stolen)\n` +
                 `😈 <b>Type 'steal'</b>: \n` +
                 `   - If opponent gets it RIGHT: <b>You get +2</b>, they get 0.\n` +
                 `   - If opponent gets it WRONG (or they also steal): <b>You get -2</b>.\n\n` +
                 `Strategy is key! Do you play it safe, or bait your opponent into a steal?`;
    await ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('lies', async (ctx) => {
  ensureRegistered(ctx);
    if (ctx.chat.type === 'private') return ctx.reply("Please use this command in a group chat!");
    const chatId = ctx.chat.id;
    
    if (liesManager.hasLobby(chatId)) {
        return ctx.reply("🛑 A Game of Lies is already active in this group!");
    }

    const args = ctx.message.text.split(' ');
    let rounds = 5;
    if (args[1]) {
        const r = parseInt(args[1]);
        if (!isNaN(r) && r >= 1 && r <= 10) rounds = r;
    }

    const challengerId = ctx.message.reply_to_message?.from?.id || "";

    const kb = new InlineKeyboard();
    liesManager.getCategories().forEach(cat => {
        kb.text(cat, `lcat_${cat}_${rounds}_${challengerId}_${ctx.from.id}`).row();
    });

    await ctx.reply("🤔 <b>Game of Lies</b>\n\nChoose a category to start the game!", { reply_markup: kb, parse_mode: 'HTML' });
});

bot.callbackQuery(/^lcat_(.+)_(.+)_(.*)_(.*)$/, async (ctx) => {
    const category = ctx.match[1];
    const rounds = parseInt(ctx.match[2]);
    const challengerId = ctx.match[3] ? parseInt(ctx.match[3]) : null;
    const hostId = parseInt(ctx.match[4]);
    const chatId = ctx.chat.id;
    const user = ctx.from;

    if (user.id !== hostId) {
        return ctx.answerCallbackQuery({ text: "❌ Only the person who started /lies can choose!", show_alert: true });
    }

    if (liesManager.hasLobby(chatId)) {
        return ctx.answerCallbackQuery("🛑 A game is already active!");
    }

    let challenger = null;
    let challengerName = "Opponent";
    if (challengerId) {
        if (challengerId === user.id) return ctx.answerCallbackQuery("You can't challenge yourself!");
        
        try {
            const member = await ctx.api.getChatMember(chatId, challengerId);
            challengerName = member.user.first_name;
        } catch (e) {
            challengerName = "Player";
        }
        challenger = { id: challengerId, first_name: challengerName };
    }

    liesManager.createLobby(chatId, { id: user.id, first_name: user.first_name }, challenger, rounds, category);

    const kb = new InlineKeyboard()
        .text("🤝 Join & Accept", "lies_join")
        .text("❌ Decline", "lies_cancel");

    let text = `🤥 <b>Game of Lies Challenge!</b>\n\n` +
               `Category: <b>${escapeHTML(category)}</b>\n` +
               `Rounds: <b>${rounds}</b>\n` +
               `Host: <a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a>\n`;
    
    if (challengerId) {
        text += `\n<a href="tg://user?id=${challengerId}">${escapeHTML(challengerName)}</a>, you have been challenged! Accept below to start.`;
    } else {
        text += `\nWaiting for someone to accept the 1v1 battle...`;
    }

    await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
    await ctx.answerCallbackQuery();
});

bot.command(['guessword', 'gw'], async (ctx) => {
    ensureRegistered(ctx);
    if (ctx.chat.type === 'private') return ctx.reply("❌ Use this command in a group!");
    const chatId = ctx.chat.id;
    const user = ctx.from;

    if (getActiveLobbyForUser(user.id)) {
        return ctx.reply("❌ You are already in an active game or lobby! Use /quit first.");
    }

    if (gameManager.hasLobby(chatId) || mafiaManager.hasLobby(chatId) || liesManager.getLobby(chatId) || guessManager.getGame(chatId)) {
        return ctx.reply("❌ A game is already active in this chat!");
    }

    const game = guessManager.createGame(chatId, { id: user.id, first_name: user.first_name });
    
    const kb = new InlineKeyboard()
        .text("👁️ See Word", "guess_see")
        .text("⏭️ Next Word", "guess_next");

    await ctx.reply(
        `🎮 <b>Guess the Word!</b>\n\n` +
        `👤 <a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a> is the <b>Host</b>!\n\n` +
        `They are explaining a word. Everyone else, start guessing in the chat!`,
        { reply_markup: kb, parse_mode: 'HTML' }
    );
});



bot.on('message:text', async (ctx) => {
  if (ctx.chat.type !== 'private') {
    // 1. Check if there is an active cricket lobby waiting for overs input from the host
    const cricLobby = activeLobbies[ctx.chat.id];
    if (cricLobby && cricLobby.status === 'waiting_overs') {
      if (ctx.from.id.toString() === cricLobby.host.telegramId.toString()) {
        const text = ctx.message.text.trim();
        const parsedOvers = parseInt(text);
        if (!isNaN(parsedOvers) && parsedOvers >= 1 && parsedOvers <= 20) {
          cricLobby.overs = parsedOvers;
          
          if (cricLobby.iplMode) {
            cricLobby.status = 'ipl_team_picker';
            
            const teams = Object.keys(IPL_SQUADS_POOL);
            const kb = new InlineKeyboard();
            for (let i = 0; i < teams.length; i += 2) {
              const row = [teams[i], teams[i + 1]].filter(Boolean);
              kb.row(...row.map(t => ({ text: t, callback_data: `cipl_pick_team:${t}:${cricLobby.chatId}` })));
            }
            
            await ctx.reply(
              `🏆 <b>IPL 2026 MODE</b> 🏆\n` +
              `═══════════════════════════════\n` +
              `• Length: ${parsedOvers} Over(s)\n\n` +
              `👇 @${escapeHTML(cricLobby.host.username)} (Host), pick <b>your team</b>:`,
              { parse_mode: 'HTML', reply_markup: kb }
            );
            return;
          } else {
            cricLobby.status = 'toss_guess';
            
            const tossText = 
              `🪙 <b>TOSS TIME!</b> 🪙\n` +
              `═════════════════════════════\n` +
              `• <b>Length:</b> ${parsedOvers} Over(s)\n` +
              `• Host: @${escapeHTML(cricLobby.host.username)}\n` +
              `• Guest: @${escapeHTML(cricLobby.guest.username)}\n\n` +
              `👉 @${escapeHTML(cricLobby.guest.username)}, call the toss:`;

            const keyboard = new InlineKeyboard()
              .text('Heads 🪙', 'cric_toss_guess:heads')
              .text('Tails 🪙', 'cric_toss_guess:tails');
              
            await ctx.reply(tossText, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
          }
        } else {
          await ctx.reply(`⚠️ Invalid input. @${escapeHTML(cricLobby.host.username)}, please enter a valid number of overs (1-20):`);
          return;
        }
      }
    }

    // 2. Check if there is an active draft match waiting for overs input from the host
    const cricMatch = Object.values(matchManager.activeMatches).find(
      m => m.chatId.toString() === ctx.chat.id.toString() && m.status === 'waiting_overs'
    );
    if (cricMatch) {
      if (ctx.from.id.toString() === cricMatch.host.telegramId.toString()) {
        const text = ctx.message.text.trim();
        const parsedOvers = parseInt(text);
        if (!isNaN(parsedOvers) && parsedOvers >= 1 && parsedOvers <= 20) {
          cricMatch.totalOvers = parsedOvers;
          cricMatch.status = 'toss_guess';
          matchManager.saveToDb(cricMatch);
          
          const hostList = cricMatch.host.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');
          const guestList = cricMatch.guest.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');

          const summaryText = 
            `🎉 <b>DRAFT COMPLETE!</b> 🎉\n` +
            `═════════════════════════════\n` +
            `🟢 <b>@${escapeHTML(cricMatch.host.username)}'s XI:</b>\n` +
            `${escapeHTML(hostList)}\n\n` +
            `🔵 <b>@${escapeHTML(cricMatch.guest.username)}'s XI:</b>\n` +
            `${escapeHTML(guestList)}\n` +
            `═════════════════════════════\n\n` +
            `🪙 <b>TOSS TIME!</b> 🪙\n` +
            `• <b>Length:</b> ${parsedOvers} Over(s)\n\n` +
            `👉 @${escapeHTML(cricMatch.guest.username)}, call the toss:`;

          const keyboard = new InlineKeyboard()
            .text('Heads 🪙', `cric_draft_toss_guess:heads:${cricMatch.id}`)
            .text('Tails 🪙', `cric_draft_toss_guess:tails:${cricMatch.id}`);

          await ctx.reply(summaryText, { parse_mode: 'HTML', reply_markup: keyboard });
          return;
        } else {
          await ctx.reply(`⚠️ Invalid input. @${escapeHTML(cricMatch.host.username)}, please enter a valid number of overs (1-20):`);
          return;
        }
      }
    }

    const lobby = gameManager.getLobby(ctx.chat.id);
    if (lobby && lobby.state === 'IMPOSTOR_GUESS' && ctx.from.id === lobby.impostorId) {
      const guess = ctx.message.text;
      
      lobby.state = 'END'; 
      if (normalizeWord(guess) === normalizeWord(lobby.wordA)) {
         processGameEnd(lobby, 'IMPOSTOR');
         await ctx.reply(`🤯 <b>THE IMPOSTOR STOLE THE WIN!</b>\n\n<a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a> correctly guessed the majority word: <b>${escapeHTML(lobby.wordA)}</b>! They pulled off the ultimate bluff!`, { parse_mode: 'HTML' });
      } else {
         processGameEnd(lobby, 'MAJORITY');
         await ctx.reply(`🎉 <b>THE MAJORITY WINS!</b>\n\nThe Impostor was <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a>. They guessed "${escapeHTML(guess)}", but the real group word was <b>${escapeHTML(lobby.wordA)}</b>!`, { parse_mode: 'HTML' });
      }
      gameManager.deleteLobby(ctx.chat.id);
    }
    // Guess the Word check
    const gGame = guessManager.getGame(ctx.chat.id);
    if (gGame && gGame.isGuessingEnabled) {
        if (ctx.from.id !== gGame.host.id) {
            const isCorrect = guessManager.checkGuess(ctx.chat.id, ctx.message.text);
            if (isCorrect) {
                gGame.isGuessingEnabled = false;
                
                const kb = new InlineKeyboard().text("🙋 Wanna be a Host?", "guess_be_host");
                await ctx.reply(
                    `🎉 <b>CORRECT!</b>\n\n` +
                    `🏆 <a href="tg://user?id=${ctx.from.id}">${escapeHTML(ctx.from.first_name)}</a> guessed the word: <b>${escapeHTML(gGame.currentWord)}</b>!\n\n` +
                    `Click below to become the next Host!`,
                    { reply_markup: kb, parse_mode: 'HTML' }
                );
            }
        }
    }
    return;
  }
  
  const userId = ctx.from.id;
  const word = ctx.message.text;

  // Character limit to prevent "message too long" errors in group chat
  if (word.length > 50) {
    return ctx.reply("❌ <b>Clue too long!</b>\n\nPlease send a shorter clue (maximum 50 characters) so that it fits in the group chat.", { parse_mode: 'HTML' });
  }

  // Route clue to the lobby that is actually in CLUE_PHASE
  const regularLobby = gameManager.getLobbyByUserId(userId);
  const mafiaLobby = mafiaManager.getLobbyByUserId(userId);
  
  let activeLobby = null;
  let isMafia = false;

  if (regularLobby && regularLobby.state === 'CLUE_PHASE') {
      activeLobby = regularLobby;
      isMafia = false;
  } else if (mafiaLobby && mafiaLobby.state === 'CLUE_PHASE') {
      activeLobby = mafiaLobby;
      isMafia = true;
  }

  if (activeLobby && !isMafia) {
    const result = gameManager.submitClue(userId, word);
    if (result.error) return ctx.reply(`❌ ${result.error}`);
    if (result.success) {
      await ctx.reply("✅ Got your clue! I will reveal it in the group once everyone is ready.");
      const lobby = result.lobby;
      const chatId = lobby.chatId;
      if (lobby.clueStatusMessageId) {
         let text = `🕵️‍♂️ <b>Clue Phase Started!</b> 🕵️‍♂️\n\nCheck your DMs to see your secret word and reply with your 1-word clue!\n\n<b>Status:</b>\n`;
         lobby.players.forEach(p => { 
            const mark = lobby.cluesReceived[p.id] ? '✅' : '⏳';
            text += `${mark} <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; 
         });
         try { await bot.api.editMessageText(chatId, lobby.clueStatusMessageId, text, { parse_mode: 'HTML' }); } catch(e) {}
      }
      if (result.allReceived) {
        lobby.state = 'DISCUSSION';
        let clueText = `🕵️‍♂️ <b>All Clues Revealed!</b>\n\nLook closely... One of these players is the Impostor with a slightly different word!\n\n`;
        lobby.players.forEach(p => {
          clueText += `- <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>: <b>${escapeHTML(lobby.cluesReceived[p.id])}</b>\n`;
        });
        const gSettings = await sb.getGroupSettings(chatId);
        clueText += `\n💬 <b>DISCUSSION PHASE:</b> You now have exactly ${gSettings.discussion_time} seconds to discuss!`;
        await bot.api.sendMessage(chatId, clueText, { parse_mode: 'HTML' });
        setTimeout(async () => {
           const cl = gameManager.getLobby(chatId);
           if (cl && cl.state === 'DISCUSSION') await startVotingPhase(chatId);
        }, gSettings.discussion_time * 1000);
      }
    }
    return;
  }

  if (activeLobby && isMafia) {
    const result = mafiaManager.submitClue(userId, word);
    if (result.error) return ctx.reply(`❌ ${result.error}`);
    if (result.success) {
      await ctx.reply("✅ Got your clue!");
      const lobby = result.lobby;
      const chatId = lobby.chatId;
      if (lobby.clueStatusMessageId) {
         let text = `🔫 <b>Round ${lobby.round} — Clue Phase</b>\n\nCheck your DMs and reply with your clue!\n\n<b>Status:</b>\n`;
         lobby.alivePlayers.forEach(p => {
            const mark = lobby.cluesReceived[p.id] ? '✅' : '⏳';
            text += `${mark} <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`;
         });
         try { await bot.api.editMessageText(chatId, lobby.clueStatusMessageId, text, { parse_mode: 'HTML' }); } catch(e) {}
      }
      if (result.allReceived) {
        if (lobby.clueTimer) { clearTimeout(lobby.clueTimer); lobby.clueTimer = null; }
        lobby.state = 'DISCUSSION';
        let clueText = `🔫 <b>Round ${lobby.round} — All Clues Revealed!</b>\n\nSomeone might have a different word... find them!\n\n`;
        lobby.alivePlayers.forEach(p => {
          clueText += `- <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>: <b>${escapeHTML(lobby.cluesReceived[p.id])}</b>\n`;
        });
        const dt = lobby.settings.discussion_time || 90;
        clueText += `\n💬 <b>DISCUSSION:</b> ${dt} seconds to discuss!`;
        await bot.api.sendMessage(chatId, clueText, { parse_mode: 'HTML' });
        setTimeout(async () => {
           const cl = mafiaManager.getLobby(chatId);
           if (cl && cl.state === 'DISCUSSION') await startMafiaVoting(chatId);
        }, dt * 1000);
      }
    }
    return;
  }

  // --- Game of Lies DM Logic ---
  const liesLobby = liesManager.getLobbyByUserId(userId);
  if (liesLobby && liesLobby.state === 'QUIZ_PHASE') {
      const isSteal = word.toLowerCase().trim() === 'steal';
      const choice = liesManager.submitChoice(userId, isSteal ? 'steal' : 'answer', isSteal ? "" : word);
      if (choice.error) return ctx.reply(`❌ ${choice.error}`);
      
      if (isSteal) await ctx.reply("😈 <b>Move: STEAL</b>\n\nYou are attempting to steal points! Waiting for opponent...", { parse_mode: 'HTML' });
      else await ctx.reply("✅ <b>Answer received!</b> Waiting for your opponent...", { parse_mode: 'HTML' });
      
      if (choice.allDone) await processLiesResults(liesLobby.chatId);
      return;
  }

  if (regularLobby || mafiaLobby) {
      return ctx.reply("❌ It's not time to submit clues right now.");
  }
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;
  const user = ctx.from;

  // --- PLAYER BUY CALLBACKS ---
  if (data.startsWith('buy_confirm:') || data.startsWith('buy_cancel:')) {
    const parts = data.split(':');
    const playerId = parts[1];
    const initiatorId = parseInt(parts[2], 10);

    if (user.id !== initiatorId) {
      return ctx.answerCallbackQuery({
        text: "⚠️ Only the player who initiated this buying command can confirm or cancel it.",
        show_alert: true
      });
    }

    await ctx.answerCallbackQuery().catch(() => {});

    // Clear transaction state immediately
    const active = activeTransactions.get(initiatorId);
    if (active && active.type === 'buy') {
      if (active.timeoutId) clearTimeout(active.timeoutId);
      activeTransactions.delete(initiatorId);
    }

    if (data.startsWith('buy_cancel:')) {
      await ctx.editMessageCaption({
        caption: `❌ Buying request has been cancelled.`,
        reply_markup: { inline_keyboard: [] }
      }).catch(() => {});
      return;
    }

    try {
      const cricketFromDb = await sb.getCricketPlayers();
      const player = cricketFromDb.find(p => p.id === playerId);
      if (!player) {
        await ctx.editMessageCaption({
          caption: "❌ Player details not found.",
          reply_markup: { inline_keyboard: [] }
        }).catch(() => {});
        return;
      }

      // Check balance
      const profile = await sb.getProfile(initiatorId);
      const currentCoins = profile?.coins || 0;
      if (currentCoins < player.buy_price) {
        const needed = player.buy_price - currentCoins;
        await ctx.editMessageCaption({
          caption: `❌ You need 💰 <b>${needed.toLocaleString()}</b> more coins to buy <b>${escapeHTML(player.name)}</b>.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        }).catch(() => {});
        return;
      }

      const result = await sb.buyPlayer(initiatorId, player.id, 'cricket', player.buy_price);
      if (result.success) {
        await ctx.editMessageCaption({
          caption: `✅ <b>Player Purchased Successfully!</b>\n\n` +
                   `You bought <b>${escapeHTML(player.name)}</b> for 💰 <b>${player.buy_price.toLocaleString()} coins</b>.\n` +
                   `Your new balance is: 💰 <b>${result.newBalance.toLocaleString()} coins</b>.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] }
        }).catch(() => {});
      } else {
        await ctx.editMessageCaption({
          caption: `❌ Purchase failed: ${result.error}`,
          reply_markup: { inline_keyboard: [] }
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Error in player buy callback:", err);
      await ctx.editMessageCaption({
        caption: "❌ An error occurred during the purchase.",
        reply_markup: { inline_keyboard: [] }
      }).catch(() => {});
    }
    return;
  }

  // --- CRICKET LOBBY CALLBACKS ---
  if (data === 'cric_cancel_lobby') {
    const lobby = activeLobbies[chatId];
    if (!lobby) return ctx.answerCallbackQuery({ text: "❌ No active lobby in this chat.", show_alert: true });

    const member = await ctx.getChatMember(user.id).catch(() => ({ status: 'member' }));
    const isAdmin = member.status === 'administrator' || member.status === 'creator' || ADMIN_IDS.includes(user.id);
    const isMod = await sb.checkIsModerator(user.id);

    if (lobby.host.telegramId !== user.id && !isAdmin && !isMod) {
      return ctx.answerCallbackQuery({ text: "❌ Only the host or an admin/moderator can cancel this lobby.", show_alert: true });
    }

    delete activeLobbies[chatId];
    await ctx.answerCallbackQuery({ text: "Lobby cancelled." });
    await ctx.editMessageText(`❌ Match lobby has been cancelled.`, { reply_markup: { inline_keyboard: [] } }).catch(()=>{});
    return;
  }
  if (data.startsWith('cric_quit_confirm:')) {
    const parts = data.split(':');
    const matchId = parts[1];
    const targetUserId = parts[2];

    if (user.id.toString() !== targetUserId.toString()) {
      return ctx.answerCallbackQuery({ text: "❌ Only the player who requested to quit can confirm.", show_alert: true });
    }

    await ctx.answerCallbackQuery();
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      await ctx.editMessageText(`🔄 Processing quit request...`).catch(()=>{});
    } catch (e) {}

    const match = matchManager.getMatch(matchId);
    if (!match || match.status === 'completed') {
      return ctx.editMessageText("❌ Match is already completed or not found.").catch(()=>{});
    }

    await handleMatchTermination(match, user.id, "quit");
    return;
  }

  if (data.startsWith('cric_quit_cancel:')) {
    const parts = data.split(':');
    const matchId = parts[1];
    const targetUserId = parts[2];

    if (user.id.toString() !== targetUserId.toString()) {
      return ctx.answerCallbackQuery({ text: "❌ Only the player who requested to quit can cancel.", show_alert: true });
    }

    await ctx.answerCallbackQuery({ text: "Quit cancelled." });
    try {
      await ctx.deleteMessage();
    } catch (e) {
      await ctx.editMessageText("❌ Quit cancelled.").catch(()=>{});
    }
    return;
  }
  if (data === 'cric_join') {
    const lobby = activeLobbies[chatId];
    if (!lobby) return ctx.answerCallbackQuery({ text: "❌ No active lobby in this chat.", show_alert: true });

    if (lobby.host.telegramId === user.id) {
      return ctx.answerCallbackQuery({ text: "❌ You cannot join your own lobby!", show_alert: true });
    }

    if (lobby.guest) {
      return ctx.answerCallbackQuery({ text: "❌ Lobby is already full.", show_alert: true });
    }

    if (matchManager.getActiveMatch(user.id) || getUserActiveLobby(user.id)) {
      return ctx.answerCallbackQuery({ text: "❌ You are already in an active match or lobby!", show_alert: true }).catch(() => {});
    }

    // Answer immediately to avoid timeout while fetching DB records
    await ctx.answerCallbackQuery({ text: '⏳ Joining match lobby...' }).catch(() => {});

    const guestId = user.id;
    const guestUsername = user.username || user.first_name || 'Guest';

    if (sb.supabase) {
      await sb.ensureUser(guestId, user.first_name).catch(() => {});
    }

    try {
      let guestTeamName = `${guestUsername}'s XI`;
      let squad = [];
      if (sb.supabase) {
        const profile = await sb.getCricketProfile(guestId).catch(() => null);
        if (profile && profile.team_name) {
          guestTeamName = profile.team_name;
        }
      }

      if (lobby.draftMode) {
        lobby.guest = {
          telegramId: guestId,
          username: guestUsername,
          teamName: guestTeamName,
          squad: [],
          xi: []
        };

        const allPlayers = await sb.getCricketPlayers();
        const options = generateDraftOptionsForRole(allPlayers, 'wicket_keeper', []);
        if (!options || options.length < 2) {
          await ctx.reply("❌ <b>Draft Match Failed:</b> Not enough Wicket Keepers in database (need at least 2).", { parse_mode: 'HTML' });
          return;
        }

        const dbMatchId = `c_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        const match = new matchManager.Match({
          id: dbMatchId,
          type: 'pvp',
          chatId: lobby.chatId,
          totalOvers: lobby.overs,
          pitch: ['batting', 'bowling', 'balanced', 'spin', 'pace'][Math.floor(Math.random() * 5)],
          host: {
            telegramId: lobby.host.telegramId,
            username: lobby.host.username,
            teamName: lobby.host.teamName,
            xi: []
          },
          guest: {
            telegramId: lobby.guest.telegramId,
            username: lobby.guest.username,
            teamName: lobby.guest.teamName,
            xi: []
          }
        });
        match.isDraft = true;
        match.draftRound = 1;
        match.draftTurn = lobby.host.telegramId;
        match.draftPool = [options[0].id, options[1].id];
        match.draftOptions = options;
        match.status = 'drafting';

        matchManager.activeMatches[lobby.host.telegramId] = match;
        matchManager.activeMatches[lobby.guest.telegramId] = match;
        matchManager.activeMatches[match.id] = match;
        matchManager.saveToDb(match);

        delete activeLobbies[chatId];

        const text = renderDraftMessage(match);
        const keyboard = new InlineKeyboard()
          .text(`1️⃣ ${options[0].name} (${options[0].ovr})`, `cric_draft_select:${match.id}:1`)
          .text(`2️⃣ ${options[1].name} (${options[1].ovr})`, `cric_draft_select:${match.id}:2`);

        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.error("Edit lobby msg failed:", e));
        return;
      }

      if (sb.supabase) {
        squad = await sb.getUserCricketTeam(guestId);
      }
      const xiResult = ai.selectValidPlayingXI(squad);
      if (!xiResult.success) {
        await ctx.reply(`❌ <b>Join Failed for <a href="tg://user?id=${guestId}">${escapeHTML(guestUsername)}</a>:</b>\n\n${xiResult.error}`, { parse_mode: 'HTML' });
        return ctx.answerCallbackQuery({ text: "❌ Join Failed: Check chat for details.", show_alert: true });
      }
      const xi = xiResult.xi;

      lobby.guest = {
        telegramId: guestId,
        username: guestUsername,
        teamName: guestTeamName,
        squad,
        xi
      };

      lobby.status = 'waiting_overs';
      
      const text = 
        `🤝 <b>@${escapeHTML(guestUsername)} joined the lobby!</b>\n` +
        `═════════════════════════════\n` +
        `• Host: @${escapeHTML(lobby.host.username)}\n` +
        `• Guest: @${escapeHTML(lobby.guest.username)}\n\n` +
        `👉 @${escapeHTML(lobby.host.username)}, please reply to this chat with the number of overs for this match (e.g. 1, 5, 10):`;

      await ctx.editMessageText(text, { parse_mode: 'HTML' });
    } catch (err) {
      console.error("Lobby join error:", err);
      if (err.description && err.description.includes("query is too old")) {
        // Ignore silent timeout errors
        return;
      }
      ctx.reply("❌ Error joining lobby: " + err.message).catch(() => {});
    }
    return;
  }

  if (data.startsWith('cric_toss_guess:')) {
    const guess = data.split(':')[1];
    const lobby = activeLobbies[chatId];
    if (!lobby) return ctx.answerCallbackQuery({ text: "❌ No active lobby in this chat.", show_alert: true });

    if (user.id !== lobby.guest.telegramId) {
      return ctx.answerCallbackQuery({ text: "⚠️ Only the Guest (@" + lobby.guest.username + ") can call the toss!", show_alert: true });
    }

    await ctx.answerCallbackQuery();

    const coinFlip = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = guess === coinFlip;
    const tossWinner = won ? lobby.guest : lobby.host;
    
    lobby.tossWinner = tossWinner;
    lobby.status = 'toss_decision';

    const text = 
      `🪙 <b>TOSS COMPLETED!</b> 🪙\n` +
      `═════════════════════════════\n` +
      `• Guest called: <b>${guess.toUpperCase()}</b>\n` +
      `• Coin landed on: <b>${coinFlip.toUpperCase()}</b>\n\n` +
      `🎉 <b>@${escapeHTML(tossWinner.username)}</b> won the toss!\n` +
      `Choose your decision:`;

    const keyboard = new InlineKeyboard()
      .text('Bat First 🏏', 'cric_decision:bat')
      .text('Bowl First 🎳', 'cric_decision:bowl');

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.error(e));
    return;
  }

  if (data.startsWith('cric_draft_select:')) {
    const parts = data.split(':');
    const matchId = parts[1];
    const optionIdx = parseInt(parts[2]); // 1 or 2

    const match = matchManager.getMatch(matchId);
    if (!match || match.status !== 'drafting') {
      return ctx.answerCallbackQuery({ text: "❌ Match is not in drafting phase or has expired.", show_alert: true });
    }

    if (user.id.toString() !== match.draftTurn.toString()) {
      return ctx.answerCallbackQuery({ text: "⚠️ It's not your turn to choose!", show_alert: true });
    }

    await ctx.answerCallbackQuery().catch(() => {});

    const chosenIdx = optionIdx - 1;
    const otherIdx = chosenIdx === 0 ? 1 : 0;

    const chosenPlayer = match.draftOptions[chosenIdx];
    const otherPlayer = match.draftOptions[otherIdx];

    const isHostTurn = match.draftTurn.toString() === match.host.telegramId.toString();

    // Add to teams with prefix
    if (isHostTurn) {
      match.host.xi.push({ ...chosenPlayer, id: `host_${chosenPlayer.id}` });
      match.guest.xi.push({ ...otherPlayer, id: `guest_${otherPlayer.id}` });
    } else {
      match.guest.xi.push({ ...chosenPlayer, id: `guest_${chosenPlayer.id}` });
      match.host.xi.push({ ...otherPlayer, id: `host_${otherPlayer.id}` });
    }

    // Advance round
    match.draftRound += 1;
    
    // Toggle turn
    match.draftTurn = isHostTurn ? match.guest.telegramId : match.host.telegramId;

    if (match.draftRound <= 11) {
      const allPlayers = await sb.getCricketPlayers();
      const nextRole = DRAFT_ROLES[match.draftRound - 1];
      const nextOptions = generateDraftOptionsForRole(allPlayers, nextRole, match.draftPool);
      
      if (!nextOptions) {
        await ctx.reply("❌ <b>Draft Match Failed:</b> Failed to generate draft options for the next round.");
        return;
      }

      match.draftOptions = nextOptions;
      match.draftPool.push(nextOptions[0].id, nextOptions[1].id);

      matchManager.saveToDb(match);

      const text = renderDraftMessage(match);
      const keyboard = new InlineKeyboard()
        .text(`1️⃣ ${nextOptions[0].name} (${nextOptions[0].ovr})`, `cric_draft_select:${match.id}:1`)
        .text(`2️⃣ ${nextOptions[1].name} (${nextOptions[1].ovr})`, `cric_draft_select:${match.id}:2`);

      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.error(e));
    } else {
      // Draft complete! Ask host for number of overs
      match.status = 'waiting_overs';
      matchManager.saveToDb(match);

      const hostList = match.host.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');
      const guestList = match.guest.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');

      const summaryText = 
        `🎉 <b>DRAFT COMPLETE!</b> 🎉\n` +
        `═════════════════════════════\n` +
        `🟢 <b>@${escapeHTML(match.host.username)}'s XI:</b>\n` +
        `${escapeHTML(hostList)}\n\n` +
        `🔵 <b>@${escapeHTML(match.guest.username)}'s XI:</b>\n` +
        `${escapeHTML(guestList)}\n` +
        `═════════════════════════════\n\n` +
        `👉 @${escapeHTML(match.host.username)}, please reply to this chat with the number of overs for this match (e.g. 1, 5, 10):`;

      await ctx.editMessageText(summaryText, { parse_mode: 'HTML' }).catch(e => console.error(e));
    }
    return;
  }

  if (data.startsWith('cric_draft_toss_guess:')) {
    const parts = data.split(':');
    const guess = parts[1];
    const matchId = parts[2];

    const match = matchManager.getMatch(matchId);
    if (!match || match.status !== 'toss_guess') {
      return ctx.answerCallbackQuery({ text: "❌ Match is not in toss guess phase or has expired.", show_alert: true });
    }

    if (user.id.toString() !== match.guest.telegramId.toString()) {
      return ctx.answerCallbackQuery({ text: "⚠️ Only the Guest (@" + match.guest.username + ") can call the toss!", show_alert: true });
    }

    await ctx.answerCallbackQuery();

    const coinFlip = Math.random() < 0.5 ? 'heads' : 'tails';
    const won = guess === coinFlip;
    const tossWinnerId = won ? match.guest.telegramId : match.host.telegramId;
    const tossWinnerUsername = tossWinnerId.toString() === match.host.telegramId.toString()
      ? match.host.username
      : match.guest.username;

    match.tossWinnerId = tossWinnerId;
    match.status = 'toss';
    matchManager.saveToDb(match);

    const hostList = match.host.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');
    const guestList = match.guest.xi.map((p, idx) => `${idx+1}. ${p.name} (${p.ovr}) [${p.role.toUpperCase().replace('_', ' ')}]`).join('\n');

    const summaryText = 
      `🎉 <b>DRAFT COMPLETE!</b> 🎉\n` +
      `═════════════════════════════\n` +
      `🟢 <b>@${escapeHTML(match.host.username)}'s XI:</b>\n` +
      `${escapeHTML(hostList)}\n\n` +
      `🔵 <b>@${escapeHTML(match.guest.username)}'s XI:</b>\n` +
      `${escapeHTML(guestList)}\n` +
      `═════════════════════════════\n\n` +
      `🪙 <b>TOSS COMPLETED!</b> 🪙\n` +
      `• Guest called: <b>${guess.toUpperCase()}</b>\n` +
      `• Coin landed on: <b>${coinFlip.toUpperCase()}</b>\n\n` +
      `🎉 <b>@${escapeHTML(tossWinnerUsername)}</b> won the toss!\n` +
      `Choose your decision:`;

    const keyboard = new InlineKeyboard()
      .text('Bat First 🏏', `cric_draft_toss:bat:${match.id}`)
      .text('Bowl First 🎳', `cric_draft_toss:bowl:${match.id}`);

    await ctx.editMessageText(summaryText, { parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.error(e));
    return;
  }

  if (data.startsWith('cric_draft_toss:')) {
    const parts = data.split(':');
    const decision = parts[1]; // bat or bowl
    const matchId = parts[2];

    const match = matchManager.getMatch(matchId);
    if (!match || match.status !== 'toss') {
      return ctx.answerCallbackQuery({ text: "❌ Match is not in toss phase or has expired.", show_alert: true });
    }

    if (user.id.toString() !== match.tossWinnerId.toString()) {
      return ctx.answerCallbackQuery({ text: "⚠️ Only the toss winner can make the decision!", show_alert: true });
    }

    await ctx.answerCallbackQuery().catch(() => {});

    match.tossDecision = decision;
    match.status = 'xi_selection';

    matchManager.saveToDb(match);

    const keyboard = new InlineKeyboard();
    addMatchPlayButton(keyboard, match, ctx);

    const text = 
      `🏏 <b>DRAFT MATCH IS READY!</b>\n` +
      `═══════════════════════════════\n` +
      `• Host: <b>${escapeHTML(match.host.username)}</b>\n` +
      `• Guest: <b>${escapeHTML(match.guest.username)}</b>\n` +
      `• Pitch: <b>${match.pitch.toUpperCase()}</b>\n` +
      `• Length: <b>${match.totalOvers} Over(s)</b>\n\n` +
      `🪙 <b>Toss:</b> @${escapeHTML(user.username || user.first_name)} elected to <b>${decision.toUpperCase()} first</b>.\n\n` +
      `👉 Tap <b>Play Match</b> to start!`;

    await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard }).catch(e => console.error(e));
    return;
  }

  if (data.startsWith('cric_decision:')) {
    const decision = data.split(':')[1];
    const lobby = activeLobbies[chatId];
    if (!lobby) return ctx.answerCallbackQuery({ text: "❌ No active lobby in this chat.", show_alert: true });

    if (user.id !== lobby.tossWinner.telegramId) {
      return ctx.answerCallbackQuery({ text: "⚠️ Only the toss winner can make the decision!", show_alert: true });
    }

    await ctx.answerCallbackQuery();
    lobby.tossDecision = decision;

    if (decision === 'bat') {
      lobby.battingPlayer = lobby.tossWinner;
      lobby.bowlingPlayer = lobby.tossWinner.telegramId === lobby.host.telegramId ? lobby.guest : lobby.host;
    } else {
      lobby.bowlingPlayer = lobby.tossWinner;
      lobby.battingPlayer = lobby.tossWinner.telegramId === lobby.host.telegramId ? lobby.guest : lobby.host;
    }

    try {
      const dbMatchId = `c_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      
      if (!lobby.draftMode && !lobby.iplMode) {
        if (!lobby.host.xi || lobby.host.xi.length === 0) {
          lobby.host.xi = [...DEFAULT_XI];
        }
        if (!lobby.guest.xi || lobby.guest.xi.length === 0) {
          lobby.guest.xi = [...DEFAULT_XI];
        }
      }

      const match = matchManager.createMatchFromLobby({
        dbMatchId: dbMatchId,
        lobby: lobby
      });
      match.status = 'xi_selection';

      // IPL Mode — attach pool and flag
      if (lobby.iplMode) {
        match.iplMode    = true;
        match.hostPool   = lobby.host.squad  || [];
        match.guestPool  = lobby.guest.squad || [];
      }

      try {
        await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
      } catch (e) {}

      const keyboard = new InlineKeyboard();
      addMatchPlayButton(keyboard, match, ctx);

      const iplNotice = lobby.iplMode
        ? `\n\n🏆 <b>IPL Mode:</b> Both players must select their Playing XI from their squad in the web app!`
        : '';

      const sentMsg = await ctx.reply(
        `🏏 <b>MATCH IS READY!</b>\n` +
        `═══════════════════════════════\n` +
        `• Host: <b>${escapeHTML(match.host.username)}</b>\n` +
        `• Guest: <b>${escapeHTML(match.guest.username)}</b>\n` +
        `• Pitch: <b>${match.pitch.toUpperCase()}</b>\n` +
        `• Length: <b>${match.totalOvers} Over(s)</b>\n\n` +
        `🪙 <b>Toss:</b> @${escapeHTML(lobby.tossWinner.username)} elected to <b>${decision.toUpperCase()} first</b>.${iplNotice}\n\n` +
        `👉 Tap <b>Play Match</b> to start!`,
        { parse_mode: 'HTML', reply_markup: keyboard }
      );

      match.activeScorecardMessageId = sentMsg.message_id;
      matchManager.saveToDb(match);
      delete activeLobbies[chatId];
    } catch (err) {
      console.error("Match creation error:", err);
      ctx.reply("❌ Error starting match: " + err.message);
    }
    return;
  }

  // --- DICE BET CALLBACKS ---
  if (data.startsWith('dice_bet:')) {
    const parts = data.split(':');
    const choice = parts[1]; // 'below', 'exact', 'above'
    const bet = parseInt(parts[2], 10);
    const queryUserId = parseInt(parts[3], 10);

    if (user.id !== queryUserId) {
        return ctx.answerCallbackQuery({ text: "❌ This is not your game!", show_alert: true }).catch(() => {});
    }

    await ctx.answerCallbackQuery().catch(() => {});

    // Check balance again
    const profile = await sb.getProfile(user.id);
    if (!profile || (profile.coins || 0) < bet) {
        return ctx.editMessageText(`❌ Not enough coins! Balance: ${profile?.coins || 0}`).catch(() => {});
    }

    // Deduct bet
    const deduct = await sb.addCoins(user.id, -bet);
    if (deduct === false) {
        return ctx.editMessageText("❌ Error processing bet.").catch(() => {});
    }

    const choiceText = choice === 'below' ? 'Below 7 (2x)' : (choice === 'above' ? 'Above 7 (2x)' : 'Exactly 7 (5x)');
    
    // Edit message immediately to clear buttons and show rolling status
    await ctx.editMessageText(
        `🎲 <b>7 Up 7 Down Dice Game</b>\n\n` +
        `Choice: <b>${choiceText}</b>\n` +
        `Bet: <b>${bet.toLocaleString()} coins</b>\n\n` +
        `Rolling first dice... 🎲`,
        { parse_mode: 'HTML' }
    ).catch(() => {});

    // Run the rolling animation and result declaration in the background
    // to allow the webhook response to be sent back to Telegram immediately (HTTP 200).
    (async () => {
        try {
            // Send first dice
            let dice1Val = 1;
            try {
                const dice1 = await ctx.replyWithDice('🎲');
                dice1Val = dice1.dice.value;
            } catch (e) {
                console.error("Dice 1 roll error:", e);
                dice1Val = Math.floor(Math.random() * 6) + 1;
            }

            // Wait 1.5 seconds
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Update message for second roll
            await ctx.editMessageText(
                `🎲 <b>7 Up 7 Down Dice Game</b>\n\n` +
                `Choice: <b>${choiceText}</b>\n` +
                `Bet: <b>${bet.toLocaleString()} coins</b>\n\n` +
                `Dice 1: <b>${dice1Val}</b>\n` +
                `Rolling second dice... 🎲`,
                { parse_mode: 'HTML' }
            ).catch(() => {});

            // Send second dice
            let dice2Val = 1;
            try {
                const dice2 = await ctx.replyWithDice('🎲');
                dice2Val = dice2.dice.value;
            } catch (e) {
                console.error("Dice 2 roll error:", e);
                dice2Val = Math.floor(Math.random() * 6) + 1;
            }

            // Wait 1.5 seconds
            await new Promise(resolve => setTimeout(resolve, 1500));

            const total = dice1Val + dice2Val;
            let won = false;
            let multiplier = 0;
            
            if (choice === 'below' && total < 7) {
                won = true;
                multiplier = 2;
            } else if (choice === 'above' && total > 7) {
                won = true;
                multiplier = 2;
            } else if (choice === 'exact' && total === 7) {
                won = true;
                multiplier = 5;
            }

            let resultText = '';
            if (won) {
                const payout = bet * multiplier;
                await sb.addCoinsInternal(user.id, payout);
                const profit = payout - bet;
                
                resultText = `🎉 <b>You Won!</b>\n\n` +
                             `📈 Payout: <b>+${payout.toLocaleString()} coins</b> (Net: +${profit.toLocaleString()} coins)`;
            } else {
                resultText = `❌ <b>You Lost!</b>\n\n` +
                             `📉 Loss: <b>-${bet.toLocaleString()} coins</b>`;
            }

            const currentProfile = await sb.getProfile(user.id);
            const balance = currentProfile ? currentProfile.coins : 0;

            await ctx.editMessageText(
                `🎲 <b>7 Up 7 Down Dice Game</b>\n\n` +
                `Choice: <b>${choiceText}</b>\n` +
                `Bet: <b>${bet.toLocaleString()} coins</b>\n\n` +
                `🎲 Dice 1: <b>${dice1Val}</b>\n` +
                `🎲 Dice 2: <b>${dice2Val}</b>\n` +
                `📊 Total Sum: <b>${total}</b>\n\n` +
                `${resultText}\n` +
                `💰 Current Balance: <b>${balance.toLocaleString()} coins</b>`,
                { parse_mode: 'HTML' }
            ).catch(() => {});
        } catch (err) {
            console.error("Error in dice rolling thread:", err);
        }
    })();

    return;
  }

  // --- MY TEAM CALLBACKS ---
  if (data.startsWith('myteam:')) {
    const parts = data.split(':');
    const tab = parts[1]; // 'cricket', 'football', or 'home'
    const targetUserId = parseInt(parts[2], 10);
    
    await ctx.answerCallbackQuery().catch(() => {});
    
    const profile = await sb.getProfile(targetUserId);
    const name = profile ? profile.first_name : "User";
    if (tab === 'home') {
      const text = `👥 <b><a href="tg://user?id=${targetUserId}">${escapeHTML(name)}</a>'s Club Squads</b>\n\n` +
                   `<blockquote>Select which sport's squad you would like to view. You can purchase more players in the Shop!</blockquote>`;
      const kb = new InlineKeyboard()
        .text("🏏 Cricket Squad", `myteam:cricket:${targetUserId}`)
        .text("⚽ Football Squad", `myteam:football:${targetUserId}`)
        .row();
      
      addShopButton(kb, ctx, "🛒 Visit Player Shop", "shop");
      
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
      return;
    }
    
    if (tab === 'cricket') {
      const team = await sb.getUserCricketTeam(targetUserId);
      
      if (!team || team.length === 0) {
        const text = `🏏 <b><a href="tg://user?id=${targetUserId}">${escapeHTML(name)}</a></b> does not have any cricket players in their squad yet!\n\n` +
                     `<blockquote>Use /claim to get your starter pack or visit the Shop to sign players.</blockquote>`;
        const kb = new InlineKeyboard()
          .text("⬅️ Back", `myteam:home:${targetUserId}`);
        
        addShopButton(kb, ctx, "🛒 Visit Shop", "shop");
        
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
        return;
      }
      
      const captain = await resolveCaptain(targetUserId);
      
      const roleIcon = (role) => {
        if (role === 'batsman') return '🏏';
        if (role === 'wicket_keeper') return '🧤';
        if (role === 'all_rounder') return '⚡';
        if (role === 'bowler') return '🥎';
        return '👤';
      };
      const roleLabel = (role) => {
        if (role === 'batsman') return 'BAT';
        if (role === 'wicket_keeper') return 'WK';
        if (role === 'all_rounder') return 'ALR';
        if (role === 'bowler') return 'BOWL';
        return '';
      };

      let msg = `🏏 <b><u>CRICKET SQUAD</u></b> — <b><a href="tg://user?id=${targetUserId}">${escapeHTML(name)}</a></b>\n`;
      if (profile && profile.team_name) {
        msg += `<blockquote>🏷️ <b>"${escapeHTML(profile.team_name)}"</b></blockquote>\n`;
      }
      msg += `═════════════════════════════\n`;

      // Playing XI (positions 1-11)
      msg += `<b>━━━ PLAYING XI ━━━</b>\n`;
      const xi = team.slice(0, 11);

      const roleGroups = {
        batsman: { title: '<b>━━━ 🏏 BATSMEN ━━━</b>', players: [] },
        wicket_keeper: { title: '<b>━━━ 🧤 WICKET KEEPERS ━━━</b>', players: [] },
        all_rounder: { title: '<b>━━━ ⚡ ALL-ROUNDERS ━━━</b>', players: [] },
        bowler: { title: '<b>━━━ 🥎 BOWLERS ━━━</b>', players: [] }
      };

      xi.forEach((p, idx) => {
        const role = p.role || 'bowler';
        if (roleGroups[role]) {
          roleGroups[role].players.push({ ...p, displayIdx: idx + 1 });
        } else {
          roleGroups.bowler.players.push({ ...p, displayIdx: idx + 1 });
        }
      });

      const rolesOrder = ['batsman', 'wicket_keeper', 'all_rounder', 'bowler'];
      rolesOrder.forEach(roleKey => {
        const group = roleGroups[roleKey];
        if (group.players.length > 0) {
          msg += `\n${group.title}\n`;
          group.players.forEach(p => {
            const tierIndicator = p.tier === 'Legendary' ? ' 💎' : p.tier === 'Gold' ? ' ⭐' : '';
            const captainLabel = captain && p.id === captain.id ? ' 👑' : '';
            msg += `• <b>${p.displayIdx}.</b> ${roleIcon(p.role)} <b>${escapeHTML(p.name)}</b> (<code>${p.ovr} OVR</code>)${tierIndicator}${captainLabel}\n`;
          });
        }
      });

      // Bench (positions 12+)
      if (team.length > 11) {
        msg += `\n<b>━━━ 🪑 BENCH ━━━</b>\n`;
        const bench = team.slice(11);
        bench.forEach((p, idx) => {
          const tierIndicator = p.tier === 'Legendary' ? ' 💎' : p.tier === 'Gold' ? ' ⭐' : '';
          const captainLabel = captain && p.id === captain.id ? ' 👑' : '';
          msg += `• <b>${idx + 12}.</b> ${roleIcon(p.role)} <b>${escapeHTML(p.name)}</b> (<code>${p.ovr} OVR</code>)${tierIndicator}${captainLabel}\n`;
        });
      }
      
      msg += `═════════════════════════════\n`;
      msg += `📊 <b>Squad:</b> <code>${team.length}/25</code>`;
      if (xi.length >= 11) {
        const teamRating = Math.round(xi.reduce((sum, p) => sum + (p.ovr || 0), 0) / 11);
        msg += ` • <b>XI Rating:</b> <code>${teamRating} OVR</code>`;
      }
      msg += `\n💡 <i>Use <code>/swap [pos1] [pos2]</code> to rearrange your squad.</i>`;
      
      const kb = new InlineKeyboard()
        .text("⬅️ Back", `myteam:home:${targetUserId}`);
      addShopButton(kb, ctx, "🛒 Visit Shop", "shop");
      
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
      return;
    }
    
    if (tab === 'football') {
      const owned = await sb.getUserOwnedPlayers(targetUserId);
      const footballOwnedIds = owned.filter(o => o.sport === 'football').map(o => o.player_id);
      const team = footballPlayers.filter(p => footballOwnedIds.includes(p.id));
      
      if (!team || team.length === 0) {
        const text = `⚽ <b><a href="tg://user?id=${targetUserId}">${escapeHTML(name)}</a></b> does not have any football players in their squad yet!\n\n` +
                     `<blockquote>Go to the Shop tab in the Mini App to sign football players for your team.</blockquote>`;
        const kb = new InlineKeyboard()
          .text("⬅️ Back", `myteam:home:${targetUserId}`);
        addShopButton(kb, ctx, "🛒 Visit Shop", "shop");
        await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
        return;
      }
      
      // Categorize football players: Forward, Midfielder, Defender, Goalkeeper
      // Sort each category descending by OVR
      const forwards = team.filter(p => p.role === 'Forward').sort((a, b) => b.ovr - a.ovr);
      const midfielders = team.filter(p => p.role === 'Midfielder').sort((a, b) => b.ovr - a.ovr);
      const defenders = team.filter(p => p.role === 'Defender').sort((a, b) => b.ovr - a.ovr);
      const gks = team.filter(p => p.role === 'Goalkeeper').sort((a, b) => b.ovr - a.ovr);
      
      let msg = `⚽ <u><b>FOOTBALL SQUAD</b></u> — <b><a href="tg://user?id=${targetUserId}">${escapeHTML(name)}</a></b>\n\n`;
      msg += `<blockquote>⚽ "You have to fight to reach your dream. You have to sacrifice and work hard for it."</blockquote>\n`;
      
      const renderPlayer = (p) => {
        const tierIndicator = p.tier === 'Legendary' ? ' 💎' : p.tier === 'Gold' ? ' ⭐' : '';
        return `• <b>${escapeHTML(p.name)}</b> (OVR: <b>${p.ovr}</b>)${tierIndicator}`;
      };
      
      msg += `⚽ <b>FORWARDS</b>\n`;
      if (forwards.length > 0) {
        forwards.forEach(p => msg += `${renderPlayer(p)}\n`);
      } else {
        msg += `<i>No forwards signed yet.</i>\n`;
      }
      msg += `\n`;
      
      msg += `⚡ <b>MIDFIELDERS</b>\n`;
      if (midfielders.length > 0) {
        midfielders.forEach(p => msg += `${renderPlayer(p)}\n`);
      } else {
        msg += `<i>No midfielders signed yet.</i>\n`;
      }
      msg += `\n`;
      
      msg += `🛡️ <b>DEFENDERS</b>\n`;
      if (defenders.length > 0) {
        defenders.forEach(p => msg += `${renderPlayer(p)}\n`);
      } else {
        msg += `<i>No defenders signed yet.</i>\n`;
      }
      msg += `\n`;
      
      msg += `🧤 <b>GOALKEEPERS</b>\n`;
      if (gks.length > 0) {
        gks.forEach(p => msg += `${renderPlayer(p)}\n`);
      } else {
        msg += `<i>No goalkeepers signed yet.</i>\n`;
      }
      msg += `\n`;
      
      const totalPlayers = team.length;
      const sortedByOvr = [...team].sort((a, b) => b.ovr - a.ovr);
      const top11 = sortedByOvr.slice(0, 11);
      const teamRating = Math.round(top11.reduce((sum, p) => sum + (p.ovr || 0), 0) / 11);
      const bestPlayer = sortedByOvr[0];
      
      msg += `📊 <b>Squad Stats:</b>\n`;
      msg += `👥 <b>Players:</b> ${totalPlayers}\n`;
      msg += `📈 <b>Team Rating:</b> ${teamRating} OVR\n`;
      msg += `🔥 <b>Star Player:</b> ${escapeHTML(bestPlayer.name)} (${bestPlayer.ovr} OVR)`;
      
      const kb = new InlineKeyboard()
        .text("⬅️ Back", `myteam:home:${targetUserId}`);
      addShopButton(kb, ctx, "🛒 Visit Shop", "shop");
      
      await ctx.editMessageText(msg, { parse_mode: 'HTML', reply_markup: kb }).catch(() => {});
      return;
    }
  }

  // --- PLAYER SELL CALLBACKS ---
  if (data.startsWith('sell_y:') || data.startsWith('sell_n:')) {
    const parts = data.split(':');
    const initiatorId = parseInt(parts[parts.length - 1], 10);
    
    if (user.id !== initiatorId) {
      return ctx.answerCallbackQuery({
        text: "⚠️ Only the player who initiated this sale command can confirm or cancel it.",
        show_alert: true
      });
    }

    await ctx.answerCallbackQuery().catch(() => {});

    // Clear transaction state immediately
    const active = activeTransactions.get(initiatorId);
    if (active && active.type === 'sell') {
      if (active.timeoutId) clearTimeout(active.timeoutId);
      activeTransactions.delete(initiatorId);
    }
    
    if (data.startsWith('sell_n:')) {
      await ctx.editMessageText("❌ Player sale cancelled.", { reply_markup: null }).catch(() => {});
      return;
    }
    
    const sportAbbr = parts[1]; // 'c' or 'f'
    const playerId = parts[2];
    const sport = sportAbbr === 'c' ? 'cricket' : 'football';

    try {
      const userId = ctx.from.id;
      
      // Let's resolve the player's price
      let player = null;
      if (sport === 'football') {
        player = footballPlayers.find(p => p.id === playerId);
      } else {
        const cricketFromDb = await sb.getCricketPlayers();
        player = cricketFromDb.find(p => p.id === playerId);
      }

      if (!player) {
        await ctx.editMessageText("❌ Player details not found.", { reply_markup: null }).catch(() => {});
        return;
      }

      const owned = await sb.getUserOwnedPlayers(userId);
      const ownedRecord = owned.find(o => o.player_id === playerId && o.sport === sport);
      const acquiredAt = ownedRecord ? ownedRecord.acquired_at : null;

      const actualBuyPrice = resolvePlayerPrice(player, acquiredAt);
      const sellPrice = Math.round(actualBuyPrice * 0.55);
      const result = await sb.sellPlayer(userId, player.id, sport, sellPrice);
      
      if (result.success) {
        await ctx.editMessageText(
          `✅ <b>Player Sold Successfully!</b>\n\n` +
          `You sold <b>${escapeHTML(player.name)}</b> for 💰 <b>${sellPrice.toLocaleString()} coins</b>.\n` +
          `Your new balance is: 💰 <b>${result.newBalance.toLocaleString()} coins</b>.`,
          { parse_mode: 'HTML', reply_markup: null }
        ).catch(() => {});
      } else {
        await ctx.editMessageText(`❌ Sale failed: ${result.error}`, { reply_markup: null }).catch(() => {});
      }
    } catch (err) {
      console.error("Error in player sell callback:", err);
      await ctx.editMessageText("❌ An error occurred while processing the sale callback.", { reply_markup: null }).catch(() => {});
    }
    return;
  }

  // --- BLACKJACK CALLBACKS ---
  if (data.startsWith('bj_')) {
    const state = activeBJ.get(user.id);
    if (!state || (chatId && state.chatId !== chatId)) return ctx.answerCallbackQuery("Game not found.");

    if (data === 'bj_hit') {
      state.playerHand.push(getPlayerHitCard(state));
      const score = bjManager.calculateScore(state.playerHand);
      if (score > 21) {
        state.status = 'BUST';
        activeBJ.delete(user.id);
        await sendBJMsg(ctx, state, true, state.chatId, state.messageId);
      } else {
        await sendBJMsg(ctx, state, true, state.chatId, state.messageId);
      }
      return ctx.answerCallbackQuery();
    }

    if (data === 'bj_double') {
      const profile = await sb.getProfile(user.id);
      if (!profile || (profile.coins || 0) < state.bet) {
        return ctx.answerCallbackQuery({ text: "Not enough coins to double!", show_alert: true });
      }
      await sb.addCoins(user.id, -state.bet);
      state.bet *= 2;
      state.playerHand.push(getPlayerHitCard(state));
      const score = bjManager.calculateScore(state.playerHand);
      if (score > 21) {
        state.status = 'BUST';
        activeBJ.delete(user.id);
        await sendBJMsg(ctx, state, true, state.chatId, state.messageId);
      } else {
        await handleBJStand(ctx, state);
      }
      return ctx.answerCallbackQuery();
    }

    if (data === 'bj_stand') {
      await handleBJStand(ctx, state);
      return ctx.answerCallbackQuery();
    }
  }

  if (data.startsWith('hilo_')) {
    const action = data.replace('hilo_', '');
    
    const release = await sb.acquireLock(user.id);
    try {
        const state = await hiloManager.getGame(user.id);
        if (!state) {
            ctx.answerCallbackQuery({ text: "No active Hilo game found.", show_alert: true }).catch(()=>{});
            return;
        }
        
        if (ctx.callbackQuery.message.message_id !== state.messageId) {
            ctx.answerCallbackQuery("This game session is outdated!").catch(()=>{});
            return;
        }

        if (action === 'withdraw') {
            let payout = Math.floor(state.betAmount * state.multiplier);
            let penaltyMsg = "";
            
            // If withdrawing immediately at 1.0x, only get 0.9x back
            if (state.multiplier <= 1.0) {
                payout = Math.floor(state.betAmount * 0.9);
                penaltyMsg = "\n⚠️ <i>Penalty applied for immediate withdrawal (0.9x).</i>";
            }

            ctx.answerCallbackQuery(`Withdrew ${payout} coins!`).catch(()=>{});
            hiloManager.endGame(user.id);
            await sb.addCoinsInternal(user.id, payout);
            bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `💰 <b>Withdrawn!</b>\n\nYou walked away with ${payout} coins!\nMultiplier reached: ${state.multiplier}x${penaltyMsg}`, { parse_mode: 'HTML' }).catch(()=>{});
            return;
        }

        const profile = await sb.getProfile(user.id);
        const valCurrent = state.currentPlayer[state.constraint];
        let valNext = state.nextPlayer[state.constraint];
        const oldNextName = state.nextPlayer.name;

        let isCorrect = false;
        let isEqual = false;
        
        if (valCurrent === valNext) isEqual = true;
        else if (action === 'higher' && valNext > valCurrent) isCorrect = true;
        else if (action === 'lower' && valNext < valCurrent) isCorrect = true;
        
        if (isEqual) {
            ctx.answerCallbackQuery("It's a draw! No multiplier change.").catch(()=>{});
            const nextState = hiloManager.nextRoundDraw(user.id);
            sendHiloMsg(ctx, nextState, true, chatId, ctx.callbackQuery.message.message_id, `🤝 <b>Draw! Next player was ${oldNextName} with ${valNext}.</b>\n\n`);
        } else if (isCorrect) {
            ctx.answerCallbackQuery("Correct! Multiplier increased!").catch(()=>{});
            const nextState = hiloManager.nextRound(user.id, action);
            sendHiloMsg(ctx, nextState, true, chatId, ctx.callbackQuery.message.message_id, `✅ <b>Correct!</b> (${oldNextName} had ${valNext})\n\n`);
        } else {
            ctx.answerCallbackQuery({ text: `Wrong! ${oldNextName} had ${valNext} ${state.constraint}.`, show_alert: true }).catch(()=>{});
            hiloManager.endGame(user.id);
            bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `❌ <b>You Lost!</b>\n\n👤 <b>${state.currentPlayer.name}</b> had ${valCurrent} ${state.constraint}.\n👤 <b>${oldNextName}</b> had <b>${valNext}</b>.\n\nYou bet: ${state.betAmount} 💰`, { parse_mode: 'HTML' }).catch(()=>{});
        }
    } catch (err) {
        console.error("Hilo Callback Error:", err);
        ctx.answerCallbackQuery("Error processing your move. Please try again.").catch(()=>{});
    } finally {
        sb.releaseLock(release);
    }
    return;
  }

  // --- Leaderboard callbacks ---
  if (data.startsWith('lb_')) {
     const parts = data.split('_'); // lb_scope_sort
     const scope = parts[1]; // global or group
     const sortBy = parts[2]; // wins or coins or rating
     
     const isGlobal = scope === 'global';
     const records = isGlobal ? await sb.getGlobalLeaderboard(sortBy) : await sb.getGroupLeaderboard(chatId, sortBy);
     
     const title = sortBy === 'wins' ? 'Wins' : (sortBy === 'coins' ? 'Coins' : 'Rating');
     const scopeTitle = isGlobal ? 'Global' : 'Group';
     const icon = sortBy === 'wins' ? '🏆' : (sortBy === 'coins' ? '💰' : '📈');
     const scopeIcon = isGlobal ? '🌍' : '🏠';
     
     let text = `${scopeIcon} <b>${scopeTitle} Top 10 — ${title}</b> ${scopeIcon}\n\n`;
     
     if (!records || records.length === 0) {
        text += "<i>No records found yet!</i>\n";
     } else {
        records.forEach((r, i) => {
           if (sortBy === 'wins') {
               const winRate = r.matches_played > 0 ? Math.round((r.wins / r.matches_played) * 100) : 0;
               text += `${i+1}. <a href="tg://user?id=${r.user_id}"><b>${r.first_name || 'Player'}</b></a> - ${r.wins} Wins <i>(${winRate}% WR)</i>\n`;
           } else if (sortBy === 'coins') {
               text += `${i+1}. <a href="tg://user?id=${r.user_id}"><b>${r.first_name || 'Player'}</b></a> - ${r.coins} Coins 💰\n`;
           } else if (sortBy === 'rating') {
               text += `${i+1}. <a href="tg://user?id=${r.user_id}"><b>${r.first_name || 'Player'}</b></a> - ${r.rating || 0} Rating 📈\n`;
           }
        });
     }
 
     const userRank = isGlobal ? await sb.getUserGlobalRank(user.id, sortBy) : await sb.getUserGroupRank(chatId, user.id, sortBy);
     if (userRank !== null && userRank !== undefined) {
         text += `\n📌 <b>Your Position:</b> #${userRank}`;
     }
     
     const kb = new InlineKeyboard();
     
     // Scope Selector Row
     kb.text(isGlobal ? "● Global" : "Global", `lb_global_${sortBy}`)
       .text(!isGlobal ? "● Group" : "Group", `lb_group_${sortBy}`).row();
     
     // Sort Selector Row
     kb.text(sortBy === 'rating' ? "● Rating" : "Rating", `lb_${scope}_rating`)
       .text(sortBy === 'wins' ? "● Wins" : "Wins", `lb_${scope}_wins`)
       .text(sortBy === 'coins' ? "● Coins" : "Coins", `lb_${scope}_coins`);
       
     try {
       await ctx.editMessageText(text, { reply_markup: kb, parse_mode: 'HTML' });
     } catch(e) {}
     return;
  }


  // --- Settings callbacks ---
  if (data.startsWith('set_')) {
    const member = await ctx.getChatMember(user.id);
    if (member.status !== 'administrator' && member.status !== 'creator') {
      return ctx.answerCallbackQuery({ text: "⛔ Only group admins can change settings.", show_alert: true });
    }
    const DISCUSSION_OPTIONS = [30, 60, 90, 120, 180];
    const VOTING_OPTIONS = [30, 45, 60, 90];
    const GUESS_OPTIONS = [15, 30, 45, 60];
    const CLUE_OPTIONS = [1, 2, 3];
    function cycleOption(current, options) { const idx = options.indexOf(current); return options[(idx + 1) % options.length]; }
    let settings = await sb.getGroupSettings(chatId);
    if (data === 'set_discussion') { const v = cycleOption(settings.discussion_time, DISCUSSION_OPTIONS); settings = await sb.updateGroupSetting(chatId, 'discussion_time', v); await ctx.answerCallbackQuery(`Discussion time → ${v}s`); }
    else if (data === 'set_voting') { const v = cycleOption(settings.voting_time, VOTING_OPTIONS); settings = await sb.updateGroupSetting(chatId, 'voting_time', v); await ctx.answerCallbackQuery(`Voting time → ${v}s`); }
    else if (data === 'set_impostor_guess') { const v = cycleOption(settings.impostor_guess_time, GUESS_OPTIONS); settings = await sb.updateGroupSetting(chatId, 'impostor_guess_time', v); await ctx.answerCallbackQuery(`Impostor guess time → ${v}s`); }
    else if (data === 'set_clue_words') { const v = cycleOption(settings.clue_words, CLUE_OPTIONS); settings = await sb.updateGroupSetting(chatId, 'clue_words', v); await ctx.answerCallbackQuery(`Clue words → ${v}`); }
    else if (data === 'set_anon_vote') { const v = !settings.anonymous_voting; settings = await sb.updateGroupSetting(chatId, 'anonymous_voting', v); await ctx.answerCallbackQuery(`Voting → ${v ? 'Anonymous' : 'Public'}`); }
    else if (data === 'set_reset') { const d = sb.getDefaults(); for (const k of Object.keys(d)) await sb.updateGroupSetting(chatId, k, d[k]); settings = d; await ctx.answerCallbackQuery('Reset to defaults!'); }
    try { await ctx.editMessageText(buildSettingsText(settings), { reply_markup: buildSettingsKeyboard(settings), parse_mode: 'HTML' }); } catch(e) {}
    return;
  }

  // --- Mafia callbacks ---
  if (data.startsWith('maf_') || data.startsWith('maft_') || data.startsWith('mafv_')) {
    const mLobby = mafiaManager.getLobby(chatId);
    if (!mLobby) return ctx.answerCallbackQuery({ text: "This lobby has expired.", show_alert: true });
    const mIsHost = mLobby.host.id === user.id;

    if (data === 'maf_join') {
      if (mLobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Game already started!");
      
      if (getActiveLobbyForUser(user.id)) {
          return ctx.answerCallbackQuery({ text: "❌ You are already in an active game or lobby! Use /quit first.", show_alert: true });
      }

      try { await ctx.api.sendChatAction(user.id, 'typing'); }
      catch(e) { return ctx.answerCallbackQuery({ text: "You MUST start the bot first!", show_alert: true }); }
      const joined = mafiaManager.joinLobby(chatId, user);
      if (joined) { ctx.answerCallbackQuery("Joined!"); await updateMafiaLobbyMessage(chatId, mLobby, ctx.callbackQuery.message.message_id); }
      else ctx.answerCallbackQuery("You are already in the game.");
    }
    else if (data === 'maf_leave') {
      if (mLobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Game already started!");
      const left = mafiaManager.leaveLobby(chatId, user.id);
      if (left) {
        ctx.answerCallbackQuery("You left.");
        if (mLobby.players.length === 0) { mafiaManager.deleteLobby(chatId); await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, "Lobby closed.", { parse_mode: 'HTML' }); }
        else await updateMafiaLobbyMessage(chatId, mLobby, ctx.callbackQuery.message.message_id);
      } else ctx.answerCallbackQuery("You are not in the game.");
    }
    else if (data === 'maf_start') {
      if (!mIsHost) return ctx.answerCallbackQuery({ text: "Only the host can start!", show_alert: true });
      if (mLobby.players.length < 3) return ctx.answerCallbackQuery({ text: "Minimum 3 players needed for Mafia!", show_alert: true });
      mafiaManager.moveToThemeSelection(chatId);
      if (mLobby.pinnedMessageId) { try { await bot.api.unpinChatMessage(chatId, mLobby.pinnedMessageId); } catch(e) {} }
      const themes = mafiaManager.getAvailableThemes();
      const kb = new InlineKeyboard();
      themes.forEach(t => kb.text(t, `maft_${t}`).row());
      await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🔫 Host <b>${escapeHTML(mLobby.host.first_name)}</b>, choose a theme:`, { reply_markup: kb, parse_mode: 'HTML' });
    }
    else if (data.startsWith('maft_')) {
      if (!mIsHost) return ctx.answerCallbackQuery({ text: "Only the host!", show_alert: true });
      if (mLobby.state !== 'THEME_SELECTION') return ctx.answerCallbackQuery("Not the time!");
      const theme = data.replace('maft_', '');
      await ctx.answerCallbackQuery("Let the games begin!");
      try { await bot.api.editMessageReplyMarkup(chatId, ctx.callbackQuery.message.message_id, { reply_markup: new InlineKeyboard() }); } catch(e) {}

      const gSettings = await sb.getGroupSettings(chatId);
      mLobby.theme = theme;
      mLobby.settings = gSettings;
      mafiaManager.assignRoles(chatId);
      const dist = mafiaManager.getRoleDist(mLobby.players.length);

      await bot.api.sendMessage(chatId,
        `🔫 <b>MAFIA GAME STARTING!</b> 🔫\n\nTheme: <b>${theme}</b> | Players: ${mLobby.players.length}\nRoles: ${dist.impostors} Impostor${dist.impostors > 1 ? 's' : ''}${dist.joker ? ' | 1 Joker 🃏' : ''} | ${mLobby.players.length - dist.impostors - dist.joker} Civilians\n\n⚠️ Impostors don't know they're impostors!\n\n<b>Round 1 starting...</b>`,
        { parse_mode: 'HTML' });

      const ok = await mafiaManager.startRound(chatId, bot);
      if (!ok) return;
      const me = bot.botInfo || await bot.api.getMe();
      const dmKb = new InlineKeyboard().url("📩 Go to Bot DM", `https://t.me/${me.username}`);
      let text = `🔫 <b>Round 1 — Clue Phase</b>\n\nCheck your DMs and reply with your clue! ⏰ <b>60 seconds!</b>\n\n<b>Status:</b>\n`;
      mLobby.alivePlayers.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; });
      try { const msg = await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: dmKb }); mLobby.clueStatusMessageId = msg.message_id; } catch(e) {}
      mLobby.clueTimer = setTimeout(() => handleClueTimeout(chatId), 60000);
    }
    else if (data.startsWith('mafv_')) {
      if (mLobby.state !== 'VOTING') return ctx.answerCallbackQuery("Not voting time.");
      if (!mLobby.alivePlayers.find(p => p.id === user.id)) return ctx.answerCallbackQuery("You aren't in this match.");
      if (mLobby.votes[user.id]) return ctx.answerCallbackQuery("Already voted!");
      const targetId = parseInt(data.replace('mafv_', ''));
      const targetP = mLobby.alivePlayers.find(p => p.id === targetId);
      const vr = mafiaManager.vote(chatId, user.id, targetId);
      if (vr) {
        ctx.answerCallbackQuery("Vote recorded!");
        if (!mLobby.anonymousVoting) await bot.api.sendMessage(chatId, `🗳️ <a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a> voted for <a href="tg://user?id=${targetP.id}">${escapeHTML(targetP.first_name)}</a>!`, { parse_mode: 'HTML' });
        else await bot.api.sendMessage(chatId, `🗳️ A vote has been cast! (${Object.keys(mLobby.votes).length}/${mLobby.alivePlayers.length})`, { parse_mode: 'HTML' });
        if (vr.allVoted) await tallyMafiaVotes(chatId);
      }
    }
    return;
  }

  // --- Lies Game Callbacks ---
  const lLobby = liesManager.getLobby(chatId);
  
  if (data === 'lies_end_confirm' || data === 'lies_end_cancel') {
      if (!lLobby) return ctx.answerCallbackQuery("Game already ended!");
      const member = await ctx.getChatMember(user.id);
      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      if (lLobby.players[0].id !== user.id && !isAdmin) return ctx.answerCallbackQuery("Not authorized!");

      if (data === 'lies_end_confirm') {
          liesManager.deleteLobby(chatId);
          await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, "🛑 <b>Game of Lies has been terminated by an admin.</b>", { parse_mode: 'HTML' });
      } else {
          await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, "✅ Match continues!");
      }
      return ctx.answerCallbackQuery();
  }

  if (data === 'lies_join') {
      if (!lLobby || lLobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Lobby expired.");

      const activeLobby = getActiveLobbyForUser(user.id);
      if (activeLobby && activeLobby !== lLobby) {
          return ctx.answerCallbackQuery({ text: "❌ You are already in an active game or lobby! Use /quit first.", show_alert: true });
      }
      
      // Handle Direct Challenge
      if (lLobby.isDirect) {
          if (user.id === lLobby.players[0].id) return ctx.answerCallbackQuery("Waiting for opponent to accept!");
          if (user.id !== lLobby.challengerId) return ctx.answerCallbackQuery("This challenge isn't for you!");
          
          ctx.answerCallbackQuery("Accepted!");
          const dmKb = new InlineKeyboard().url("📩 Go to Bot DM", `https://t.me/${bot.botInfo.username}`);
          await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🎮 <b>Match Started!</b>\n\n<a href="tg://user?id=${lLobby.players[0].id}">${escapeHTML(lLobby.players[0].first_name)}</a> vs <a href="tg://user?id=${lLobby.players[1].id}">${escapeHTML(lLobby.players[1].first_name)}</a>\n\nCheck your DMs for the first question!`, { parse_mode: 'HTML', reply_markup: dmKb });
          await startLiesRound(chatId);
          return;
      }

      // Handle Public Challenge
      if (lLobby.players.length === 1) {
          if (user.id === lLobby.players[0].id) return ctx.answerCallbackQuery("You are the host!");
          const joined = liesManager.joinLobby(chatId, { id: user.id, first_name: user.first_name });
          if (!joined) return ctx.answerCallbackQuery("You cannot join this lobby.");
          ctx.answerCallbackQuery("Joined!");
          const dmKb = new InlineKeyboard().url("📩 Go to Bot DM", `https://t.me/${bot.botInfo.username}`);
          await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🎮 <b>Match Started!</b>\n\n<a href="tg://user?id=${lLobby.players[0].id}">${escapeHTML(lLobby.players[0].first_name)}</a> vs <a href="tg://user?id=${lLobby.players[1].id}">${escapeHTML(lLobby.players[1].first_name)}</a>\n\nCheck your DMs for the first question!`, { parse_mode: 'HTML', reply_markup: dmKb });
          await startLiesRound(chatId);
          return;
      } else {
          return ctx.answerCallbackQuery("Lobby is full!");
      }
  }
  if (data === 'lies_steal') {
      const liesLobby = liesManager.getLobbyByUserId(user.id);
      if (!liesLobby || liesLobby.state !== 'QUIZ_PHASE') return ctx.answerCallbackQuery("Not the time to steal!");
      const choice = liesManager.submitChoice(user.id, 'steal');
      if (choice.error) return ctx.answerCallbackQuery(choice.error);
      ctx.answerCallbackQuery("You decided to STEAL 😈");
      await bot.api.editMessageText(user.id, ctx.callbackQuery.message.message_id, "😈 <b>Move: STEAL</b>\n\nYou are attempting to steal points if they get the answer right. Wait for results...");
      if (choice.allDone) await processLiesResults(liesLobby.chatId);
      return;
  }
  if (data === 'lies_cancel') {
      if (!lLobby) return ctx.answerCallbackQuery("Lobby already closed.");
      if (user.id !== lLobby.players[0].id && (lLobby.challengerId && user.id !== lLobby.challengerId)) return ctx.answerCallbackQuery("You can't decline this.");
      liesManager.deleteLobby(chatId);
      await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, "❌ <b>The Game of Lies challenge was declined.</b>", { parse_mode: 'HTML' });
      return;
  }

  // --- Guess the Word callbacks ---
  if (data.startsWith('guess_')) {
      const gGame = guessManager.getGame(chatId);
      if (!gGame) return ctx.answerCallbackQuery("This game has ended.");
      
      if (data === 'guess_see') {
          if (user.id !== gGame.host.id) return ctx.answerCallbackQuery({ text: "Only the Host can see the word!", show_alert: true });
          return ctx.answerCallbackQuery({ text: `🔍 The word is: ${gGame.currentWord}`, show_alert: true });
      }
      
      if (data === 'guess_next') {
          if (user.id !== gGame.host.id) return ctx.answerCallbackQuery({ text: "Only the Host can skip!", show_alert: true });
          const newWord = guessManager.nextWord(chatId);
          return ctx.answerCallbackQuery({ text: `⏭️ Skipped! New word is: ${newWord}`, show_alert: true });
      }

      if (data === 'guess_be_host') {
          if (gGame.isGuessingEnabled) return ctx.answerCallbackQuery({ text: "Someone already claimed the host position!", show_alert: true });

          // Become Host
          gGame.host = { id: user.id, first_name: user.first_name };
          gGame.currentWord = guessManager.getRandomWord();
          gGame.isGuessingEnabled = true;

          const kb = new InlineKeyboard()
              .text("👁️ See Word", "guess_see")
              .text("⏭️ Next Word", "guess_next");

          await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, 
              `🎮 <b>Guess the Word!</b>\n\n` +
              `👤 <a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a> is now the <b>Host</b>!\n\n` +
              `They are explaining a word. Everyone else, start guessing in the chat!`,
              { reply_markup: kb, parse_mode: 'HTML' }
          );
          
          return ctx.answerCallbackQuery({ text: `🔍 Your word is: ${gGame.currentWord}\n\nStart explaining!`, show_alert: true });
      }
      return;
  }

  
  // --- Regular Game callbacks ---
  const lobby = gameManager.getLobby(chatId);
  if (!lobby) return ctx.answerCallbackQuery({ text: "This game lobby has expired or does not exist.", show_alert: true });
  const isHost = lobby.host.id === user.id;

  if (data === 'join_game') {
    if (lobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Game already started!");

    if (getActiveLobbyForUser(user.id)) {
        return ctx.answerCallbackQuery({ text: "❌ You are already in an active game or lobby! Use /quit first.", show_alert: true });
    }

    try { await ctx.api.sendChatAction(user.id, 'typing'); } 
    catch (e) { return ctx.answerCallbackQuery({ text: "You MUST start the bot in private messages first! Tap my profile picture, hit Start, and come back.", show_alert: true }); }

    const joined = gameManager.joinLobby(chatId, user);
    if (joined) {
      ctx.answerCallbackQuery("Joined successfully!");
      if (!lobby.joinMessageId) lobby.joinMessageId = ctx.callbackQuery.message.message_id;
      await updateLobbyMessage(chatId, lobby, lobby.joinMessageId);
    } else {
      ctx.answerCallbackQuery("You are already in the game.");
    }
  } 
  else if (data === 'leave_game') {
    if (lobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Game already started!");
    const left = gameManager.leaveLobby(chatId, user.id);
    if (left) {
      ctx.answerCallbackQuery("You left the game.");
      if (lobby.players.length === 0) {
        gameManager.deleteLobby(chatId);
        await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, "Lobby closed because everyone left.", { parse_mode: 'HTML' });
      } else {
        await updateLobbyMessage(chatId, lobby, ctx.callbackQuery.message.message_id);
      }
    } else {
      ctx.answerCallbackQuery("You are not in the game.");
    }
  }
  else if (data === 'start_game') {
    if (!isHost) return ctx.answerCallbackQuery({ text: "Only the host can start!", show_alert: true });
    if (lobby.players.length < 3) return ctx.answerCallbackQuery({ text: "Minimum 3 players needed!", show_alert: true });
    
    gameManager.moveToThemeSelection(chatId);
    if (lobby.pinnedMessageId) {
        try { await bot.api.unpinChatMessage(chatId, lobby.pinnedMessageId); } catch(e) {}
    }
    
    const themes = gameManager.getAvailableThemes();
    const keyboard = new InlineKeyboard();
    themes.forEach(theme => keyboard.text(theme, `theme_${theme}`).row());
    
    await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🕵️‍♂️ Host <b>${escapeHTML(lobby.host.first_name)}</b>, please choose a theme for this match:`, { reply_markup: keyboard, parse_mode: 'HTML' });
  }
  else if (data.startsWith('theme_')) {
    if (!isHost) return ctx.answerCallbackQuery({ text: "Only the host can select the theme!", show_alert: true });
    if (lobby.state !== 'THEME_SELECTION') return ctx.answerCallbackQuery("Not the time for this!");
    
    const themeName = data.replace('theme_', '');
    await ctx.answerCallbackQuery("Theme locked in!");
    
    try { await bot.api.editMessageReplyMarkup(chatId, ctx.callbackQuery.message.message_id, { reply_markup: new InlineKeyboard() }); } catch(e) {}
    
    const gSettings = await sb.getGroupSettings(chatId);
    await gameManager.startGame(chatId, themeName, bot, gSettings);
    
    // 60s Clue Timer for Standard Mode
    if (lobby) {
        lobby.clueTimer = setTimeout(() => handleStandardClueTimeout(chatId), 60000);
    }
    
    let text = `🕵️‍♂️ <b>Clue Phase Started!</b> 🕵️‍♂️\n\nCheck your DMs to see your secret word and reply with your ${gSettings.clue_words === 1 ? '1-word' : `1-${gSettings.clue_words} word`} clue!\n⏳ <b>Time: 60s</b>\n\n<b>Status:</b>\n`;
    lobby.players.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; });
    
    try {
        const msg = await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
        lobby.clueStatusMessageId = msg.message_id;
    } catch(e) {}
  }
  else if (data.startsWith('vote_')) {
    if (lobby.state !== 'VOTING') return ctx.answerCallbackQuery("It's not voting time.");
    if (!lobby.players.find(p => p.id === user.id)) return ctx.answerCallbackQuery("You aren't playing in this match.");
    if (lobby.votes[user.id]) return ctx.answerCallbackQuery("You already voted!");
    
    const targetId = parseInt(data.replace('vote_', ''));
    const targetPlayer = lobby.players.find(p => p.id === targetId);
    
    const voteResult = gameManager.vote(chatId, user.id, targetId);
    if (voteResult) {
      ctx.answerCallbackQuery("Your vote is recorded!");
      if (!lobby.anonymousVoting) {
        await bot.api.sendMessage(chatId, `🗳️ <a href="tg://user?id=${user.id}">${escapeHTML(user.first_name)}</a> publicly voted for <a href="tg://user?id=${targetPlayer.id}">${escapeHTML(targetPlayer.first_name)}</a>!`, { parse_mode: 'HTML' });
      } else {
        await bot.api.sendMessage(chatId, `🗳️ A vote has been cast! (${Object.keys(lobby.votes).length}/${lobby.players.length})`, { parse_mode: 'HTML' });
      }
      if (voteResult.allVoted) {
        if (lobby.voteTimer) { clearTimeout(lobby.voteTimer); lobby.voteTimer = null; }
        await tallyVotes(chatId);
      }
    }
  }
});

// ==================== GAME OF LIES HELPERS ====================

async function startLiesRound(chatId) {
    const lobby = liesManager.getLobby(chatId);
    if (!lobby) return;
    console.log(`[LIES] Starting Round ${lobby.round + 1} for chat ${chatId}`);

    if (lobby.timer) { clearTimeout(lobby.timer); lobby.timer = null; }

    const next = liesManager.nextRound(chatId);
    if (next.type === 'END') return endLiesGame(chatId);

    for (const p of lobby.players) {
        try {
            let msg = `🤥 <b>Round ${lobby.round}/${lobby.totalRounds} — Game of Lies</b>\n\n` +
                      `❓ <b>Question:</b> ${escapeHTML(next.question)}\n\n`;
            
            if (lobby.round === 1) {
                msg += `<b>Quick Rules:</b>\n- Reply with <b>Correct Answer</b> for +1 pt.\n- Reply with a <b>Wrong Answer</b> to bait a steal.\n- Type <b>'steal'</b> to take points (+2 if they are right, -2 if not).\n\n`;
            }
            
            msg += `⏳ 90 seconds to reply!`;
            
            await bot.api.sendMessage(p.id, msg, { parse_mode: 'HTML' });
        } catch(e) {
            await bot.api.sendMessage(chatId, `⚠️ Could not DM <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>. Match cancelled.`, { parse_mode: 'HTML' });
            liesManager.deleteLobby(chatId);
            return;
        }
    }

    lobby.timer = setTimeout(() => handleLiesTimeout(chatId), 90000);
}

async function handleLiesTimeout(chatId) {
    const lobby = liesManager.getLobby(chatId);
    if (!lobby || lobby.state !== 'QUIZ_PHASE') return;

    // Auto-submit 'wrong' for whoever didn't submit
    for (const p of lobby.players) {
        if (!lobby.submissions[p.id]) {
            liesManager.submitChoice(p.id, 'answer', "TIMEOUT_AFK");
        }
    }
    await processLiesResults(chatId);
}

async function processLiesResults(chatId) {
    const lobby = liesManager.getLobby(chatId);
    if (!lobby || (lobby.state !== 'QUIZ_PHASE' && lobby.state !== 'RESULTS_SEQUENTIAL')) return;
    if (lobby.timer) { clearTimeout(lobby.timer); lobby.timer = null; }
    lobby.state = 'RESULTS_SEQUENTIAL'; 

    const data = liesManager.calculateResults(chatId);
    const p1 = lobby.players[0];
    const p2 = lobby.players[1];
    const r1 = data.results[p1.id];
    const r2 = data.results[p2.id];

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 1. Reveal Question
    await bot.api.sendMessage(chatId, `🤥 <b>Round ${lobby.round} Reveal!</b>\n\n❓ Question: <i>${escapeHTML(lobby.currentQuestion.q)}</i>`, { parse_mode: 'HTML' });
    await sleep(2500);

    // 2. Reveal P1 Response
    const v1 = r1.action === 'steal' ? 'STEAL 😈' : (r1.value === 'timeout_afk' ? 'NO RESPONSE ⏳' : `"${escapeHTML(r1.value)}"`);
    await bot.api.sendMessage(chatId, `👤 <a href="tg://user?id=${p1.id}">${escapeHTML(p1.first_name)}</a> sent: <b>${v1}</b>`, { parse_mode: 'HTML' });
    await sleep(2000);

    // 3. Reveal P2 Response
    const v2 = r2.action === 'steal' ? 'STEAL 😈' : (r2.value === 'timeout_afk' ? 'NO RESPONSE ⏳' : `"${escapeHTML(r2.value)}"`);
    await bot.api.sendMessage(chatId, `👤 <a href="tg://user?id=${p2.id}">${escapeHTML(p2.first_name)}</a> sent: <b>${v2}</b>`, { parse_mode: 'HTML' });
    await sleep(2000);

    // 4. Reveal Answer and Verdict
    let verdict = "";
    if (r1.points === 1 && r2.points === 1) verdict = "Both correct! +1 each.";
    else if (r1.points === 2) verdict = `🔥 ${escapeHTML(p1.first_name)} STOLE the points! +2`;
    else if (r2.points === 2) verdict = `🔥 ${escapeHTML(p2.first_name)} STOLE the points! +2`;
    else if (r1.points === -2 && r2.points === -2) verdict = "Both failed to steal! -2 each.";
    else if (r1.points === -2) verdict = `❌ ${escapeHTML(p1.first_name)} failed to steal! -2`;
    else if (r2.points === -2) verdict = `❌ ${escapeHTML(p2.first_name)} failed to steal! -2`;
    else if (r1.points === 1) verdict = `✅ ${escapeHTML(p1.first_name)} got it right! +1`;
    else if (r2.points === 1) verdict = `✅ ${escapeHTML(p2.first_name)} got it right! +1`;
    else verdict = "Both wrong! 0 points.";

    await bot.api.sendMessage(chatId, `🏏 <b>Answer:</b> ${escapeHTML(data.question)}\n\n📝 <b>Verdict:</b> ${verdict}`, { parse_mode: 'HTML' });
    await sleep(2000);

    // 5. Scoreboard
    let scoreboard = `📊 <b>Current Scores:</b>\n` +
                    `🏏 ${escapeHTML(p1.first_name)}: <b>${data.scores[p1.id]}</b>\n` +
                    `🏏 ${escapeHTML(p2.first_name)}: <b>${data.scores[p2.id]}</b>`;
    
    const dmKb = new InlineKeyboard().url("📩 Go to Bot DM", `https://t.me/${bot.botInfo.username}`);
    if (lobby.round < lobby.totalRounds) {
        await bot.api.sendMessage(chatId, scoreboard + `\n\nNext round starting in 5 seconds...`, { parse_mode: 'HTML', reply_markup: dmKb });
        setTimeout(() => startLiesRound(chatId).catch(console.error), 5000);
    } else {
        await bot.api.sendMessage(chatId, scoreboard, { parse_mode: 'HTML' });
        await endLiesGame(chatId);
    }
}

async function endLiesGame(chatId) {
    const lobby = liesManager.getLobby(chatId);
    if (!lobby) return;

    const p1 = lobby.players[0];
    const p2 = lobby.players[1];
    const s1 = lobby.scores[p1.id];
    const s2 = lobby.scores[p2.id];

    let winnerText = "";
    if (s1 > s2) winnerText = `🏆 <b>WINNER: <a href="tg://user?id=${p1.id}">${escapeHTML(p1.first_name)}</a>!</b>`;
    else if (s2 > s1) winnerText = `🏆 <b>WINNER: <a href="tg://user?id=${p2.id}">${escapeHTML(p2.first_name)}</a>!</b>`;
    else winnerText = `⚖️ <b>IT'S A DRAW!</b>`;

    await bot.api.sendMessage(chatId, `🏁 <b>Game of Lies Finished!</b>\n\nFinal Scores:\n- ${escapeHTML(p1.first_name)}: ${s1}\n- ${escapeHTML(p2.first_name)}: ${s2}\n\n${winnerText}`, { parse_mode: 'HTML' });
    
    // Record stats
    if (sb.supabase) {
        if (s1 > s2) { sb.recordWin(p1.id, p1.first_name, chatId); sb.recordLoss(p2.id, p2.first_name, chatId); }
        else if (s2 > s1) { sb.recordWin(p2.id, p2.first_name, chatId); sb.recordLoss(p1.id, p1.first_name, chatId); }
        else { sb.recordLoss(p1.id, p1.first_name, chatId); sb.recordLoss(p2.id, p2.first_name, chatId); }
    }

    liesManager.deleteLobby(chatId);
}

async function startVotingPhase(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby) return;
    
    const gSettings = await sb.getGroupSettings(chatId);
    lobby.state = 'VOTING';
    lobby.anonymousVoting = gSettings.anonymous_voting;
    const keyboard = new InlineKeyboard();
    lobby.players.forEach(p => keyboard.text(`👉 Vote: ${p.first_name}`, `vote_${p.id}`).row());
    
    const voteLabel = gSettings.anonymous_voting ? '(Anonymous Mode 🔒)' : '';
    await bot.api.sendMessage(chatId, `🗳️ <b>VOTING TIME!</b> ${voteLabel}\n\nYou have ${gSettings.voting_time} seconds to lock in your vote below. One vote per player!`, { reply_markup: keyboard, parse_mode: 'HTML' });
    
    lobby.voteTimer = setTimeout(() => handleVotingTimeout(chatId).catch(console.error), gSettings.voting_time * 1000);
}

async function handleVotingTimeout(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby || lobby.state !== 'VOTING') return;

    await bot.api.sendMessage(chatId, "⏰ <b>Voting time is up!</b> Calculating results...", { parse_mode: 'HTML' });
    await tallyVotes(chatId);
}

async function handleStandardClueTimeout(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby || lobby.state !== 'CLUE_PHASE') return;
    lobby.clueTimer = null;

    const afkPlayers = lobby.players.filter(p => !lobby.cluesReceived[p.id]);
    if (afkPlayers.length === 0) return;

    let elimText = `⏰ <b>TIME'S UP!</b>\n\nThe following players didn't submit a clue and have been eliminated (AFK):\n\n`;
    for (const p of afkPlayers) {
        const isImpostor = p.id === lobby.impostorId;
        gameManager.eliminatePlayer(chatId, p.id);
        elimText += `💤 <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a> — ${isImpostor ? '🔫 Impostor' : '👤 Civilian'}\n`;
    }

    await bot.api.sendMessage(chatId, elimText, { parse_mode: 'HTML' });

    const win = gameManager.checkWinCondition(chatId);
    if (win) {
        let winText = "";
        if (win === 'MAJORITY_WIN') {
            winText = `🎉 <b>THE MAJORITY WINS!</b>\nThe Impostor was eliminated for being AFK.`;
        } else {
            winText = `🤯 <b>THE IMPOSTOR WINS!</b>\nToo many Civilians were AFK!`;
        }
        await bot.api.sendMessage(chatId, winText, { parse_mode: 'HTML' });
        gameManager.deleteLobby(chatId);
        return;
    }

    // Proceed to discussion
    lobby.state = 'DISCUSSION';
    let clueText = `🕵️‍♂️ <b>Clues Revealed!</b>\n\n`;
    lobby.players.forEach(p => {
        clueText += `- <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>: <b>${escapeHTML(lobby.cluesReceived[p.id] || '—')}</b>\n`;
    });
    const gSettings = await sb.getGroupSettings(chatId);
    clueText += `\n💬 <b>DISCUSSION PHASE:</b> You now have exactly ${gSettings.discussion_time} seconds to discuss!`;
    await bot.api.sendMessage(chatId, clueText, { parse_mode: 'HTML' });
    setTimeout(async () => {
       const cl = gameManager.getLobby(chatId);
       if (cl && cl.state === 'DISCUSSION') await startVotingPhase(chatId);
    }, gSettings.discussion_time * 1000);
}


async function tallyVotes(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby || lobby.state !== 'VOTING') return;
    
    lobby.state = 'TALLY'; 
    const results = gameManager.getVotingResults(chatId);
    const impostorPlayer = lobby.players.find(p => p.id === lobby.impostorId);
    const impostorName = impostorPlayer ? `<a href="tg://user?id=${impostorPlayer.id}">${escapeHTML(impostorPlayer.first_name)}</a>` : 'The Impostor';
    
    if (Object.keys(lobby.votes).length === 0 || results.tie) {
        processGameEnd(lobby, 'IMPOSTOR');
        let msg = Object.keys(lobby.votes).length === 0 ? "⚖️ <b>NO ONE VOTED!</b>" : "⚖️ <b>IT'S A TIE VOTE!</b>";
        await bot.api.sendMessage(chatId, `${msg}\n\nSince the group couldn't agree, the Impostor survives and perfectly blended in!\n\n(The Impostor was actually ${impostorName} with the word: <i>${escapeHTML(lobby.wordB)}</i>!)\n\n<b>THE IMPOSTOR WINS!</b>`, { parse_mode: 'HTML' });
        gameManager.deleteLobby(chatId);
        return;
    } 

    const votedPlayer = lobby.players.find(p => p.id === results.votedOutId);
    const isImpostorEliminated = results.votedOutId === lobby.impostorId;
    
    if (!isImpostorEliminated) {
       processGameEnd(lobby, 'IMPOSTOR');
       await bot.api.sendMessage(chatId, `❌ <b>WRONG VOTE!</b>\n\nThe group voted out <a href="tg://user?id=${votedPlayer.id}">${escapeHTML(votedPlayer.first_name)}</a>, but they were innocent! Their word was <b>${escapeHTML(lobby.wordA)}</b> just like everyone else!\n\n<b>THE IMPOSTOR SURVIVES AND WINS!</b>\n(The Impostor was actually ${impostorName} with the word: <i>${escapeHTML(lobby.wordB)}</i>)`, { parse_mode: 'HTML' });
       gameManager.deleteLobby(chatId);
    } else {
       const gSettings = await sb.getGroupSettings(chatId);
       lobby.state = 'IMPOSTOR_GUESS';
       await bot.api.sendMessage(chatId, `🎯 <b>CORRECT VOTE!</b>\n\nBrilliant deduction! You caught the Impostor: <a href="tg://user?id=${votedPlayer.id}">${escapeHTML(votedPlayer.first_name)}</a>! (Their unique word was <tg-spoiler>${escapeHTML(lobby.wordB)}</tg-spoiler>).\n\n🚨 <b>BUT WAIT...</b>\n<a href="tg://user?id=${votedPlayer.id}">${escapeHTML(votedPlayer.first_name)}</a>, you have exactly ONE CHANCE. Type what you think the group's word was right down here in the chat to steal the win! (You have ${gSettings.impostor_guess_time} seconds!)`, { parse_mode: 'HTML' });
       
       setTimeout(async () => {
          const currentLobby = gameManager.getLobby(chatId);
          if (currentLobby && currentLobby.state === 'IMPOSTOR_GUESS') {
             lobby.state = 'END';
             processGameEnd(currentLobby, 'MAJORITY');
             await bot.api.sendMessage(chatId, `⏳ <b>TIME IS UP!</b>\n\nThe Impostor failed to guess the word in time.\nThe real word was <b>${escapeHTML(currentLobby.wordA)}</b>.\n\n🎉 <b>THE MAJORITY WINS!</b>`, { parse_mode: 'HTML' });
             gameManager.deleteLobby(chatId);
          }
       }, gSettings.impostor_guess_time * 1000);
    }
}

async function updateLobbyMessage(chatId, lobby, messageId) {
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "join_game")
    .text("❌ Leave", "leave_game")
    .row()
    .text("▶️ Start (Host only)", "start_game");
  let text = `🕵️‍♂️ <b>Undercover Lobby</b> 🕵️‍♂️\n\nHost: <a href="tg://user?id=${lobby.host.id}">${escapeHTML(lobby.host.first_name)}</a>\nPlayers joined: ${lobby.players.length} (Minimum 3 required)\n\n`;
  lobby.players.forEach((p, idx) => { text += `${idx + 1}. <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; });
  try { await bot.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'HTML' }); }
  catch (error) { if (!error.message.includes("is not modified")) console.error(error); }
}

async function updateMafiaLobbyMessage(chatId, lobby, messageId) {
  const dist = mafiaManager.getRoleDist(lobby.players.length);
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "maf_join").text("❌ Leave", "maf_leave").row()
    .text("▶️ Start (Host only)", "maf_start");
  let text = `🔫 <b>Mafia Lobby</b> 🔫\n\nHost: <a href="tg://user?id=${lobby.host.id}">${escapeHTML(lobby.host.first_name)}</a>\nPlayers: ${lobby.players.length} (Minimum 3 required)\nRoles: ${dist.impostors} Impostor${dist.impostors > 1 ? 's' : ''} | ${dist.joker} Joker\n\n`;
  lobby.players.forEach((p, idx) => { text += `${idx + 1}. <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; });
  try { await bot.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'HTML' }); }
  catch (error) { if (!error.message.includes("is not modified")) console.error(error); }
}

async function handleClueTimeout(chatId) {
  const lobby = mafiaManager.getLobby(chatId);
  if (!lobby || lobby.state !== 'CLUE_PHASE') return;
  lobby.clueTimer = null;

  // Find players who didn't submit
  const afkPlayers = lobby.alivePlayers.filter(p => !lobby.cluesReceived[p.id]);
  if (afkPlayers.length === 0) return; // everyone submitted in time

  const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
  let elimText = `⏰ <b>TIME'S UP!</b>\n\nThe following players didn't submit a clue and have been eliminated:\n\n`;

  for (const p of afkPlayers) {
    const role = lobby.roles[p.id];
    mafiaManager.eliminatePlayer(chatId, p.id);
    elimText += `💤 <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a> — ${RE[role]} ${role.charAt(0) + role.slice(1).toLowerCase()}`;
    if (role === 'IMPOSTOR') elimText += ` (Their word was: <tg-spoiler>${escapeHTML(lobby.wordB)}</tg-spoiler>)`;
    elimText += `\n`;
  }

  elimText += `\n👥 <b>Alive:</b> ${lobby.alivePlayers.length} players remaining`;
  await bot.api.sendMessage(chatId, elimText, { parse_mode: 'HTML' });

  // Check win condition after eliminations
  const win = mafiaManager.checkWinCondition(chatId);
  if (win) return endMafiaGame(chatId, win);

  // If not enough alive players to continue, end
  if (lobby.alivePlayers.length < 2) {
    return endMafiaGame(chatId, 'CIVILIAN_WIN');
  }

  // Proceed to discussion with whoever did submit
  lobby.state = 'DISCUSSION';
  let clueText = `🔫 <b>Round ${lobby.round} — Clues Revealed!</b>\n\n`;
  lobby.alivePlayers.forEach(p => {
    clueText += `- <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>: <b>${escapeHTML(lobby.cluesReceived[p.id] || '—')}</b>\n`;
  });
  const dt = lobby.settings.discussion_time || 90;
  clueText += `\n💬 <b>DISCUSSION:</b> ${dt} seconds to discuss!`;
  await bot.api.sendMessage(chatId, clueText, { parse_mode: 'HTML' });
  setTimeout(async () => {
    const cl = mafiaManager.getLobby(chatId);
    if (cl && cl.state === 'DISCUSSION') await startMafiaVoting(chatId);
  }, dt * 1000);
}

async function startMafiaVoting(chatId) {
  const lobby = mafiaManager.getLobby(chatId);
  if (!lobby) return;
  const gs = lobby.settings;
  lobby.state = 'VOTING';
  lobby.anonymousVoting = gs.anonymous_voting || false;
  const kb = new InlineKeyboard();
  lobby.alivePlayers.forEach(p => kb.text(`👉 ${p.first_name}`, `mafv_${p.id}`).row());
  const vl = gs.anonymous_voting ? '(Anonymous 🔒)' : '';
  await bot.api.sendMessage(chatId, `🗳️ <b>VOTE NOW!</b> ${vl}\n\nWho has a different word? You have ${gs.voting_time || 60} seconds!`, { reply_markup: kb, parse_mode: 'HTML' });
  setTimeout(async () => {
    const cl = mafiaManager.getLobby(chatId);
    if (cl && cl.state === 'VOTING') await tallyMafiaVotes(chatId);
  }, (gs.voting_time || 60) * 1000);
}

async function tallyMafiaVotes(chatId) {
  const lobby = mafiaManager.getLobby(chatId);
  if (!lobby || lobby.state !== 'VOTING') return;
  lobby.state = 'TALLY';
  const results = mafiaManager.getVotingResults(chatId);

  if (Object.keys(lobby.votes).length === 0 || results.tie) {
    const msg = Object.keys(lobby.votes).length === 0 ? "⚖️ <b>NO ONE VOTED!</b>" : "⚖️ <b>TIE VOTE!</b>";
    await bot.api.sendMessage(chatId, `${msg}\n\nNo one was eliminated this round.`, { parse_mode: 'HTML' });
    const win = mafiaManager.checkWinCondition(chatId);
    if (win) return endMafiaGame(chatId, win);
    return setTimeout(() => startNextMafiaRound(chatId), 3000);
  }

  const { player: votedP, role } = mafiaManager.eliminatePlayer(chatId, results.votedOutId);
  const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
  let elimText = '';

  if (role === 'JOKER') {
    lobby.jokerWon = true;
    elimText = `🃏 <b>THE JOKER WINS!</b> 🃏\n\n<a href="tg://user?id=${votedP.id}">${escapeHTML(votedP.first_name)}</a> was the <b>Joker</b>! They WANTED to get voted out and pulled it off!\n\n🎭 The Joker takes the victory — game over!`;
    await bot.api.sendMessage(chatId, elimText, { parse_mode: 'HTML' });
    return endMafiaGame(chatId, 'JOKER_WIN');
  } else if (role === 'IMPOSTOR') {
    elimText = `✅ <b>IMPOSTOR CAUGHT!</b>\n\n<a href="tg://user?id=${votedP.id}">${escapeHTML(votedP.first_name)}</a> was an <b>Impostor</b>! ${RE[role]}\n🔑 Their word was: <tg-spoiler>${escapeHTML(lobby.wordB)}</tg-spoiler>`;
  } else {
    elimText = `❌ <b>WRONG TARGET!</b>\n\n<a href="tg://user?id=${votedP.id}">${escapeHTML(votedP.first_name)}</a> was a <b>Civilian</b>! ${RE[role]}\nThe impostors are still among you...`;
  }
  elimText += `\n\n👥 <b>Alive:</b> ${lobby.alivePlayers.length} players remaining`;
  await bot.api.sendMessage(chatId, elimText, { parse_mode: 'HTML' });

  const win = mafiaManager.checkWinCondition(chatId);
  if (win) return endMafiaGame(chatId, win);
  setTimeout(() => startNextMafiaRound(chatId), 3000);
}

async function startNextMafiaRound(chatId) {
  const lobby = mafiaManager.getLobby(chatId);
  if (!lobby) return;
  await bot.api.sendMessage(chatId, `🔫 <b>Round ${lobby.round + 1} starting...</b> New words incoming!`, { parse_mode: 'HTML' });
  const ok = await mafiaManager.startRound(chatId, bot);
  if (!ok) return;
  const me = bot.botInfo || await bot.api.getMe();
  const dmKb = new InlineKeyboard().url("📩 Go to Bot DM", `https://t.me/${me.username}`);
  let text = `🔫 <b>Round ${lobby.round} — Clue Phase</b>\n\nCheck your DMs and reply with your clue! ⏰ <b>60 seconds!</b>\n\n<b>Status:</b>\n`;
  lobby.alivePlayers.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a>\n`; });
  try { const msg = await bot.api.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: dmKb }); lobby.clueStatusMessageId = msg.message_id; } catch(e) {}
  lobby.clueTimer = setTimeout(() => handleClueTimeout(chatId), 60000);
}

async function endMafiaGame(chatId, result) {
  const lobby = mafiaManager.getLobby(chatId);
  if (!lobby) return;
  lobby.state = 'END';

  const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
  let header = '';

  if (result === 'JOKER_WIN') {
    header = '🃏 <b>GAME OVER — JOKER WINS!</b> 🃏\n\nThe Joker got voted out and stole the game!';
  } else if (result === 'CIVILIAN_WIN') {
    header = '🎉 <b>GAME OVER — CIVILIANS WIN!</b> 🎉\n\nAll impostors have been found and eliminated!';
  } else {
    header = '🔫 <b>GAME OVER — IMPOSTORS WIN!</b> 🔫\n\nThe impostors outnumbered the civilians!';
  }

  // Determine winners and losers
  const winners = [];
  const losers = [];
  lobby.players.forEach(p => {
    const r = lobby.roles[p.id];
    const alive = lobby.alivePlayers.some(ap => ap.id === p.id);
    let isWinner = false;
    if (result === 'JOKER_WIN') isWinner = r === 'JOKER';
    else if (result === 'CIVILIAN_WIN') isWinner = r === 'CIVILIAN';
    else isWinner = r === 'IMPOSTOR';

    const status = alive ? 'Survived' : 'Eliminated';
    const entry = `${RE[r]} <a href="tg://user?id=${p.id}">${escapeHTML(p.first_name)}</a> — ${r.charAt(0) + r.slice(1).toLowerCase()} (${status})`;
    if (isWinner) winners.push(entry);
    else losers.push(entry);
  });

  let msg = header;
  msg += `\n\n🏆 <b>WINNERS:</b>\n`;
  winners.forEach(w => { msg += `${w} ✅\n`; });
  msg += `\n💀 <b>LOSERS:</b>\n`;
  losers.forEach(l => { msg += `${l} ❌\n`; });
  msg += `\n🔄 <b>Rounds Played:</b> ${lobby.round}`;

  await bot.api.sendMessage(chatId, msg, { parse_mode: 'HTML' });
  processMafiaGameEnd(lobby, result);
  mafiaManager.deleteLobby(chatId);
}

function processMafiaGameEnd(lobby, result) {
  if (!sb.supabase) return;
  lobby.players.forEach(p => {
    const r = lobby.roles[p.id];
    let won = false;
    if (result === 'JOKER_WIN') won = r === 'JOKER';
    else if (r === 'JOKER') won = false;
    else if (r === 'IMPOSTOR') won = result === 'IMPOSTOR_WIN';
    else won = result === 'CIVILIAN_WIN';
    if (won) sb.recordWin(p.id, p.first_name, lobby.chatId);
    else sb.recordLoss(p.id, p.first_name, lobby.chatId);
  });
}

bot.catch((err) => {
  // Ignore stale callback query errors (e.g. after redeploy/restart)
  if (err.error?.error_code === 400 && err.error?.description?.includes('query is too old')) return;
  console.error(`Error in update ${err.ctx?.update?.update_id}:`, err.error);
});

const express = require('express');
const app = express();
app.use(express.json());

const cricketImageCache = new Map();
const crickidexPlayersDir = path.join(__dirname, 'assets', 'players');

try {
    if (fs.existsSync(crickidexPlayersDir)) {
        const files = fs.readdirSync(crickidexPlayersDir);
        files.forEach(file => {
            if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.jpeg')) {
                cricketImageCache.set(file.toLowerCase(), file);
            }
        });
        console.log(`[Shop] Cached ${cricketImageCache.size} player images from Crickidex.`);
    } else {
        console.warn(`[Shop] Crickidex players directory not found at: ${crickidexPlayersDir}`);
    }
} catch (error) {
    console.error('[Shop] Error building image cache:', error);
}

// Helper to resolve player name to local filesystem path
function getCricketPlayerLocalImagePath(name) {
    if (!name) return null;
    
    // 1. Try formatted First_Last.jpg
    const formattedName = name.trim().replace(/\s+/g, '_').toLowerCase();
    const filenameJpg = `${formattedName}.jpg`;
    if (cricketImageCache.has(filenameJpg)) {
        return path.join(crickidexPlayersDir, cricketImageCache.get(filenameJpg));
    }
    
    // 2. Try removing special characters
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
    const cleanFilenameJpg = `${cleanName}.jpg`;
    if (cricketImageCache.has(cleanFilenameJpg)) {
        return path.join(crickidexPlayersDir, cricketImageCache.get(cleanFilenameJpg));
    }

    // 3. Try matches in filename list where the filename contains all parts of the name
    const nameParts = formattedName.split('_');
    if (nameParts.length > 0) {
        for (const [key, value] of cricketImageCache.entries()) {
            if (nameParts.every(part => key.includes(part))) {
                return path.join(crickidexPlayersDir, value);
            }
        }
    }
    
    return null;
}

// Helper to resolve player name to static image URL
function getCricketPlayerImageUrl(name) {
    if (!name) return null;
    
    // 1. Try formatted First_Last.jpg
    const formattedName = name.trim().replace(/\s+/g, '_').toLowerCase();
    const filenameJpg = `${formattedName}.jpg`;
    if (cricketImageCache.has(filenameJpg)) {
        return `/assets/players/${filenameJpg}`;
    }
    
    // 2. Try removing special characters
    const cleanName = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_').toLowerCase();
    const cleanFilenameJpg = `${cleanName}.jpg`;
    if (cricketImageCache.has(cleanFilenameJpg)) {
        return `/assets/players/${cleanFilenameJpg}`;
    }

    // 3. Try matches in filename list where the filename contains all parts of the name
    const nameParts = formattedName.split('_');
    if (nameParts.length > 0) {
        for (const [key] of cricketImageCache.entries()) {
            if (nameParts.every(part => key.includes(part))) {
                return `/assets/players/${key}`;
            }
        }
    }
    
    return null;
}

app.get('/assets/players/:filename', (req, res) => {
    const requested = req.params.filename.toLowerCase();
    const actualFile = cricketImageCache.get(requested);
    if (actualFile) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
        res.sendFile(path.join(crickidexPlayersDir, actualFile));
    } else {
        res.status(404).send('Not found');
    }
});

app.get('/api/cards/:playerId.jpg', async (req, res) => {
    const { playerId } = req.params;
    try {
        const cricketFromDb = await sb.getCricketPlayers();
        const player = cricketFromDb.find(p => p.id === playerId);
        if (!player) {
            return res.status(404).send('Player not found');
        }
        const cardPath = await getOrGeneratePlayerCardPath(player);
        const stat = fs.statSync(cardPath);
        res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour browser cache
        res.setHeader('ETag', `W/"${stat.size}-${stat.mtimeMs}"`);
        res.sendFile(cardPath);
    } catch (error) {
        console.error('Error serving card image:', error);
        res.status(500).send('Error serving card');
    }
});

app.get('/', (req, res) => res.redirect('/cricket'));

// Serve cricket static files with caching (7 days for JS/CSS assets)
app.use('/cricket', express.static(path.join(__dirname, 'public', 'cricket'), {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour for HTML
        } else {
            res.setHeader('Cache-Control', 'public, max-age=604800, immutable'); // 7 days for JS/CSS
        }
    }
}));
app.get('/cricket', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, 'public', 'cricket', 'index.html'));
});

// Serve Mini App (Adsgram) with short cache (1 hour)
app.get('/bonus-app', (req, res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Reward Endpoint
app.get('/api/reward', async (req, res) => {
    const { user_id, msg_id, chat_id } = req.query;
    if (!user_id || !msg_id) return res.status(400).send('Missing params');

    try {
        const userId = parseInt(user_id);
        const msgId = parseInt(msg_id);
        const chatId = chat_id ? parseInt(chat_id) : userId;

        // 0. Strict server-side cooldown check to prevent multi-click abuse
        const lastClaim = claimCooldowns.get(userId) || 0;
        if (Date.now() - lastClaim < 60 * 60 * 1000) {
            return res.status(429).send('Cooldown active');
        }

        // 1. Update Cooldowns
        claimCooldowns.set(userId, Date.now());
        dropCooldowns.set(userId, Date.now());

        // 2. Record Claim in DB
        await sb.recordBonusClaim(userId).catch(e => console.error("Failed to record claim:", e));

        // 3. Give Random Coins
        const amount = getRandomReward();
        const newBal = await sb.addCoins(userId, amount);
        
        // 4. Schedule Reminder (1 hour from now)
        pendingReminders.set(userId, Date.now() + (60 * 60 * 1000));
        
        // 5. Edit Bot Message automatically (Removes the button)
        if (msgId && msgId !== 0) {
            const profile = await sb.getProfile(userId);
            const userName = profile ? escapeHTML(profile.first_name) : "User";
            await bot.api.editMessageText(chatId, msgId, 
                `✅ <b>Mystery Drop Claimed!</b>\n\n<a href="tg://user?id=${userId}">${userName}</a> earned <b>${amount}</b> coins!`,
                { parse_mode: 'HTML' }
            ).catch(e => console.error("Edit failed:", e));
        }

        res.json({ success: true, amount, newBal });
    } catch (error) {
        console.error('Reward error:', error);
        res.status(500).send('error');
    }
});

// Mystery Player Drop Endpoint (Watch Ad → Get a random cricket player)
app.get('/api/drop-player', async (req, res) => {
    const { user_id, msg_id, chat_id } = req.query;
    if (!user_id || !msg_id) return res.status(400).send('Missing params');

    try {
        const userId = parseInt(user_id);
        const msgId = parseInt(msg_id);
        const chatId = chat_id ? parseInt(chat_id) : userId;

        // 0. Strict server-side cooldown check
        const lastClaim = claimCooldowns.get(userId) || 0;
        if (Date.now() - lastClaim < 60 * 60 * 1000) {
            return res.status(429).json({ success: false, error: 'Cooldown active' });
        }

        // 1. Update cooldowns
        claimCooldowns.set(userId, Date.now());
        dropCooldowns.set(userId, Date.now());

        // 2. Record claim
        await sb.recordBonusClaim(userId).catch(e => console.error("Failed to record drop claim:", e));

        // 3. Schedule reminder
        pendingReminders.set(userId, Date.now() + (60 * 60 * 1000));

        // 4. Get all cricket players + user's owned list
        const allPlayers = await sb.getCricketPlayers();
        const ownedRecords = await sb.getUserOwnedPlayers(userId);
        const ownedCricketIds = ownedRecords.filter(o => o.sport === 'cricket').map(o => o.player_id);
        const ownedCount = ownedCricketIds.length;

        // 5. Pick a random player via weighted OVR selection
        const pickedPlayer = getRandomPlayerDrop(allPlayers, ownedCricketIds);

        const profile = await sb.getProfile(userId);
        const userName = profile ? escapeHTML(profile.first_name) : "User";

        // 6. If no unowned player available or squad is full (25), fall back to coins
        if (!pickedPlayer || ownedCount >= 25) {
            const coinAmount = getRandomReward();
            const newBal = await sb.addCoins(userId, coinAmount);

            if (msgId && msgId !== 0) {
                await bot.api.editMessageText(chatId, msgId,
                    `✅ <b>Mystery Drop Claimed!</b>\n\n<a href="tg://user?id=${userId}">${userName}</a> earned <b>${coinAmount}</b> coins!\n\n<i>Your squad is full! Sell a player to make room for card drops.</i>`,
                    { parse_mode: 'HTML' }
                ).catch(e => console.error("Edit failed:", e));
            }

            return res.json({
                success: true,
                type: 'coins',
                coinAmount,
                newBal,
                reason: ownedCount >= 25 ? 'squad_full' : 'all_owned'
            });
        }

        // 7. Award the player to the user
        const awardResult = await sb.awardPlayer(userId, pickedPlayer.id, 'cricket');

        if (!awardResult.success && !awardResult.alreadyOwned) {
            return res.status(500).json({ success: false, error: 'Failed to award player' });
        }

        // 8. Build rarity info
        const rarity = getPlayerDropRarity(pickedPlayer.ovr);
        const imageUrl = `/api/cards/${pickedPlayer.id}.jpg`;

        // 9. Edit bot message
        if (msgId && msgId !== 0) {
            await bot.api.editMessageText(chatId, msgId,
                `🃏 <b>Mystery Drop Claimed!</b>\n\n<a href="tg://user?id=${userId}">${userName}</a> received ${rarity.emoji} <b>${escapeHTML(pickedPlayer.name)}</b> (${pickedPlayer.ovr} OVR ${rarity.label})!`,
                { parse_mode: 'HTML' }
            ).catch(e => console.error("Edit failed:", e));
        }

        res.json({
            success: true,
            type: 'player',
            player: {
                id: pickedPlayer.id,
                name: pickedPlayer.name,
                country: pickedPlayer.country,
                role: pickedPlayer.role,
                ovr: pickedPlayer.ovr,
                tier: pickedPlayer.tier || 'Normal',
                image_url: imageUrl
            },
            rarity,
            alreadyOwned: awardResult.alreadyOwned || false
        });

    } catch (error) {
        console.error('Drop player error:', error);
        res.status(500).json({ success: false, error: 'internal error' });
    }
});

// User Stats Endpoint for Mini App
app.get('/api/user-stats', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).send('Missing user_id');

    try {
        const userId = parseInt(user_id);
        const profile = await sb.getProfile(userId);
        if (!profile) return res.status(404).send('User not found');

        const globalRank = await sb.getUserGlobalRank(userId, 'rating');
        const rating = await sb.getUserTeamRating(userId);
        
        const lastClaim = claimCooldowns.get(userId) || 0;
        const remainingMs = (60 * 60 * 1000) - (Date.now() - lastClaim);
        const dropCooldownRemaining = remainingMs > 0 ? remainingMs : 0;

        let spinCooldownRemaining = 0;
        if (profile.last_spin) {
            const lastSpinTime = new Date(profile.last_spin).getTime();
            const spinRemainingMs = (24 * 60 * 60 * 1000) - (Date.now() - lastSpinTime);
            spinCooldownRemaining = spinRemainingMs > 0 ? spinRemainingMs : 0;
        }

        const jackpotPlayerId = '70ab456c-55ca-4ef2-b01b-3228d46c9c39';
        const jackpotClaimed = await sb.checkJackpotClaimed(userId, jackpotPlayerId);

        res.json({
            name: profile.first_name,
            coins: profile.coins || 0,
            wins: profile.wins || 0,
            played: profile.matches_played || 0,
            rank: globalRank || "N/A",
            rating: rating || 0,
            dropCooldown: dropCooldownRemaining,
            spinCooldown: spinCooldownRemaining,
            jackpotClaimed: jackpotClaimed
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).send('error');
    }
});

// Spin Wheel Endpoint
app.get('/api/spin', async (req, res) => {
    const { user_id, is_ad } = req.query;
    if (!user_id) return res.status(400).send('Missing params');

    try {
        const userId = parseInt(user_id);
        const isAdSpin = is_ad === 'true';
        const now = Date.now();

        if (isAdSpin) {
            // Strict 30s server cooldown for ad spins
            const lastAdSpin = adSpinCooldowns.get(userId) || 0;
            if (now - lastAdSpin < 30 * 1000) {
                return res.status(429).json({ success: false, error: 'Cooldown active' });
            }
            adSpinCooldowns.set(userId, now);
        } else {
            // DB persistent cooldown for free spin
            const spinCheck = await sb.checkAndClaimFreeSpin(userId);
            if (!spinCheck.success) {
                return res.status(429).json({ success: false, error: 'Free spin not ready' });
            }
            // Schedule a reminder 24 hours from now
            pendingSpinReminders.set(userId, now + (24 * 60 * 60 * 1000));
        }

        const amount = getRandomSpinReward();
        const isJackpot = amount >= 10000;
        let wonPlayer = false;
        let alreadyOwned = false;
        let newBal = 0;

        if (isJackpot) {
            const jackpotPlayerId = '70ab456c-55ca-4ef2-b01b-3228d46c9c39';
            const hasClaimed = await sb.checkJackpotClaimed(userId, jackpotPlayerId);
            if (hasClaimed) {
                alreadyOwned = true;
                newBal = await sb.addCoins(userId, amount);
            } else {
                const awardRes = await sb.awardPlayer(userId, jackpotPlayerId, 'cricket');
                if (awardRes.success) {
                    wonPlayer = true;
                    await sb.recordJackpotClaim(userId, jackpotPlayerId);
                    let userName = "Player";
                    const profile = await sb.getProfile(userId);
                    if (profile) {
                        if (profile.first_name) userName = profile.first_name;
                        if (awardRes.alreadyOwned) {
                            alreadyOwned = true;
                            newBal = await sb.addCoins(userId, amount);
                        } else {
                            newBal = profile.coins || 0;
                        }
                    } else {
                        try {
                            const chat = await bot.api.getChat(userId);
                            if (chat && chat.first_name) userName = chat.first_name;
                        } catch (e) {}
                        newBal = 0;
                    }

                    // Broadcast jackpot win to the official group chat in the background
                    (async () => {
                        try {
                            const message = `🎉 <b>LUCKY SPIN JACKPOT!</b> 🎉\n\n` +
                                            `👤 <a href="tg://user?id=${userId}">${escapeHTML(userName)}</a> just won 👑 <b>Glenn Maxwell</b> (88 OVR All-Rounder) in the Lucky Spin! 🎡\n\n` +
                                            `Congratulations! 🥳`;
                            try {
                                await bot.api.sendMessage(OFFICIAL_GC_ID, message, { parse_mode: 'HTML' });
                            } catch (e) {
                                console.error(`Failed to send jackpot broadcast to official group:`, e);
                            }
                        } catch (err) {
                            console.error("Error in jackpot broadcast loop:", err);
                        }
                    })();
                } else {
                    newBal = await sb.addCoins(userId, amount);
                }
            }
        } else {
            newBal = await sb.addCoins(userId, amount);
        }

        res.json({ success: true, amount, isJackpot, wonPlayer, alreadyOwned, newBal });
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// Leaderboard Endpoint for Mini App
app.get('/api/leaderboard', async (req, res) => {
    const { sort } = req.query; // 'rating', 'wins', or 'coins'
    const sortBy = (sort === 'wins' || sort === 'coins') ? sort : 'rating';
    
    try {
        const topPlayers = await sb.getGlobalLeaderboard(sortBy);
        const formatted = topPlayers.map(p => ({
            id: p.user_id,
            name: p.first_name,
            coins: p.coins || 0,
            wins: p.wins || 0,
            rating: p.rating || 0
        }));
        res.json(formatted);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).send('error');
    }
});

// Player Shop Endpoints
app.get('/api/shop/players', async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).send('Missing user_id');

    try {
        const userId = parseInt(user_id);
        const owned = await sb.getUserOwnedPlayers(userId);
        const cricketFromDb = await sb.getCricketPlayers();

        const formatCricket = cricketFromDb.map(p => ({
            id: p.id,
            name: p.name,
            country: p.country,
            role: p.role,
            ovr: p.ovr,
            buy_price: p.buy_price,
            tier: p.tier || 'Normal',
            image_url: `/api/cards/${p.id}.jpg`
        }));

        res.json({
            cricket: formatCricket,
            football: footballPlayers,
            owned: owned.map(o => ({ player_id: o.player_id, sport: o.sport }))
        });
    } catch (error) {
        console.error('Shop players error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/api/shop/buy', async (req, res) => {
    const { user_id, player_id, sport } = req.query;
    if (!user_id || !player_id || !sport) {
        return res.status(400).json({ success: false, error: 'Missing parameters' });
    }

    try {
        const userId = parseInt(user_id);
        let price = 0;

        if (sport === 'football') {
            const player = footballPlayers.find(p => p.id === player_id);
            if (!player) return res.status(404).json({ success: false, error: 'Football player not found' });
            price = player.buy_price;
        } else if (sport === 'cricket') {
            const cricketFromDb = await sb.getCricketPlayers();
            const player = cricketFromDb.find(p => p.id === player_id);
            if (!player) return res.status(404).json({ success: false, error: 'Cricket player not found' });
            price = player.buy_price;
        } else {
            return res.status(400).json({ success: false, error: 'Invalid sport' });
        }

        const result = await sb.buyPlayer(userId, player_id, sport, price);
        res.json(result);
    } catch (error) {
        console.error('Shop buy error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// =============================================
// CRICKET TOURNAMENT CAMPAIGN REST API ENDPOINTS
// =============================================

// Get current tournament state
app.get('/api/tournament/state', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const campaign = await campaignStore.getCampaign(userId);
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get teams for edition
app.get('/api/tournament/teams', (req, res) => {
  const { type, edition } = req.query;
  const teams = squadsData[type]?.[edition] || {};
  res.json({ teams });
});

// Start new campaign
app.post('/api/tournament/start', async (req, res) => {
  const { userId, username, type, edition, playerTeam } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const campaign = await tournamentManager.startCampaign(userId, username, type, edition, playerTeam);
    res.json({ campaign });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Start next match in tournament round
app.post('/api/tournament/match/start', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const campaign = await tournamentManager.startNextMatch(userId);
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Play a ball in user match
app.post('/api/tournament/match/play', async (req, res) => {
  const { userId, choice } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    const result = await tournamentManager.playMatchBall(userId, choice);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset current campaign
app.post('/api/tournament/reset', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'Missing userId' });
  try {
    await campaignStore.deleteCampaign(userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =============================================
// CRICKET GAME REST API ENDPOINTS
// =============================================

app.get('/api/match', async (req, res) => {
  const clean = (val) => {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val.toString().trim();
  };

  const userId = clean(req.query.userId);
  const matchId = clean(req.query.matchId);

  if (!userId && !matchId) {
    return res.status(400).json({ error: 'userId or matchId is required' });
  }

  let match = matchManager.getMatch(matchId || userId);
  if (!match) {
    if (sb.supabase && matchId) {
      try {
        const row = await sb.getCricketMatchById(matchId);
        if (row && row.state_json) {
          const deserialized = matchManager.deserializeMatch(row.state_json);
          // Restore to active cache
          matchManager.activeMatches[deserialized.id] = deserialized;
          matchManager.activeMatches[deserialized.host.telegramId] = deserialized;
          if (deserialized.guest && deserialized.guest.telegramId !== 'ai') {
            matchManager.activeMatches[deserialized.guest.telegramId] = deserialized;
          }
          const serialized = serializeMatchState(deserialized, userId);
          return res.json(serialized);
        }
      } catch (err) {
        console.error("Failed to fetch match from Supabase:", err);
      }
    }
    return res.status(404).json({ error: 'No active match found.' });
  }

  const serialized = serializeMatchState(match, userId);
  res.json(serialized);
});

app.post('/api/match/select-players', async (req, res) => {
  const clean = (val) => {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val.toString().trim();
  };

  const { userId, matchId, strikerIdx, nonStrikerIdx, bowlerIdx } = req.body;
  const sanitizedUserId = clean(userId);
  const sanitizedMatchId = clean(matchId);

  if (!sanitizedUserId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  let match = null;
  if (sanitizedMatchId) {
    match = matchManager.getMatch(sanitizedMatchId);
  }
  if (!match) {
    match = matchManager.getActiveMatch(sanitizedUserId);
  }

  // Restore if needed
  if (!match && sanitizedMatchId && sb.supabase) {
    try {
      const row = await sb.getCricketMatchById(sanitizedMatchId);
      if (row && row.state_json) {
        match = matchManager.deserializeMatch(row.state_json);
        matchManager.activeMatches[match.id] = match;
        matchManager.activeMatches[match.host.telegramId] = match;
        if (match.guest && match.guest.telegramId !== 'ai') {
          matchManager.activeMatches[match.guest.telegramId] = match;
        }
      }
    } catch (e) {
      console.error("[API] Failed to restore match during player selection:", e);
    }
  }

  if (!match) {
    console.error(`[API/select-players] No active match found for userId=${sanitizedUserId}, matchId=${sanitizedMatchId}`);
    return res.status(404).json({ error: 'No active match found.' });
  }

  if (match.status !== 'xi_selection') {
    return res.status(400).json({ error: 'Match is not in team selection phase.' });
  }

  if (strikerIdx !== undefined && nonStrikerIdx !== undefined && parseInt(strikerIdx) === parseInt(nonStrikerIdx)) {
    return res.status(400).json({ error: 'Striker and non-striker must be different players!' });
  }

  // Determine current batting team ID
  let battingTeamId = null;
  if (match.currentInningsIdx === 1) {
    battingTeamId = match.innings[1].battingId;
  } else {
    if (match.tossWinnerId && match.host.telegramId) {
      battingTeamId = match.tossWinnerId.toString() === match.host.telegramId.toString()
        ? (match.tossDecision === 'bat' ? match.host.telegramId : match.guest.telegramId)
        : (match.tossDecision === 'bat' ? match.guest.telegramId : match.host.telegramId);
    } else {
      battingTeamId = match.host.telegramId;
    }
  }

  const isBatting = battingTeamId && (battingTeamId.toString() === sanitizedUserId);

  if (isBatting) {
    if (strikerIdx !== undefined) match.strikerIdx = parseInt(strikerIdx);
    if (nonStrikerIdx !== undefined) match.nonStrikerIdx = parseInt(nonStrikerIdx);
    if (match.type === 'pve' && match.bowlingTeam.telegramId === 'ai') {
      match.currentBowlerIdx = 10;
    }
  } else {
    if (bowlerIdx !== undefined) match.currentBowlerIdx = parseInt(bowlerIdx);
    if (match.type === 'pve' && match.battingTeam.telegramId === 'ai') {
      match.strikerIdx = 0;
      match.nonStrikerIdx = 1;
    }
  }

  // If BOTH players have selected their players, start the match/innings!
  if (match.strikerIdx !== null && match.nonStrikerIdx !== null && match.currentBowlerIdx !== null) {
    if (match.currentInningsIdx === 0) {
      match.startFirstInnings({
        strikerIdx: match.strikerIdx,
        nonStrikerIdx: match.nonStrikerIdx,
        bowlerIdx: match.currentBowlerIdx
      });

      if (match.type !== 'pvp') {
        const striker = match.battingTeam.xi[match.strikerIdx];
        const nonStriker = match.battingTeam.xi[match.nonStrikerIdx];
        const bowler = match.bowlingTeam.xi[match.currentBowlerIdx];

        await sendTelegramMessage(match,
          `👉 <b>Striker:</b> <b>${escapeHTML(striker.name)}</b> (${striker.ovr} OVR)\n` +
          `👉 <b>Non-Striker:</b> <b>${escapeHTML(nonStriker.name)}</b> (${nonStriker.ovr} OVR)\n` +
          `👉 <b>Bowler:</b> <b>${escapeHTML(bowler.name)}</b> (${bowler.ovr} OVR)\n\n` +
          `🏏 <b>MATCH STARTED!</b> 🏏\n` +
          `Host: <b>${escapeHTML(match.host.username)}</b> vs Guest: <b>${escapeHTML(match.guest ? match.guest.username : 'AI')}</b>\n` +
          `Pitch: <b>${match.pitch.toUpperCase()}</b> | Length: <b>${match.totalOvers} Over(s)</b>`
        );
      }
    } else {
      match.status = 'innings2';
      match.nextBatsmanIdx = 2;
      while (match.nextBatsmanIdx === match.strikerIdx || match.nextBatsmanIdx === match.nonStrikerIdx) {
        match.nextBatsmanIdx++;
      }
      match.turnState = 'bowling_delivery';

      if (match.type !== 'pvp') {
        const striker = match.battingTeam.xi[match.strikerIdx];
        const nonStriker = match.battingTeam.xi[match.nonStrikerIdx];
        const bowler = match.bowlingTeam.xi[match.currentBowlerIdx];

        await sendTelegramMessage(match,
          `🏏 <b>SECOND INNINGS BEGINS!</b>\n` +
          `═════════════════════════════\n` +
          `👉 <b>Striker:</b> <b>${escapeHTML(striker.name)}</b> (${striker.ovr} OVR)\n` +
          `👉 <b>Non-Striker:</b> <b>${escapeHTML(nonStriker.name)}</b> (${nonStriker.ovr} OVR)\n` +
          `🎳 <b>Bowler:</b> <b>${escapeHTML(bowler.name)}</b> (${bowler.ovr} OVR)\n\n` +
          `🎯 <b>Target:</b> <b>${match.innings[1].target} runs</b> to win!`
        );
      }
    }

    matchManager.saveToDb(match);
    await runGameLoopStep(null, match, true);
  } else {
    matchManager.saveToDb(match);
  }

  res.json({ success: true });
});

// --- IPL Mode: Submit Selected XI ---
app.post('/api/match/select-ipl-xi', async (req, res) => {
  const clean = (val) => {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val.toString().trim();
  };

  const { userId, matchId, selectedXi } = req.body;
  const sanitizedUserId = clean(userId);
  const sanitizedMatchId = clean(matchId);

  if (!sanitizedUserId) return res.status(400).json({ error: 'userId is required' });
  if (!selectedXi || !Array.isArray(selectedXi) || selectedXi.length !== 11) {
    return res.status(400).json({ error: 'Exactly 11 players must be selected.' });
  }

  // Validate role counts
  const batsmen = selectedXi.filter(p => p.role === 'batsman').length;
  const keepers = selectedXi.filter(p => p.role === 'wicket_keeper').length;
  const allRounders = selectedXi.filter(p => p.role === 'all_rounder').length;
  const bowlers = selectedXi.filter(p => p.role === 'bowler').length;

  if (batsmen < 3 || batsmen > 5) return res.status(400).json({ error: `Need 3–5 batsmen, got ${batsmen}.` });
  if (keepers < 1 || keepers > 2) return res.status(400).json({ error: `Need 1–2 wicket-keepers, got ${keepers}.` });
  if (allRounders < 1 || allRounders > 3) return res.status(400).json({ error: `Need 1–3 all-rounders, got ${allRounders}.` });
  if (bowlers < 3 || bowlers > 5) return res.status(400).json({ error: `Need 3–5 bowlers, got ${bowlers}.` });

  // Find match
  let match = null;
  if (sanitizedMatchId) match = matchManager.getMatch(sanitizedMatchId);
  if (!match) match = matchManager.getActiveMatch(sanitizedUserId);

  // Try restore from DB
  if (!match && sanitizedMatchId && sb.supabase) {
    try {
      const row = await sb.getCricketMatchById(sanitizedMatchId);
      if (row && row.state_json) {
        match = matchManager.deserializeMatch(row.state_json);
        matchManager.activeMatches[match.id] = match;
        matchManager.activeMatches[match.host.telegramId] = match;
        if (match.guest && match.guest.telegramId !== 'ai') {
          matchManager.activeMatches[match.guest.telegramId] = match;
        }
      }
    } catch (e) {
      console.error('[API/select-ipl-xi] Failed to restore match:', e);
    }
  }

  if (!match) return res.status(404).json({ error: 'No active match found.' });
  if (!match.iplMode) return res.status(400).json({ error: 'Match is not in IPL mode.' });
  if (match.status !== 'xi_selection') return res.status(400).json({ error: 'Match is not in XI selection phase.' });

  const isHost = match.host.telegramId.toString() === sanitizedUserId;
  const isGuest = match.guest && match.guest.telegramId.toString() === sanitizedUserId;

  if (!isHost && !isGuest) return res.status(403).json({ error: 'You are not a participant in this match.' });

  // Prefix IDs to avoid cross-team stat conflicts
  const processedXi = selectedXi.map(p => ({
    ...p,
    id: `${isHost ? 'host' : 'guest'}_${p.id}`
  }));

  if (isHost) {
    match.host.xi = processedXi;
  } else {
    match.guest.xi = processedXi;
  }

  // Check if both players have now submitted their XI
  const hostDone = match.host.xi && match.host.xi.length === 11;
  const guestDone = match.guest && match.guest.xi && match.guest.xi.length === 11;

  if (hostDone && guestDone) {
    // Both ready — notify in Telegram
    try {
      await bot.api.sendMessage(match.chatId,
        `✅ <b>Both teams have confirmed their playing XI!</b>\n\n` +
        `🏏 <b>${escapeHTML(match.host.teamName)}</b> vs <b>${escapeHTML(match.guest.teamName)}</b>\n\n` +
        `Open the web app to select your batting/bowling lineup!`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  } else {
    // Notify waiting
    try {
      const waitingFor = isHost ? match.guest.username : match.host.username;
      await bot.api.sendMessage(match.chatId,
        `✅ <b>@${escapeHTML(isHost ? match.host.username : match.guest.username)}</b> has confirmed their XI!\n` +
        `⏳ Waiting for <b>@${escapeHTML(waitingFor)}</b>...`,
        { parse_mode: 'HTML' }
      );
    } catch (e) {}
  }

  matchManager.saveToDb(match);
  res.json({ success: true });
});

app.post('/api/match/action', async (req, res) => {
  const clean = (val) => {
    if (!val || val === 'null' || val === 'undefined') return null;
    return val.toString().trim();
  };

  const { userId, matchId, type, action } = req.body;
  const sanitizedUserId = clean(userId);
  const sanitizedMatchId = clean(matchId);

  if (!sanitizedUserId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  let match = null;
  if (sanitizedMatchId) {
    match = matchManager.getMatch(sanitizedMatchId);
  }
  if (!match) {
    match = matchManager.getActiveMatch(sanitizedUserId);
  }

  // Restore if needed
  if (!match && sanitizedMatchId && sb.supabase) {
    try {
      const row = await sb.getCricketMatchById(sanitizedMatchId);
      if (row && row.state_json) {
        match = matchManager.deserializeMatch(row.state_json);
        matchManager.activeMatches[match.id] = match;
        matchManager.activeMatches[match.host.telegramId] = match;
        if (match.guest && match.guest.telegramId !== 'ai') {
          matchManager.activeMatches[match.guest.telegramId] = match;
        }
      }
    } catch (e) {
      console.error("[API] Failed to restore match during action:", e);
    }
  }

  if (!match) {
    console.error(`[API/action] No active match found for userId=${sanitizedUserId}, matchId=${sanitizedMatchId}`);
    return res.status(404).json({ error: 'No active match found.' });
  }

  const isHost = match.host.telegramId.toString() === sanitizedUserId;
  const isGuest = match.guest && match.guest.telegramId && match.guest.telegramId.toString() === sanitizedUserId;
  if (!isHost && !isGuest) {
    return res.status(403).json({ error: 'You are not a player in this match.' });
  }

  if (match.isProcessing) {
    return res.status(400).json({ error: 'Processing previous action, please wait.' });
  }

  const battingTeamId = match.innings[match.currentInningsIdx].battingId;
  const isBatting = battingTeamId.toString() === sanitizedUserId;

  if (type === 'delivery') {
    if (isBatting) return res.status(400).json({ error: 'You are batting, cannot bowl!' });
    if (match.turnState !== 'bowling_delivery') return res.status(400).json({ error: 'Not in bowling delivery phase.' });

    if (action.isMysteryBall) {
      const bowlerType = (match.currentBowler?.bowler_type || '').toLowerCase();
      const isSpin = bowlerType.includes('spin');
      if (!isSpin) {
        return res.status(400).json({ error: 'Mystery ball is only available for spin bowlers.' });
      }
      if (match.mysteryBallBowledThisOver) {
        return res.status(400).json({ error: 'You can only bowl one mystery ball per over.' });
      }
      match.isMysteryBall = true;
      match.mysteryBallBowledThisOver = true;
      
      const isOffSpin = bowlerType.includes('off') || bowlerType.includes('offspin') || bowlerType.includes('off-spin');
      let spinDeliveries = [];
      if (isOffSpin) {
        spinDeliveries = ['off_break', 'carrom_ball', 'arm_ball', 'doosra', 'top_spinner_off'];
      } else {
        spinDeliveries = ['leg_break', 'googly', 'flipper', 'top_spinner_leg', 'slider'];
      }
      const randomIdx = Math.floor(Math.random() * spinDeliveries.length);
      match.currentDelivery = spinDeliveries[randomIdx];
      match.currentSpeed = 'normal';
    } else {
      match.isMysteryBall = false;
      match.currentDelivery = action.delivery;
      match.currentSpeed = action.speed || 'normal';
    }
    match.lastDeliveryKmph = generateDeliveryKmph(match.currentBowler.bowler_type || 'fast', match.currentSpeed);
    match.turnState = 'batting_shot';

    matchManager.saveToDb(match);

    if (match.type === 'pve' && match.battingTeam.telegramId === 'ai') {
      const aiDelivery = match.isMysteryBall ? 'mystery_ball' : match.currentDelivery;
      const aiSpeed = match.isMysteryBall ? 'normal' : match.currentSpeed;
      match.currentShot = ai.getAIShot(match.striker, aiDelivery, aiSpeed);
      await processBallAndProgress(null, match);
    } else {
      await runGameLoopStep(null, match, false);
    }
  } else if (type === 'shot') {
    if (!isBatting) return res.status(400).json({ error: 'You are bowling, cannot bat!' });
    if (match.turnState !== 'batting_shot') return res.status(400).json({ error: 'Not in batting shot phase.' });

    match.currentShot = action.shot;
    await processBallAndProgress(null, match);
  } else if (type === 'wicket_batsman') {
    if (!isBatting) return res.status(400).json({ error: 'Only batsman can choose new batsman.' });
    if (match.turnState !== 'selecting_wicket_batsman') return res.status(400).json({ error: 'Not in wicket batsman selection state.' });

    const index = parseInt(action.index);
    const nextPlayer = match.battingTeam.xi[index];
    if (!nextPlayer) {
      return res.status(400).json({ error: 'Invalid batsman index.' });
    }

    if (index === match.strikerIdx || index === match.nonStrikerIdx) {
      return res.status(400).json({ error: 'This player is already batting at the crease.' });
    }

    const stats = match.stats[nextPlayer.id];
    if (stats && stats.isOut) {
      return res.status(400).json({ error: 'This player is already dismissed.' });
    }

    match.strikerIdx = index;
    match.turnState = 'bowling_delivery';

    const overCompleted = match.currentInnings.balls % 6 === 0;
    if (overCompleted && match.currentInnings.balls > 0) {
      const temp = match.strikerIdx;
      match.strikerIdx = match.nonStrikerIdx;
      match.nonStrikerIdx = temp;

      match.turnState = 'selecting_over_bowler';
    }

    matchManager.saveToDb(match);

    if (match.type !== 'pvp') {
      await sendTelegramMessage(match, `👉 <b>New Batsman:</b> <b>${escapeHTML(nextPlayer.name)}</b> (${nextPlayer.ovr} OVR) has walked out to bat.`);
    }
    await runGameLoopStep(null, match, true);
  } else if (type === 'over_bowler') {
    if (isBatting) return res.status(400).json({ error: 'Only bowler can choose new bowler.' });
    if (match.turnState !== 'selecting_over_bowler') return res.status(400).json({ error: 'Not in bowler selection state.' });

    const index = parseInt(action.index);
    if (!match.isBowlerEligible(index)) {
      return res.status(400).json({ error: 'This bowler is not eligible (consecutive over or over limit reached).' });
    }
    match.currentBowlerIdx = index;
    
    const nextBowler = match.bowlingTeam.xi[index];
    match.turnState = 'bowling_delivery';

    matchManager.saveToDb(match);

    if (match.type !== 'pvp') {
      await sendTelegramMessage(match, `👉 <b>New Bowler:</b> <b>${escapeHTML(nextBowler.name)}</b> (${nextBowler.ovr} OVR) will bowl the next over.`);
    }
    await runGameLoopStep(null, match, true);
  } else {
    return res.status(400).json({ error: 'Invalid action type.' });
  }

  res.json({ success: true });
});

// =============================================
// CRICKET GAMEPLAY HELPERS AND STATE LOOP
// =============================================

function generateDeliveryKmph(bowlerType, speed) {
  if (bowlerType === 'fast') {
    if (speed === 'fast') return Math.floor(Math.random() * 11) + 142; // 142 - 152
    if (speed === 'slow') return Math.floor(Math.random() * 11) + 115; // 115 - 125
    if (speed === 'inswinger' || speed === 'outswinger') return Math.floor(Math.random() * 10) + 128; // 128 - 137
    return Math.floor(Math.random() * 7) + 135; // 135 - 141
  } else {
    return Math.floor(Math.random() * 17) + 82; // 82 - 98
  }
}

function serializeMatchState(match, userId) {
  const isHost = userId && (match.host.telegramId.toString() === userId.toString());
  const isGuest = userId && match.guest && (match.guest.telegramId.toString() === userId.toString());

  let battingTeamId = null;
  if (match.currentInningsIdx === 1) {
    battingTeamId = match.innings[1].battingId;
  } else if (match.status === 'xi_selection') {
    if (match.tossWinnerId && match.host.telegramId) {
      battingTeamId = match.tossWinnerId.toString() === match.host.telegramId.toString()
        ? (match.tossDecision === 'bat' ? match.host.telegramId : match.guest.telegramId)
        : (match.tossDecision === 'bat' ? match.guest.telegramId : match.host.telegramId);
    } else {
      battingTeamId = match.host.telegramId;
    }
  } else {
    battingTeamId = match.innings[0].battingId;
  }

  const isPlayer = isHost || isGuest;
  const isBatting = userId && battingTeamId && (battingTeamId.toString() === userId.toString());
  const myRole = isPlayer ? (isBatting ? 'batting' : 'bowling') : 'spectator';

  let isMyTurn = false;
  if (isPlayer) {
    if (match.status === 'xi_selection') {
      if (isBatting) {
        isMyTurn = match.strikerIdx === null || match.nonStrikerIdx === null;
      } else {
        isMyTurn = match.currentBowlerIdx === null;
      }
    } else if (match.status === 'innings1' || match.status === 'innings2') {
      if (match.turnState === 'bowling_delivery') {
        isMyTurn = !isBatting;
      } else if (match.turnState === 'batting_shot') {
        isMyTurn = isBatting;
      } else if (match.turnState === 'selecting_wicket_batsman') {
        isMyTurn = isBatting;
      } else if (match.turnState === 'selecting_over_bowler') {
        isMyTurn = !isBatting;
      }
    }
  }

  const isHostBatting = battingTeamId && match.host.telegramId && (battingTeamId.toString() === match.host.telegramId.toString());
  const battingConfirmed = match.strikerIdx !== null && match.nonStrikerIdx !== null;
  const bowlingConfirmed = match.currentBowlerIdx !== null;

  const hostConfirmed = isHostBatting ? battingConfirmed : bowlingConfirmed;
  const guestConfirmed = isHostBatting ? bowlingConfirmed : battingConfirmed;

  const striker = match.strikerIdx !== null ? match.battingTeam.xi[match.strikerIdx] : null;
  const nonStriker = match.nonStrikerIdx !== null ? match.battingTeam.xi[match.nonStrikerIdx] : null;
  const bowler = match.currentBowlerIdx !== null ? match.bowlingTeam.xi[match.currentBowlerIdx] : null;

  let resultData = null;
  if (match.status === 'completed') {
    const inn1 = match.innings[0];
    const inn2 = match.innings[1];
    
    let winner = null;
    let loser = null;
    if (inn2.runs >= inn2.target) {
      winner = inn2.battingId === match.host.telegramId ? match.host : match.guest;
      loser = winner.telegramId === match.host.telegramId ? match.guest : match.host;
    } else if (inn2.runs < inn1.runs) {
      winner = inn1.battingId === match.host.telegramId ? match.host : match.guest;
      loser = winner.telegramId === match.host.telegramId ? match.guest : match.host;
    }

    let bestPlayerId = null;
    let bestScore = -1;
    const winningPlayerIds = new Set((winner && winner.xi) ? winner.xi.map(p => p.id) : []);

    for (const [pid, pStats] of Object.entries(match.stats)) {
      if (winningPlayerIds.size > 0 && !winningPlayerIds.has(pid)) {
        continue;
      }
      const score = pStats.runs + pStats.wickets * 25;
      if (score > bestScore) {
        bestScore = score;
        bestPlayerId = pid;
      }
    }

    let motmPlayer = null;
    let motmStats = null;
    if (bestPlayerId) {
      motmPlayer = match.host.xi.find(p => p.id === bestPlayerId) || 
                   (match.guest ? match.guest.xi.find(p => p.id === bestPlayerId) : null);
      motmStats = match.stats[bestPlayerId];
    }

    resultData = {
      winner: winner ? { username: winner.username, teamName: winner.teamName } : null,
      winnerReward: match.totalOvers * gameConstants.WINNER_REWARD_PER_OVER,
      loserReward: match.totalOvers * gameConstants.LOSER_REWARD_PER_OVER,
      motm: motmPlayer ? {
        name: motmPlayer.name,
        runs: motmStats.runs,
        balls: motmStats.balls,
        wickets: motmStats.wickets,
        overs: motmStats.overs
      } : null
    };
  }

  return {
    id: match.id,
    type: match.type,
    chatId: match.chatId,
    pitch: match.pitch,
    totalOvers: match.totalOvers,
    status: match.status,
    tossWinnerId: match.tossWinnerId,
    tossDecision: match.tossDecision,
    turnState: match.turnState,
    isProcessing: match.isProcessing,
    myRole,
    isMyTurn,
    result: resultData,
    host: {
      telegramId: match.host.telegramId,
      username: match.host.username,
      teamName: match.host.teamName,
      xi: match.host.xi,
      confirmed: hostConfirmed
    },
    guest: {
      telegramId: match.guest ? match.guest.telegramId : 'ai',
      username: match.guest ? match.guest.username : 'AI Bot',
      teamName: match.guest ? match.guest.teamName : 'AI XI',
      xi: match.guest ? match.guest.xi : [],
      confirmed: guestConfirmed
    },
    currentInningsIdx: match.currentInningsIdx,
    innings: match.innings.map(inn => ({
      battingId: inn.battingId,
      bowlingId: inn.bowlingId,
      runs: inn.runs,
      wickets: inn.wickets,
      balls: inn.balls % 6,
      overs: Math.floor(inn.balls / 6),
      extras: inn.extras || 0,
      target: inn.target
    })),
    score: {
      runs: match.currentInnings ? match.currentInnings.runs : 0,
      wickets: match.currentInnings ? match.currentInnings.wickets : 0,
      balls: match.currentInnings ? (match.currentInnings.balls % 6) : 0,
      overs: match.currentInnings ? Math.floor(match.currentInnings.balls / 6) : 0,
      target: match.currentInnings ? match.currentInnings.target : null
    },
    striker: striker ? {
      ...striker,
      stats: match.stats[striker.id] || { runs: 0, balls: 0, fours: 0, sixes: 0 }
    } : null,
    nonStriker: nonStriker ? {
      ...nonStriker,
      stats: match.stats[nonStriker.id] || { runs: 0, balls: 0, fours: 0, sixes: 0 }
    } : null,
    bowler: bowler ? {
      ...bowler,
      stats: match.stats[bowler.id] || { runsConceded: 0, wickets: 0, overs: 0 }
    } : null,
    battingXI: match.battingTeam ? match.battingTeam.xi : [],
    bowlingXI: match.bowlingTeam ? match.bowlingTeam.xi : [],
    stats: match.stats,
    commentary: match.commentary,
    currentDelivery: (match.isMysteryBall && isBatting) ? 'mystery_ball' : match.currentDelivery,
    currentSpeed: (match.isMysteryBall && isBatting) ? 'normal' : match.currentSpeed,
    mysteryBallBowledThisOver: match.mysteryBallBowledThisOver || false,
    lastBall: match.lastBallOutcome ? {
      runs: match.lastBallOutcome.runs,
      isWicket: match.lastBallOutcome.isWicket,
      isBoundary: match.lastBallOutcome.isSix || (match.lastBallOutcome.runs === 4),
      commentary: match.lastBallOutcome.commentary,
      delivery: match.lastBallOutcome.delivery || ''
    } : null,
    partnership: match.partnership,
    isDraft: match.isDraft || false,
    draftRound: match.draftRound || 1,
    draftTurn: match.draftTurn,
    draftOptions: match.draftOptions || [],
    draftPool: match.draftPool || [],
    iplMode: match.iplMode || false,
    hostPool: match.hostPool || [],
    guestPool: match.guestPool || []
  };
}

async function sendTelegramMessage(match, text, options = {}) {
  try {
    return await bot.api.sendMessage(match.chatId, text, { parse_mode: 'HTML', ...options });
  } catch (err) {
    console.error("Failed to send telegram message:", err);
  }
}

function renderScorecardScreen(match) {
  const current = match.currentInnings;
  const bTeam = match.battingTeam;
  const bowlTeam = match.bowlingTeam;

  const runs = current.runs;
  const wickets = current.wickets;
  const balls = current.balls;
  const oversFormatted = `${Math.floor(balls / 6)}.${balls % 6}`;

  const striker = match.striker;
  const nonStriker = match.nonStriker;
  const bowler = match.currentBowler;

  const strikerStats = striker ? (match.stats[striker.id] || { runs: 0, balls: 0 }) : { runs: 0, balls: 0 };
  const nonStrikerStats = nonStriker ? (match.stats[nonStriker.id] || { runs: 0, balls: 0 }) : { runs: 0, balls: 0 };
  const bowlerStats = bowler ? (match.stats[bowler.id] || { overs: 0, runsConceded: 0, wickets: 0 }) : { overs: 0, runsConceded: 0, wickets: 0 };

  const bNameEsc = escapeHTML(bTeam.teamName || bTeam.username);
  const strikerNameEsc = striker ? escapeHTML(striker.name) : 'TBD';
  const nonStrikerNameEsc = nonStriker ? escapeHTML(nonStriker.name) : 'TBD';
  const bowlerNameEsc = bowler ? escapeHTML(bowler.name) : 'TBD';

  let header = `🏏 <b>LIVE SCORECARD</b>\n` +
               `══════════════════════════════\n` +
               `• <b>Batting:</b> ${bNameEsc}\n` +
               `• <b>Score:</b> <b>${runs}/${wickets}</b> in <b>${oversFormatted}/${match.totalOvers} overs</b>\n`;

  if (match.status === 'innings2') {
    const target = current.target;
    const runsNeeded = target - runs;
    const ballsRemaining = (match.totalOvers * 6) - balls;
    header += `• <b>Target:</b> <b>${target}</b> (Need <b>${runsNeeded}</b> off <b>${ballsRemaining}</b> balls)\n`;
  }

  header += `══════════════════════════════\n` +
            `<b>🪓 Batsmen:</b>\n` +
            `👉 <b>${strikerNameEsc}</b> : <b>${strikerStats.runs}</b> (${strikerStats.balls}b)\n` +
            `• <b>${nonStrikerNameEsc}</b> : <b>${nonStrikerStats.runs}</b> (${nonStrikerStats.balls}b)\n\n` +
            `<b>🎳 Bowler:</b>\n` +
            `• <b>${bowlerNameEsc}</b> : <b>${bowlerStats.wickets}-${bowlerStats.runsConceded}</b> (${bowlerStats.overs} ov)\n` +
            `══════════════════════════════\n`;

  if (match.status === 'completed') {
    header += `🏆 <b>Match Completed!</b>`;
  } else if (match.status === 'xi_selection') {
    header += `⏳ <b>Xi Selection Phase:</b> Select openers/bowler in the Mini App.`;
  } else {
    if (match.turnState === 'bowling_delivery' || match.turnState === 'bowling_speed') {
      header += `🎳 <b>Bowler's Turn:</b> Waiting for @${escapeHTML(bowlTeam.username)} to deliver...`;
    } else if (match.turnState === 'batting_shot') {
      header += `🏏 <b>Batsman's Turn:</b> Waiting for @${escapeHTML(bTeam.username)} to play shot...`;
    } else if (match.turnState === 'selecting_wicket_batsman') {
      header += `☝️ <b>WICKET!</b> Waiting for @${escapeHTML(bTeam.username)} to choose next batsman...`;
    } else if (match.turnState === 'selecting_over_bowler') {
      header += `🔚 <b>End of Over!</b> Waiting for @${escapeHTML(bowlTeam.username)} to choose next bowler...`;
    }
  }

  const keyboard = new InlineKeyboard();
  addMatchPlayButton(keyboard, match);

  return { text: header, keyboard };
}

async function runGameLoopStep(ctx, match, forceNewMessage = false) {
  match.isProcessing = false;

  if (match.type === 'pvp') {
    matchManager.saveToDb(match);
    return;
  } else if (match.type === 'pve') {
    if (match.status === 'xi_selection') {
      if (match.strikerIdx !== null && match.nonStrikerIdx !== null && match.currentBowlerIdx !== null) {
        match.startFirstInnings({
          strikerIdx: match.strikerIdx,
          nonStrikerIdx: match.nonStrikerIdx,
          bowlerIdx: match.currentBowlerIdx
        });
        forceNewMessage = true;
      }
    }

    if (match.status === 'innings1' || match.status === 'innings2') {
      if (match.turnState === 'bowling_delivery') {
        const bowlTeam = match.bowlingTeam;
        if (bowlTeam.telegramId === 'ai') {
          const aiBowl = ai.getAIDelivery(match.currentBowler);
          match.currentDelivery = aiBowl.delivery;
          match.currentSpeed = aiBowl.speed;
          match.lastDeliveryKmph = generateDeliveryKmph(match.currentBowler.bowler_type || 'fast', aiBowl.speed);
          
          if (!match.mysteryBallBowledThisOver && Math.random() < 0.25) {
            match.isMysteryBall = true;
            match.mysteryBallBowledThisOver = true;
          } else {
            match.isMysteryBall = false;
          }
          
          match.turnState = 'batting_shot';
        }
      }
      
      if (match.turnState === 'batting_shot') {
        const bTeam = match.battingTeam;
        if (bTeam.telegramId === 'ai') {
          match.currentShot = ai.getAIShot(match.striker, match.currentDelivery, match.currentSpeed);
          matchManager.saveToDb(match);
          await processBallAndProgress(ctx, match);
          return;
        }
      }
    }

    matchManager.saveToDb(match);
  }

  const { text, keyboard } = renderScorecardScreen(match);

  if (!forceNewMessage && match.activeScorecardMessageId && ctx && ctx.callbackQuery) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
      return;
    } catch (e) {
      // Fallback
    }
  }

  if (match.activeScorecardMessageId) {
    try {
      await bot.api.editMessageReplyMarkup(match.chatId, match.activeScorecardMessageId, { reply_markup: { inline_keyboard: [] } });
    } catch (e) {}
  }

  try {
    const sentMsg = await bot.api.sendMessage(match.chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
    match.activeScorecardMessageId = sentMsg.message_id;
    matchManager.saveToDb(match);
  } catch (err) {
    console.error("Failed to send scorecard message:", err);
  }
}

async function processBallAndProgress(ctx, match) {
  match.isProcessing = true;
  const activeBatsmanName = match.striker.name;

  const outcome = match.bowlBall();

  if (outcome.isExtra) {
    match.commentary.unshift({
      over: `${Math.floor(match.currentInnings.balls / 6)}.${match.currentInnings.balls % 6} (Extra)`,
      text: outcome.commentary,
      runs: outcome.runs,
      isWicket: false,
      isExtra: true
    });
  } else {
    match.commentary.unshift({
      over: `${Math.floor((match.currentInnings.balls - 1) / 6)}.${(match.currentInnings.balls - 1) % 6 + 1}`,
      text: outcome.commentary,
      runs: outcome.runs,
      isWicket: outcome.isWicket
    });
  }

  if (!outcome.isExtra && match.currentInnings.balls % 6 === 0) {
    const overNum = Math.floor(match.currentInnings.balls / 6);
    const lastEndRuns = match.lastOverEndRuns || 0;
    const runsThisOver = match.currentInnings.runs - lastEndRuns;
    match.lastOverEndRuns = match.currentInnings.runs;

    const bStats = match.stats[match.currentBowlerIdx !== null ? match.bowlingTeam.xi[match.currentBowlerIdx].id : ''] || { runsConceded: 0, wickets: 0, overs: 0 };
    const activeBowler = match.currentBowlerIdx !== null ? match.bowlingTeam.xi[match.currentBowlerIdx] : { name: 'Bowler' };

    match.commentary.unshift({
      type: 'end_of_over',
      overNumber: overNum,
      runsScored: runsThisOver,
      totalRuns: match.currentInnings.runs,
      totalWickets: match.currentInnings.wickets,
      striker: match.striker ? {
        name: match.striker.name,
        runs: match.stats[match.striker.id]?.runs || 0,
        balls: match.stats[match.striker.id]?.balls || 0
      } : null,
      nonStriker: match.nonStriker ? {
        name: match.nonStriker.name,
        runs: match.stats[match.nonStriker.id]?.runs || 0,
        balls: match.stats[match.nonStriker.id]?.balls || 0
      } : null,
      bowler: {
        name: activeBowler.name,
        runsConceded: bStats.runsConceded,
        wickets: bStats.wickets,
        overs: bStats.overs
      }
    });
  }

  if (match.type !== 'pvp') {
    const commentaryText = `<blockquote expandable>🎤 <b>Commentary:</b> ${escapeHTML(outcome.commentary)}</blockquote>`;
    await sendTelegramMessage(match, commentaryText);
  }

  matchManager.saveToDb(match);

  setTimeout(async () => {
    if (match.checkInningsEnded()) {
      match.activeScorecardMessageId = null;

      if (match.status === 'innings1') {
        const inn = match.innings[0];
        match.commentary.unshift({
          type: 'end_of_innings',
          inningsIdx: 0,
          runs: inn.runs,
          wickets: inn.wickets,
          overs: `${Math.floor(inn.balls / 6)}.${inn.balls % 6}`,
          target: inn.runs + 1
        });

        if (match.type !== 'pvp') {
          await sendTelegramMessage(match, `🛎️ <b>Innings Complete!</b> \n\nScore: <b>${inn.runs}/${inn.wickets}</b> in <b>${Math.floor(inn.balls / 6)}.${inn.balls % 6} overs</b>.\n\nTarget is <b>${inn.runs + 1} runs</b>.`);
        }
        match.startSecondInnings();
        await runGameLoopStep(null, match, true);
      } else {
        try {
          const result = await match.finalizeMatch();
          
          if (result && result.isSuperOverTriggered) {
             match.commentary.unshift({
               type: 'end_of_innings',
               inningsIdx: 1,
               runs: result.tiedRuns || 0,
               wickets: result.tiedWickets || 0,
               overs: `${Math.floor((result.tiedBalls || 0) / 6)}.${(result.tiedBalls || 0) % 6}`,
               target: null
             });
             if (match.type !== 'pvp') {
                await sendTelegramMessage(match, `🛎️ <b>Innings Complete!</b>\n\nScores are level! We are going to a <b>SUPER OVER</b>! 🔥`);
             }
             matchManager.saveToDb(match);
             await runGameLoopStep(null, match, true);
             return;
          }

          match.commentary.unshift({
            type: 'end_of_innings',
            inningsIdx: 1,
            runs: result?.inn2Runs || 0,
            wickets: result?.inn2Wickets || 0,
            overs: result?.inn2Overs || '0.0',
            winner: result?.winner ? result.winner.username : 'Tie Match',
            motm: result?.motm || null
          });

          let marginText = '';
          if (result && result.winner) {
            if (match.isSuperOver) {
              marginText = `won the Super Over`;
            } else {
              const inn1 = match.innings[0];
              const inn2 = match.innings[1];
              const winnerId = result.winner.telegramId ? result.winner.telegramId.toString() : '';
              const inn2BattingId = inn2?.battingId ? inn2.battingId.toString() : '';
              const isWinnerInn2 = winnerId && winnerId === inn2BattingId;
              
              if (isWinnerInn2) {
                const maxWickets = 10;
                const wicketsWonBy = maxWickets - (inn2?.wickets || 0);
                marginText = `won by ${wicketsWonBy} wicket${wicketsWonBy > 1 ? 's' : ''}`;
              } else {
                const runsWonBy = (inn1?.runs || 0) - (inn2?.runs || 0);
                marginText = `won by ${runsWonBy} run${runsWonBy > 1 ? 's' : ''}`;
              }
            }
          }

          let summary;
          if (result && result.winner) {
            summary = `🏆 <b>MATCH COMPLETED!</b>\n\n🎉 <b>${escapeHTML(result.winner.username)}</b> ${marginText}!`;
          } else {
            summary = `🏆 <b>MATCH COMPLETED!</b>\n\n🤝 <b>Match Tied!</b>`;
          }

          const botUsername = botInfo?.username || 'Imposter0_bot';
          const playUrl = getMatchPlayUrl(match);
          const isPrivate = match.chatId > 0;
          
          let buttonObj;
          if (isPrivate) {
            buttonObj = { text: "↗️ View Match Details", web_app: { url: playUrl } };
          } else {
            const directLink = `https://t.me/${botUsername}/bonus?startapp=cricket_${match.id}_${match.chatId}`;
            buttonObj = { text: "↗️ View Match Details", url: directLink };
          }

          const reply_markup = {
            inline_keyboard: [
              [buttonObj]
            ]
          };

          try {
            await sendTelegramMessage(match, summary, { reply_markup });
          } catch (err) {
            console.error("Failed to send match completion message:", err);
          }
        } catch (finalizeErr) {
          console.error("Error during match completion/finalization:", finalizeErr);
          try {
            await sendTelegramMessage(match, "🏆 <b>MATCH COMPLETED!</b>\n\nAn error occurred while rendering the final scoreboard, but the match has ended.");
          } catch (msgErr) {
            console.error("Failed to send fallback completion message:", msgErr);
          }
        }
      }
    } else {
      if (outcome.isWicket) {
        match.lastOutBatsmanName = activeBatsmanName;
        if (match.battingTeam.telegramId === 'ai') {
          match.turnState = 'bowling_delivery';
        } else {
          match.turnState = 'selecting_wicket_batsman';
        }
      }
      
      const overCompleted = !outcome.isExtra && (match.currentInnings.balls % 6 === 0);
      if (overCompleted && match.currentInnings.balls > 0) {
        if (match.bowlingTeam.telegramId === 'ai') {
          match.selectBestBowler();
          if (match.turnState !== 'selecting_wicket_batsman') {
            match.turnState = 'bowling_delivery';
          }
        } else {
          if (match.turnState !== 'selecting_wicket_batsman') {
            match.turnState = 'selecting_over_bowler';
          }
        }
      }

      if (!match.turnState || match.turnState === 'batting_shot' || outcome.isExtra) {
        match.turnState = 'bowling_delivery';
      }

      await runGameLoopStep(null, match, true);
    }
  }, 1500);
}

async function handleMatchTermination(match, quittingUserId = null, reason = "quit") {
  try {
    const ballsBowled = (match.innings[0]?.balls || 0) + (match.innings[1]?.balls || 0);
    const hostId = match.host?.telegramId ? match.host.telegramId.toString() : '';
    const guestId = match.guest?.telegramId ? match.guest.telegramId.toString() : '';

    let inactiveId = null;
    let activeId = null;

    if (reason === "quit" && quittingUserId) {
      inactiveId = quittingUserId.toString();
      activeId = (inactiveId === hostId) ? guestId : hostId;
    } else {
      // Inactivity timeout: determine whose turn it was
      if (match.status === 'xi_selection') {
        const isHostBatting = match.innings[0]?.battingId && match.host?.telegramId && (match.innings[0].battingId.toString() === match.host.telegramId.toString());
        const battingConfirmed = match.strikerIdx !== null && match.nonStrikerIdx !== null;
        const bowlingConfirmed = match.currentBowlerIdx !== null;
        const hostConfirmed = isHostBatting ? battingConfirmed : bowlingConfirmed;
        const guestConfirmed = isHostBatting ? bowlingConfirmed : battingConfirmed;

        if (hostConfirmed && !guestConfirmed) {
          inactiveId = guestId;
          activeId = hostId;
        } else if (guestConfirmed && !hostConfirmed) {
          inactiveId = hostId;
          activeId = guestId;
        } else {
          // Both or neither have confirmed in 20 minutes: terminate without penalty
          inactiveId = null;
          activeId = null;
        }
      } else {
        // Active play phase (innings1, innings2)
        const battingId = match.currentInnings.battingId?.toString();
        const bowlingId = match.currentInnings.bowlingId?.toString();
        if (match.turnState === 'bowling_delivery' || match.turnState === 'selecting_over_bowler') {
          inactiveId = bowlingId;
          activeId = battingId;
        } else {
          inactiveId = battingId;
          activeId = bowlingId;
        }
      }
    }

    const hostName = match.host.username || "Host";
    const guestName = match.guest ? (match.guest.username || "Guest") : "Guest";
    const inactiveName = inactiveId === hostId ? hostName : guestName;
    const activeName = activeId === hostId ? hostName : guestName;

    if (!inactiveId || !activeId) {
      // Terminate with no penalties
      const msg = reason === "quit"
        ? `🚪 Match has been ended by a player before any balls were bowled. No penalties or rewards applied.`
        : `⏱️ Match has been cancelled due to inactivity of 20 minutes. No penalties or rewards applied.`;

      await sendTelegramMessage(match, msg);

      // Cleanup
      match.status = 'completed';
      matchManager.saveToDb(match);
      cleanupActiveMatch(match);
      return;
    }

    if (ballsBowled === 0) {
      // No balls bowled: no penalty, no reward
      const msg = reason === "quit"
        ? `🚪 @${inactiveName} has quit the match. Since no balls were bowled, no penalties or rewards are applied.`
        : `⏱️ Match terminated due to inactivity. Since no balls were bowled, no penalties or rewards are applied.`;

      await sendTelegramMessage(match, msg);

      // Cleanup
      match.status = 'completed';
      matchManager.saveToDb(match);
      cleanupActiveMatch(match);
      return;
    }

    // Balls bowled > 0: calculate penalty and compensation
    const totalBalls = match.totalOvers * 12;
    const ratio = Math.min(1, ballsBowled / totalBalls);
    const rewardCap = match.totalOvers * 1000;
    const compensation = Math.round(ratio * rewardCap);
    const penalty = compensation;

    // Apply database updates
    try {
      // Deduct coins from inactive/quitting player
      await sb.addCoins(inactiveId, -penalty);
      // Award coins to active player
      await sb.addCoins(activeId, compensation);
      // Record win/loss
      await sb.recordLoss(inactiveId, inactiveName, match.chatId);
      await sb.recordWin(activeId, activeName, match.chatId);
    } catch (dbErr) {
      console.error("Failed to update database for match termination:", dbErr);
    }

    const message = reason === "quit"
      ? `🚪 <b>@${inactiveName} has quit the match!</b>\n\n` +
        `• Penalty: <b>-${penalty}</b> coins deducted from @${inactiveName}.\n` +
        `• Compensation: <b>+${compensation}</b> coins awarded to @${activeName} for <b>${ballsBowled}</b> balls played.`
      : `⏱️ <b>Match Terminated due to Inactivity (20 minutes)!</b>\n\n` +
        `• Inactive Player: @${inactiveName} has been penalized <b>-${penalty}</b> coins.\n` +
        `• Compensation: <b>+${compensation}</b> coins awarded to @${activeName} for <b>${ballsBowled}</b> balls played.`;

    await sendTelegramMessage(match, message);

    // Cleanup
    match.status = 'completed';
    matchManager.saveToDb(match);
    cleanupActiveMatch(match);

  } catch (err) {
    console.error("Error inside handleMatchTermination:", err);
  }
}

function cleanupActiveMatch(match) {
  delete matchManager.activeMatches[match.host.telegramId];
  delete matchManager.activeMatches[match.id];
  if (match.guest && match.guest.telegramId !== 'ai') {
    delete matchManager.activeMatches[match.guest.telegramId];
  }
}

// Check for inactive cricket matches every 1 minute
setInterval(async () => {
  try {
    const processedIds = new Set();
    const now = Date.now();

    for (const match of Object.values(matchManager.activeMatches)) {
      if (processedIds.has(match.id)) continue;
      processedIds.add(match.id);

      // We only care about active PvP matches
      if (match.type !== 'pvp') continue;
      if (match.status === 'completed') continue;

      // Inactivity limit is 20 minutes
      const lastAct = match.lastActivity || now;
      if (now - lastAct > 20 * 60 * 1000) {
        console.log(`[Inactivity] Match ${match.id} in chat ${match.chatId} is inactive for 20+ minutes.`);
        await handleMatchTermination(match, null, "inactivity");
      }
    }
  } catch (err) {
    console.error("Error in cricket inactivity loop:", err);
  }
}, 60 * 1000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Dummy web server running on port ${PORT}`);
  
  // --- Keep-Alive Ping (Prevents Sleep) ---
  const hostname = process.env.RENDER_EXTERNAL_HOSTNAME;
  if (hostname) {
    setInterval(() => {
      const url = `https://${hostname}/`;
      fetch(url).catch(() => {}); // Self-ping
    }, 5 * 60 * 1000); // Every 5 minutes
  }
});

module.exports = { bot };
if (require.main === module) { 
  bot.api.setMyCommands([
    { command: "play", description: "Start an Undercover lobby" },
    { command: "mafia", description: "Start a Mafia lobby" },
    { command: "lies", description: "Challenge someone to Game of Lies" },
    { command: "drop", description: "🎁 Mystery Coin Drop (300-5000)" },
    { command: "spin", description: "🎡 Spin the wheel to win Glenn Maxwell" },
    { command: "hilo", description: "Play High-Low Cricket Stats" },
    { command: "fly", description: "Bet on the crashing plane" },
    { command: "dice", description: "🎲 Roll 2 dice (7 Up 7 Down)" },
    { command: "blackjack", description: "Play Blackjack (Alias: /deal)" },
    { command: "deal", description: "Alias for /blackjack" },
    { command: "daily", description: "Claim your daily coin reward" },
    { command: "guessword", description: "Start a Guess the Word game (Alias: /gw)" },
    { command: "gw", description: "Alias for /guessword" },
    { command: "profile", description: "Check your stats" },
    { command: "shop", description: "🛒 Browse and buy team players" },
    { command: "myteam", description: "👥 Show your club squads" },
    { command: "xi", description: "🏏 Show your Playing XI" },
    { command: "swap", description: "🔄 Swap squad positions" },
    { command: "claim", description: "🎁 Claim your starter pack" },
    { command: "cric", description: "🏏 Start a cricket match lobby" },
    { command: "history", description: "📜 View match history" },
    { command: "setteamname", description: "✏️ Set your cricket team name" },
    { command: "sell", description: "💰 Sell a squad member (75% value)" },
    { command: "leaderboard", description: "Global leaderboard" },
    { command: "balance", description: "Check your coin balance" },
    { command: "send", description: "Send coins to another user" },
    { command: "myword", description: "Re-send your secret word to DM" },
    { command: "settings", description: "Configure game settings" },
    { command: "remove", description: "Admin: Remove user from active cricket match" },
    { command: "addadmin", description: "SuperAdmin: Promote a user to Admin" },
    { command: "removeadmin", description: "SuperAdmin: Demote an Admin" },
    { command: "stopbroadcast", description: "SuperAdmin: Stop active broadcast" },
    { command: "revertbroadcast", description: "SuperAdmin: Delete last broadcast" },
    { command: "cancel", description: "Cancel current game" },
    { command: "quit", description: "Quit current game" },
    { command: "help", description: "Show bot help" },
    { command: "rules", description: "How to play the games" },
    { command: "start", description: "Start the bot" },
    { command: "ping", description: "Check bot status" }
  ]);
  bot.api.getMe().then(info => {
    botInfo = info;
    console.log(`Bot started as @${info.username}`);
    matchManager.loadActiveMatchesFromDb().catch(e => console.error("Match recovery failed:", e));
    loadAdmins().catch(e => console.error("Admin loading failed:", e));
  });
  bot.start({ drop_pending_updates: true }); 

  // --- Stale Game Cleanup (1 Hour) ---
  setInterval(async () => {
    const ONE_HOUR = 1 * 60 * 60 * 1000;
    const now = Date.now();

    // Cleanup Cricket Lobbies
    for (const [chatId, lobby] of Object.entries(activeLobbies)) {
      if (lobby.createdAt && (now - lobby.createdAt) > ONE_HOUR) {
        try { await bot.api.sendMessage(chatId, "🛑 <b>Lobby Closed:</b> This cricket match lobby has been inactive for more than 1 hour and has been automatically closed.", { parse_mode: 'HTML' }); } catch(e) {}
        delete activeLobbies[chatId];
      }
    }

    // Cleanup Undercover
    const ucLobbies = gameManager.getLobbies();
    for (const [chatId, lobby] of ucLobbies.entries()) {
      if (lobby.createdAt && (now - lobby.createdAt) > ONE_HOUR) {
        try { await bot.api.sendMessage(chatId, "🛑 <b>Game Closed:</b> This match has been inactive for more than 1 hour and has been automatically closed.", { parse_mode: 'HTML' }); } catch(e) {}
        gameManager.deleteLobby(chatId);
      }
    }

    // Cleanup Mafia
    const mafLobbies = mafiaManager.getLobbies();
    for (const [chatId, lobby] of mafLobbies.entries()) {
      if (lobby.createdAt && (now - lobby.createdAt) > ONE_HOUR) {
        try { await bot.api.sendMessage(chatId, "🛑 <b>Game Closed:</b> This match has been inactive for more than 1 hour and has been automatically closed.", { parse_mode: 'HTML' }); } catch(e) {}
        mafiaManager.deleteLobby(chatId);
      }
    }

    // Cleanup Lies
    const liesLobbies = liesManager.getLobbies ? liesManager.getLobbies() : new Map();
    for (const [chatId, lobby] of liesLobbies.entries()) {
      if (lobby.createdAt && (now - lobby.createdAt) > ONE_HOUR) {
        try { await bot.api.sendMessage(chatId, "🛑 <b>Game Closed:</b> This Game of Lies has been inactive for more than 1 hour and has been automatically closed.", { parse_mode: 'HTML' }); } catch(e) {}
        liesManager.deleteLobby(chatId);
      }
    }
  }, 30 * 60 * 1000); // Run every 30 minutes

  // --- Mystery Drop Reminders (Every 1 Minute) ---
  setInterval(async () => {
    const now = Date.now();
    for (const [userId, reminderTime] of pendingReminders.entries()) {
      if (now >= reminderTime) {
        pendingReminders.delete(userId);
        try {
          const kb = new InlineKeyboard().url("🎁 Claim Mystery Drop", `https://t.me/${botInfo?.username || 'bot'}?start=drop`);
          await bot.api.sendMessage(userId, 
            "🃏 <b>Your Mystery Player Drop is ready!</b>\n\nYou can now claim another random cricket player card. Will you land a 💎 ELITE card this time? 🍀", 
            { parse_mode: 'HTML', reply_markup: kb }
          );
        } catch (e) {
          console.error(`Failed to send reminder to ${userId}:`, e.message);
        }
      }
    }
  }, 60 * 1000);

  // --- Spin Wheel Reminders (Every 1 Minute) ---
  setInterval(async () => {
    const now = Date.now();
    for (const [userId, reminderTime] of pendingSpinReminders.entries()) {
      if (now >= reminderTime) {
        pendingSpinReminders.delete(userId);
        try {
          const miniAppUrl = getWebAppUrl(userId);
          const kb = new InlineKeyboard().webApp("🎡 Spin the Wheel", miniAppUrl);
          await bot.api.sendMessage(userId, 
            "🎡 <b>Your Daily Free Spin is ready!</b>\n\nHead to the Mini App to spin the wheel and win up to 10,000 coins!", 
            { parse_mode: 'HTML', reply_markup: kb }
          );
        } catch (e) {
          console.error(`Failed to send spin reminder to ${userId}:`, e.message);
        }
      }
    }
  }, 60 * 1000);
}
