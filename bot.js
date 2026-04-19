require('dotenv').config();
const { Bot, session, InlineKeyboard } = require('grammy');
const gameManager = require('./game/gameManager');
const mafiaManager = require('./game/mafiaManager');
const sb = require('./db/supabase');

process.on('unhandledRejection', (reason, promise) => {
  console.error("Ignored Unhandled Rejection:", reason.description || reason.message || reason);
});
process.on('uncaughtException', (error) => {
  console.error("Ignored Uncaught Exception:", error.description || error.message || error);
});

const bot = new Bot(process.env.BOT_TOKEN);

bot.use(session({ initial: () => ({}) }));

bot.api.setMyCommands([
  { command: 'play', description: 'Start an Undercover game lobby' },
  { command: 'mafia', description: 'Start a Mafia mode game (multi-round)' },
  { command: 'cancel', description: 'Cancel an ongoing game (Host or Admin only)' },
  { command: 'settings', description: 'Configure game settings (Admin only)' },
  { command: 'profile', description: 'View your stats and win rate' },
  { command: 'leaderboard', description: 'View top players in this group or globally' },
  { command: 'quit', description: 'Leave your current match or lobby' },
  { command: 'start', description: 'Start the bot (required to play)' },
  { command: 'ping', description: 'Check bot status and global stats' }
]).catch(console.error);

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

bot.command('start', async (ctx) => {
  if (ctx.chat.type === 'private') {
    await ctx.reply("🕵️‍♂️ <b>Welcome to The Undercover Bot!</b>\n\nAdd me to a group chat and send /play to start an intense game of deception.", { parse_mode: 'HTML' });
  } else {
    await ctx.reply("🕵️‍♂️ <b>The Undercover Bot</b> is ready! Send /play to start a new lobby.", { parse_mode: 'HTML' });
  }
});

bot.command('ping', async (ctx) => {
  const activeGames = gameManager.getActiveGamesCount() + mafiaManager.getActiveGamesCount();
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

bot.command('cancel', async (ctx) => {
  if (ctx.chat.type === 'private') return;
  const chatId = ctx.chat.id;
  const lobby = gameManager.getLobby(chatId) || mafiaManager.getLobby(chatId);
  if (!lobby) return ctx.reply("No active game to cancel.");
  
  const member = await ctx.getChatMember(ctx.from.id);
  const isAdmin = member.status === 'administrator' || member.status === 'creator';
  
  if (lobby.host.id !== ctx.from.id && !isAdmin) {
      return ctx.reply("Only the lobby host or group admins can cancel the game.");
  }
  
  if (lobby.pinnedMessageId) {
     try { await ctx.api.unpinChatMessage(chatId, lobby.pinnedMessageId); } catch(e) {}
  }
  
  if (gameManager.hasLobby(chatId)) gameManager.deleteLobby(chatId);
  else mafiaManager.deleteLobby(chatId);
  await ctx.reply("🛑 The current game was cancelled.");
});

bot.command('profile', async (ctx) => {
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  const user = ctx.message.reply_to_message?.from || ctx.from;
  const profile = await sb.getProfile(user.id);
  
  if (!profile) {
     return ctx.reply(`👤 <b><a href="tg://user?id=${user.id}">${user.first_name}</a></b> has not played any games yet!`, { parse_mode: 'HTML' });
  }
  
  const winRate = profile.matches_played > 0 ? Math.round((profile.wins / profile.matches_played) * 100) : 0;
  await ctx.reply(
    `👤 <b>Profile: <a href="tg://user?id=${user.id}">${profile.first_name}</a></b>\n\n🏆 <b>Wins:</b> ${profile.wins}\n🎮 <b>Matches Played:</b> ${profile.matches_played}\n📈 <b>Win Rate:</b> ${winRate}%`,
    { parse_mode: 'HTML' }
  );
});

bot.command('quit', async (ctx) => {
  const userId = ctx.from.id;
  const regularLobby = gameManager.getLobbyByUserId(userId);
  const mafiaLobby = mafiaManager.getLobbyByUserId(userId);
  
  if (!regularLobby && !mafiaLobby) {
      return ctx.reply("You are not in any active game or lobby.");
  }
  
  if (regularLobby) {
      const chatId = regularLobby.chatId;
      if (regularLobby.state === 'LOBBY') {
          gameManager.leaveLobby(chatId, userId);
          await ctx.reply("✅ You have left the Undercover lobby.");
          await updateLobbyMessage(chatId, regularLobby, regularLobby.joinMessageId);
      } else {
          // In Undercover, leaving during a game kills the game
          gameManager.deleteLobby(chatId);
          await bot.api.sendMessage(chatId, `🛑 <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> has quit. The game has been cancelled.`, { parse_mode: 'HTML' });
          await ctx.reply("✅ You quit the match. The game was cancelled.");
      }
  } else if (mafiaLobby) {
      const chatId = mafiaLobby.chatId;
      if (mafiaLobby.state === 'LOBBY') {
          mafiaManager.leaveLobby(chatId, userId);
          await ctx.reply("✅ You have left the Mafia lobby.");
          const msgId = mafiaLobby.pinnedMessageId || mafiaLobby.joinMessageId; // check which one we have
          if (msgId) await updateMafiaLobbyMessage(chatId, mafiaLobby, msgId);
      } else {
          // In Mafia, quitting during a game eliminates you
          const { player, role } = mafiaManager.eliminatePlayer(chatId, userId);
          const RE = { CIVILIAN: '👤', IMPOSTOR: '🔫', JOKER: '🃏' };
          let msg = `🏳️ <a href="tg://user?id=${userId}">${ctx.from.first_name}</a> has <b>QUIT</b> the game!\n\nThey were a <b>${role}</b> ${RE[role]}.`;
          if (role === 'IMPOSTOR') msg += `\n🔑 Their word was: <tg-spoiler>${mafiaLobby.wordB}</tg-spoiler>`;
          
          await bot.api.sendMessage(chatId, msg, { parse_mode: 'HTML' });
          await ctx.reply("✅ You have quit the Mafia match.");
          
          const win = mafiaManager.checkWinCondition(chatId);
          if (win) await endMafiaGame(chatId, win);
      }
  }
});

bot.command('leaderboard', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply("Leaderboards are best viewed in group chats.");
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const keyboard = new InlineKeyboard()
    .text("🌍 Global", "lb_global")
    .text("🏠 This Group", "lb_group");
    
  await ctx.reply("📊 <b>Leaderboards</b>\n\nSelect which leaderboard you want to view:", { reply_markup: keyboard, parse_mode: 'HTML' });
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
  if (ctx.chat.type === 'private') return ctx.reply("You can only play this game in a group chat.");
  
  try {
     await ctx.api.sendChatAction(ctx.from.id, 'typing');
  } catch (e) {
     return ctx.reply(`⚠️ <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>, you MUST start the bot in private messages first before hosting! Tap my profile picture, hit Start, and come back.`, { parse_mode: 'HTML' });
  }
  
  const chatId = ctx.chat.id;
  const creator = ctx.from;
  
  if (gameManager.hasLobby(chatId) || mafiaManager.hasLobby(chatId)) return ctx.reply("A game is already ongoing or forming in this chat!");

  gameManager.createLobby(chatId, creator);
  
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "join_game")
    .text("❌ Leave", "leave_game")
    .row()
    .text("▶️ Start (Host only)", "start_game");
    
  const sentMsg = await ctx.reply(
    `🕵️‍♂️ <b>Undercover Lobby</b> 🕵️‍♂️\n\nHost: <a href="tg://user?id=${creator.id}">${creator.first_name}</a>\nPlayers joined: 1 (Minimum 3 required)\n\n1. <a href="tg://user?id=${creator.id}">${creator.first_name}</a>`, 
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
  if (ctx.chat.type === 'private') return ctx.reply("You can only play Mafia in a group chat.");
  try { await ctx.api.sendChatAction(ctx.from.id, 'typing'); }
  catch (e) { return ctx.reply(`⚠️ <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>, you MUST start the bot first!`, { parse_mode: 'HTML' }); }

  const chatId = ctx.chat.id;
  if (gameManager.hasLobby(chatId) || mafiaManager.hasLobby(chatId)) return ctx.reply("A game is already ongoing in this chat!");

  mafiaManager.createLobby(chatId, ctx.from);
  const dist = mafiaManager.getRoleDist(1);
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "maf_join").text("❌ Leave", "maf_leave").row()
    .text("▶️ Start (Host only)", "maf_start");

  const sentMsg = await ctx.reply(
    `🔫 <b>Mafia Lobby</b> 🔫\n\nHost: <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>\nPlayers: 1 (Minimum 3 required)\nRoles: ${dist.impostors} Impostor | ${dist.joker} Joker\n\n👤 Civilians don't know who the Impostors are\n🔫 Impostors don't know they're Impostors!\n🃏 Joker wins by getting voted out — game ends!\n\n1. <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>`,
    { reply_markup: keyboard, parse_mode: 'HTML' }
  );

  const lobby = mafiaManager.getLobby(chatId);
  if (lobby) {
    try { await ctx.api.pinChatMessage(chatId, sentMsg.message_id, { disable_notification: true }); lobby.pinnedMessageId = sentMsg.message_id; } catch(e) {}
  }
});

bot.on('message:text', async (ctx) => {
  if (ctx.chat.type !== 'private') {
    const lobby = gameManager.getLobby(ctx.chat.id);
    if (lobby && lobby.state === 'IMPOSTOR_GUESS' && ctx.from.id === lobby.impostorId) {
      const guess = ctx.message.text.trim().toLowerCase();
      const actualWordA = lobby.wordA.toLowerCase();
      
      lobby.state = 'END'; 
      if (guess === actualWordA) {
         processGameEnd(lobby, 'IMPOSTOR');
         await ctx.reply(`🤯 <b>THE IMPOSTOR STOLE THE WIN!</b>\n\n<a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a> correctly guessed the majority word: <b>${lobby.wordA}</b>! They pulled off the ultimate bluff!`, { parse_mode: 'HTML' });
      } else {
         processGameEnd(lobby, 'MAJORITY');
         await ctx.reply(`🎉 <b>THE MAJORITY WINS!</b>\n\nThe Impostor was <a href="tg://user?id=${ctx.from.id}">${ctx.from.first_name}</a>. They guessed "${guess}", but the real group word was <b>${lobby.wordA}</b>!`, { parse_mode: 'HTML' });
      }
      gameManager.deleteLobby(ctx.chat.id);
    }
    return;
  }
  
  const userId = ctx.from.id;
  const word = ctx.message.text;

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
            text += `${mark} <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; 
         });
         try { await bot.api.editMessageText(chatId, lobby.clueStatusMessageId, text, { parse_mode: 'HTML' }); } catch(e) {}
      }
      if (result.allReceived) {
        lobby.state = 'DISCUSSION';
        let clueText = `🕵️‍♂️ <b>All Clues Revealed!</b>\n\nLook closely... One of these players is the Impostor with a slightly different word!\n\n`;
        lobby.players.forEach(p => {
          clueText += `- <a href="tg://user?id=${p.id}">${p.first_name}</a>: <b>${lobby.cluesReceived[p.id]}</b>\n`;
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
            text += `${mark} <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`;
         });
         try { await bot.api.editMessageText(chatId, lobby.clueStatusMessageId, text, { parse_mode: 'HTML' }); } catch(e) {}
      }
      if (result.allReceived) {
        if (lobby.clueTimer) { clearTimeout(lobby.clueTimer); lobby.clueTimer = null; }
        lobby.state = 'DISCUSSION';
        let clueText = `🔫 <b>Round ${lobby.round} — All Clues Revealed!</b>\n\nSomeone might have a different word... find them!\n\n`;
        lobby.alivePlayers.forEach(p => {
          clueText += `- <a href="tg://user?id=${p.id}">${p.first_name}</a>: <b>${lobby.cluesReceived[p.id]}</b>\n`;
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

  if (regularLobby || mafiaLobby) {
      return ctx.reply("❌ It's not time to submit clues right now.");
  }
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;
  const user = ctx.from;
  
  // --- Leaderboard callbacks ---
  if (data === 'lb_global' || data === 'lb_group') {
     const isGlobal = data === 'lb_global';
     const records = isGlobal ? await sb.getGlobalLeaderboard() : await sb.getGroupLeaderboard(chatId);
     
     let text = isGlobal ? `🌍 <b>Global Top 10 Players</b> 🌍\n\n` : `🏠 <b>Group Top 10 Players</b> 🏠\n\n`;
     if (!records || records.length === 0) {
        text += "<i>No records found yet! Play some games!</i>";
     } else {
        records.forEach((r, i) => {
           const winRate = r.matches_played > 0 ? Math.round((r.wins / r.matches_played) * 100) : 0;
           text += `${i+1}. <b>${r.first_name || 'Player'}</b> - ${r.wins} Wins <i>(${winRate}% WR)</i>\n`;
        });
     }
     
     const keyboard = new InlineKeyboard()
       .text("🌍 Global", "lb_global")
       .text("🏠 This Group", "lb_group");
       
     try {
       await ctx.editMessageText(text, { reply_markup: keyboard, parse_mode: 'HTML' });
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
      await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🔫 Host <b>${mLobby.host.first_name}</b>, choose a theme:`, { reply_markup: kb, parse_mode: 'HTML' });
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
      mLobby.alivePlayers.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; });
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
        if (!mLobby.anonymousVoting) await bot.api.sendMessage(chatId, `🗳️ <a href="tg://user?id=${user.id}">${user.first_name}</a> voted for <a href="tg://user?id=${targetP.id}">${targetP.first_name}</a>!`, { parse_mode: 'HTML' });
        else await bot.api.sendMessage(chatId, `🗳️ A vote has been cast! (${Object.keys(mLobby.votes).length}/${mLobby.alivePlayers.length})`, { parse_mode: 'HTML' });
        if (vr.allVoted) await tallyMafiaVotes(chatId);
      }
    }
    return;
  }
  
  // --- Regular Game callbacks ---
  const lobby = gameManager.getLobby(chatId);
  if (!lobby) return ctx.answerCallbackQuery({ text: "This game lobby has expired or does not exist.", show_alert: true });
  const isHost = lobby.host.id === user.id;

  if (data === 'join_game') {
    if (lobby.state !== 'LOBBY') return ctx.answerCallbackQuery("Game already started!");
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
    
    await bot.api.editMessageText(chatId, ctx.callbackQuery.message.message_id, `🕵️‍♂️ Host <b>${lobby.host.first_name}</b>, please choose a theme for this match:`, { reply_markup: keyboard, parse_mode: 'HTML' });
  }
  else if (data.startsWith('theme_')) {
    if (!isHost) return ctx.answerCallbackQuery({ text: "Only the host can select the theme!", show_alert: true });
    if (lobby.state !== 'THEME_SELECTION') return ctx.answerCallbackQuery("Not the time for this!");
    
    const themeName = data.replace('theme_', '');
    await ctx.answerCallbackQuery("Theme locked in!");
    
    try { await bot.api.editMessageReplyMarkup(chatId, ctx.callbackQuery.message.message_id, { reply_markup: new InlineKeyboard() }); } catch(e) {}
    
    const gSettings = await sb.getGroupSettings(chatId);
    await gameManager.startGame(chatId, themeName, bot, gSettings);
    
    let text = `🕵️‍♂️ <b>Clue Phase Started!</b> 🕵️‍♂️\n\nCheck your DMs to see your secret word and reply with your ${gSettings.clue_words === 1 ? '1-word' : `1-${gSettings.clue_words} word`} clue!\n\n<b>Status:</b>\n`;
    lobby.players.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; });
    
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
        await bot.api.sendMessage(chatId, `🗳️ <a href="tg://user?id=${user.id}">${user.first_name}</a> publicly voted for <a href="tg://user?id=${targetPlayer.id}">${targetPlayer.first_name}</a>!`, { parse_mode: 'HTML' });
      } else {
        await bot.api.sendMessage(chatId, `🗳️ A vote has been cast! (${Object.keys(lobby.votes).length}/${lobby.players.length})`, { parse_mode: 'HTML' });
      }
      if (voteResult.allVoted) await tallyVotes(chatId);
    }
  }
});

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
    
    setTimeout(async () => {
       const currentLobby = gameManager.getLobby(chatId);
       if (currentLobby && currentLobby.state === 'VOTING') await tallyVotes(chatId);
    }, gSettings.voting_time * 1000);
}

async function tallyVotes(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby || lobby.state !== 'VOTING') return;
    
    lobby.state = 'TALLY'; 
    const results = gameManager.getVotingResults(chatId);
    const impostorPlayer = lobby.players.find(p => p.id === lobby.impostorId);
    const impostorName = impostorPlayer ? `<a href="tg://user?id=${impostorPlayer.id}">${impostorPlayer.first_name}</a>` : 'The Impostor';
    
    if (Object.keys(lobby.votes).length === 0 || results.tie) {
        processGameEnd(lobby, 'IMPOSTOR');
        let msg = Object.keys(lobby.votes).length === 0 ? "⚖️ <b>NO ONE VOTED!</b>" : "⚖️ <b>IT'S A TIE VOTE!</b>";
        await bot.api.sendMessage(chatId, `${msg}\n\nSince the group couldn't agree, the Impostor survives and perfectly blended in!\n\n(The Impostor was actually ${impostorName} with the word: <i>${lobby.wordB}</i>!)\n\n<b>THE IMPOSTOR WINS!</b>`, { parse_mode: 'HTML' });
        gameManager.deleteLobby(chatId);
        return;
    } 

    const votedPlayer = lobby.players.find(p => p.id === results.votedOutId);
    const isImpostorEliminated = results.votedOutId === lobby.impostorId;
    
    if (!isImpostorEliminated) {
       processGameEnd(lobby, 'IMPOSTOR');
       await bot.api.sendMessage(chatId, `❌ <b>WRONG VOTE!</b>\n\nThe group voted out <a href="tg://user?id=${votedPlayer.id}">${votedPlayer.first_name}</a>, but they were innocent! Their word was <b>${lobby.wordA}</b> just like everyone else!\n\n<b>THE IMPOSTOR SURVIVES AND WINS!</b>\n(The Impostor was actually ${impostorName} with the word: <i>${lobby.wordB}</i>)`, { parse_mode: 'HTML' });
       gameManager.deleteLobby(chatId);
    } else {
       const gSettings = await sb.getGroupSettings(chatId);
       lobby.state = 'IMPOSTOR_GUESS';
       await bot.api.sendMessage(chatId, `🎯 <b>CORRECT VOTE!</b>\n\nBrilliant deduction! You caught the Impostor: <a href="tg://user?id=${votedPlayer.id}">${votedPlayer.first_name}</a>! (Their unique word was <tg-spoiler>${lobby.wordB}</tg-spoiler>).\n\n🚨 <b>BUT WAIT...</b>\n<a href="tg://user?id=${votedPlayer.id}">${votedPlayer.first_name}</a>, you have exactly ONE CHANCE. Type what you think the group's word was right down here in the chat to steal the win! (You have ${gSettings.impostor_guess_time} seconds!)`, { parse_mode: 'HTML' });
       
       setTimeout(async () => {
          const currentLobby = gameManager.getLobby(chatId);
          if (currentLobby && currentLobby.state === 'IMPOSTOR_GUESS') {
             lobby.state = 'END';
             processGameEnd(currentLobby, 'MAJORITY');
             await bot.api.sendMessage(chatId, `⏳ <b>TIME IS UP!</b>\n\nThe Impostor failed to guess the word in time.\nThe real word was <b>${currentLobby.wordA}</b>.\n\n🎉 <b>THE MAJORITY WINS!</b>`, { parse_mode: 'HTML' });
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
  let text = `🕵️‍♂️ <b>Undercover Lobby</b> 🕵️‍♂️\n\nHost: <a href="tg://user?id=${lobby.host.id}">${lobby.host.first_name}</a>\nPlayers joined: ${lobby.players.length} (Minimum 3 required)\n\n`;
  lobby.players.forEach((p, idx) => { text += `${idx + 1}. <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; });
  try { await bot.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'HTML' }); }
  catch (error) { if (!error.message.includes("is not modified")) console.error(error); }
}

// ==================== MAFIA GAME FLOW ====================

async function updateMafiaLobbyMessage(chatId, lobby, messageId) {
  const dist = mafiaManager.getRoleDist(lobby.players.length);
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "maf_join").text("❌ Leave", "maf_leave").row()
    .text("▶️ Start (Host only)", "maf_start");
  let text = `🔫 <b>Mafia Lobby</b> 🔫\n\nHost: <a href="tg://user?id=${lobby.host.id}">${lobby.host.first_name}</a>\nPlayers: ${lobby.players.length} (Minimum 3 required)\nRoles: ${dist.impostors} Impostor${dist.impostors > 1 ? 's' : ''} | ${dist.joker} Joker\n\n`;
  lobby.players.forEach((p, idx) => { text += `${idx + 1}. <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; });
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
    elimText += `💤 <a href="tg://user?id=${p.id}">${p.first_name}</a> — ${RE[role]} ${role.charAt(0) + role.slice(1).toLowerCase()}`;
    if (role === 'IMPOSTOR') elimText += ` (Their word was: <tg-spoiler>${lobby.wordB}</tg-spoiler>)`;
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
    clueText += `- <a href="tg://user?id=${p.id}">${p.first_name}</a>: <b>${lobby.cluesReceived[p.id] || '—'}</b>\n`;
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
    elimText = `🃏 <b>THE JOKER WINS!</b> 🃏\n\n<a href="tg://user?id=${votedP.id}">${votedP.first_name}</a> was the <b>Joker</b>! They WANTED to get voted out and pulled it off!\n\n🎭 The Joker takes the victory — game over!`;
    await bot.api.sendMessage(chatId, elimText, { parse_mode: 'HTML' });
    return endMafiaGame(chatId, 'JOKER_WIN');
  } else if (role === 'IMPOSTOR') {
    elimText = `✅ <b>IMPOSTOR CAUGHT!</b>\n\n<a href="tg://user?id=${votedP.id}">${votedP.first_name}</a> was an <b>Impostor</b>! ${RE[role]}\n🔑 Their word was: <tg-spoiler>${lobby.wordB}</tg-spoiler>`;
  } else {
    elimText = `❌ <b>WRONG TARGET!</b>\n\n<a href="tg://user?id=${votedP.id}">${votedP.first_name}</a> was a <b>Civilian</b>! ${RE[role]}\nThe impostors are still among you...`;
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
  lobby.alivePlayers.forEach(p => { text += `⏳ <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`; });
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
    const entry = `${RE[r]} <a href="tg://user?id=${p.id}">${p.first_name}</a> — ${r.charAt(0) + r.slice(1).toLowerCase()} (${status})`;
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
app.get('/', (req, res) => res.send('Bot is safely running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dummy web server running on port ${PORT}`));

module.exports = { bot };
if (require.main === module) { bot.start(); console.log("Bot started!"); }
