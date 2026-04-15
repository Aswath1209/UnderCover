require('dotenv').config();
const { Bot, session, InlineKeyboard } = require('grammy');
const gameManager = require('./game/gameManager');
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
  { command: 'cancel', description: 'Cancel an ongoing game (Host or Admin only)' },
  { command: 'profile', description: 'View your stats and win rate' },
  { command: 'leaderboard', description: 'View top players in this group or globally' },
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
  const activeGames = gameManager.getActiveGamesCount();
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
  const lobby = gameManager.getLobby(ctx.chat.id);
  if (!lobby) return ctx.reply("No active game to cancel.");
  
  const member = await ctx.getChatMember(ctx.from.id);
  const isAdmin = member.status === 'administrator' || member.status === 'creator';
  
  if (lobby.host.id !== ctx.from.id && !isAdmin) {
      return ctx.reply("Only the lobby host or group admins can cancel the game.");
  }
  
  if (lobby.pinnedMessageId) {
     try { await ctx.api.unpinChatMessage(ctx.chat.id, lobby.pinnedMessageId); } catch(e) {}
  }
  
  gameManager.deleteLobby(ctx.chat.id);
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

bot.command('leaderboard', async (ctx) => {
  if (ctx.chat.type === 'private') return ctx.reply("Leaderboards are best viewed in group chats.");
  if (!sb.supabase) return ctx.reply("Database stats are currently disabled.");
  
  const keyboard = new InlineKeyboard()
    .text("🌍 Global", "lb_global")
    .text("🏠 This Group", "lb_group");
    
  await ctx.reply("📊 <b>Leaderboards</b>\n\nSelect which leaderboard you want to view:", { reply_markup: keyboard, parse_mode: 'HTML' });
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
  
  if (gameManager.hasLobby(chatId)) return ctx.reply("A game is already ongoing or forming in this chat!");

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
        const theirClue = lobby.cluesReceived[p.id];
        clueText += `- <a href="tg://user?id=${p.id}">${p.first_name}</a>: <b>${theirClue}</b>\n`;
      });
      clueText += `\n💬 <b>DISCUSSION PHASE:</b> You now have exactly 90 seconds to discuss who the Impostor is before voting locks!`;
      
      await bot.api.sendMessage(chatId, clueText, { parse_mode: 'HTML' });
      
      setTimeout(async () => {
         const currentLobby = gameManager.getLobby(chatId);
         if (currentLobby && currentLobby.state === 'DISCUSSION') {
             await startVotingPhase(chatId);
         }
      }, 90000);
    }
  }
});

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  const chatId = ctx.chat.id;
  const user = ctx.from;
  
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
    
    await gameManager.startGame(chatId, themeName, bot);
    
    let text = `🕵️‍♂️ <b>Clue Phase Started!</b> 🕵️‍♂️\n\nCheck your DMs to see your secret word and reply with your 1-word clue!\n\n<b>Status:</b>\n`;
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
      await bot.api.sendMessage(chatId, `🗳️ <a href="tg://user?id=${user.id}">${user.first_name}</a> publicly voted for <a href="tg://user?id=${targetPlayer.id}">${targetPlayer.first_name}</a>!`, { parse_mode: 'HTML' });
      if (voteResult.allVoted) await tallyVotes(chatId);
    }
  }
});

async function startVotingPhase(chatId) {
    const lobby = gameManager.getLobby(chatId);
    if (!lobby) return;
    
    lobby.state = 'VOTING';
    const keyboard = new InlineKeyboard();
    lobby.players.forEach(p => keyboard.text(`👉 Vote: ${p.first_name}`, `vote_${p.id}`).row());
    
    await bot.api.sendMessage(chatId, `🗳️ <b>VOTING TIME!</b>\n\nYou have 1 minute to lock in your vote below. One vote per player!`, { reply_markup: keyboard, parse_mode: 'HTML' });
    
    setTimeout(async () => {
       const currentLobby = gameManager.getLobby(chatId);
       if (currentLobby && currentLobby.state === 'VOTING') await tallyVotes(chatId);
    }, 60000);
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
       lobby.state = 'IMPOSTOR_GUESS';
       await bot.api.sendMessage(chatId, `🎯 <b>CORRECT VOTE!</b>\n\nBrilliant deduction! You caught the Impostor: <a href="tg://user?id=${votedPlayer.id}">${votedPlayer.first_name}</a>! (Their unique word was <tg-spoiler>${lobby.wordB}</tg-spoiler>).\n\n🚨 <b>BUT WAIT...</b>\n<a href="tg://user?id=${votedPlayer.id}">${votedPlayer.first_name}</a>, you have exactly ONE CHANCE. Type what you think the group's word was right down here in the chat to steal the win! (You have 30 seconds!)`, { parse_mode: 'HTML' });
       
       setTimeout(async () => {
          const currentLobby = gameManager.getLobby(chatId);
          if (currentLobby && currentLobby.state === 'IMPOSTOR_GUESS') {
             lobby.state = 'END';
             processGameEnd(currentLobby, 'MAJORITY');
             await bot.api.sendMessage(chatId, `⏳ <b>TIME IS UP!</b>\n\nThe Impostor failed to guess the word in time.\nThe real word was <b>${currentLobby.wordA}</b>.\n\n🎉 <b>THE MAJORITY WINS!</b>`, { parse_mode: 'HTML' });
             gameManager.deleteLobby(chatId);
          }
       }, 30000);
    }
}

async function updateLobbyMessage(chatId, lobby, messageId) {
  const keyboard = new InlineKeyboard()
    .text("✅ Join Game", "join_game")
    .text("❌ Leave", "leave_game")
    .row()
    .text("▶️ Start (Host only)", "start_game");
    
  let text = `🕵️‍♂️ <b>Undercover Lobby</b> 🕵️‍♂️\n\nHost: <a href="tg://user?id=${lobby.host.id}">${lobby.host.first_name}</a>\nPlayers joined: ${lobby.players.length} (Minimum 3 required)\n\n`;
  lobby.players.forEach((p, idx) => {
    text += `${idx + 1}. <a href="tg://user?id=${p.id}">${p.first_name}</a>\n`;
  });
  
  try { await bot.api.editMessageText(chatId, messageId, text, { reply_markup: keyboard, parse_mode: 'HTML' }); } 
  catch (error) { if (!error.message.includes("is not modified")) console.error(error); }
}

bot.catch((err) => console.error(`Error in update ${err.ctx.update.update_id}:`, err.error));

const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is safely running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Dummy web server running on port ${PORT}`));

module.exports = { bot };
if (require.main === module) { bot.start(); console.log("Bot started!"); }
