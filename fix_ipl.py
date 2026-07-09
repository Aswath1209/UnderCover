import re

with open('bot.js', 'r') as f:
    content = f.read()

# Chunk 1
content = re.sub(
    r'  // ── IPL Mode: show team picker and return early ──────────────────────────\n.*?  // ── Normal / Draft Mode ──────────────────────────────────────────────────\n  try \{\n    let teamName = `\$\{username\}\'s XI`;\n    let squad = \[\];\n    let xi = \[\];\n\n    if \(!isDraft\) \{',
    r'''  // ── Normal / Draft / IPL Mode ──────────────────────────────────────────
  try {
    let teamName = `${username}'s XI`;
    let squad = [];
    let xi = [];

    if (!isDraft && !isIpl) {''',
    content,
    flags=re.DOTALL
)

# Chunk 2
content = content.replace(
    '''      draftMode: isDraft,
      createdAt: Date.now()
    };

    const keyboard = new InlineKeyboard()
      .text('🤝 Join', 'cric_join')
      .text('❌ Cancel', 'cric_cancel_lobby');
    
    const modeLabel = isDraft ? " (Draft Mode ⚡)" : "";''',
    '''      draftMode: isDraft,
      iplMode: isIpl,
      createdAt: Date.now()
    };

    const keyboard = new InlineKeyboard()
      .text('🤝 Join', 'cric_join')
      .text('❌ Cancel', 'cric_cancel_lobby');
    
    const modeLabel = isIpl ? " (IPL Mode 🏆)" : (isDraft ? " (Draft Mode ⚡)" : "");'''
)

# Chunk 3
content = re.sub(
    r'// ─────────────────────────────────────────────────────────────────────────────\n// IPL 2026 Mode: Team picker callbacks \(triggered from /cric ipl\)\n// ─────────────────────────────────────────────────────────────────────────────\n\n// Handle host team pick\nbot\.callbackQuery\(\/\^cipl_host_team:\/, async \(ctx\) => \{.*?    \.text\(\'Tails 🪙\', \'cric_toss_guess:tails\'\);\n    \n  await ctx\.reply\(tossText, \{ parse_mode: \'HTML\', reply_markup: keyboard \}\);\n\}\);\n',
    r'''// ─────────────────────────────────────────────────────────────────────────────
// IPL 2026 Mode: Team picker callback
// ─────────────────────────────────────────────────────────────────────────────

bot.callbackQuery(/^cipl_pick_team:/, async (ctx) => {
  const parts    = ctx.callbackQuery.data.split(':');
  const teamCode = parts[1];
  const chatId   = parts[2];
  const user     = ctx.from;

  const lobby = activeLobbies[chatId];
  if (!lobby || lobby.status !== 'ipl_team_picker') {
    return ctx.answerCallbackQuery({ text: '❌ Match is no longer in team picking phase.', show_alert: true });
  }

  const isHost = lobby.host.telegramId === user.id;
  const isGuest = lobby.guest && lobby.guest.telegramId === user.id;

  if (!isHost && !isGuest) return ctx.answerCallbackQuery({ text: '❌ You are not part of this match.', show_alert: true });

  if (isHost && lobby.host.teamCode) return ctx.answerCallbackQuery({ text: '❌ You already picked your team.', show_alert: true });
  if (isGuest && lobby.guest.teamCode) return ctx.answerCallbackQuery({ text: '❌ You already picked your team.', show_alert: true });
  if (isGuest && !lobby.host.teamCode) return ctx.answerCallbackQuery({ text: '⏳ Wait for the Host to pick their team first!', show_alert: true });

  const pool = IPL_SQUADS_POOL[teamCode];
  if (!pool) return ctx.answerCallbackQuery({ text: '❌ Invalid team.', show_alert: true });
  
  const teamName = IPL_TEAM_NAMES[teamCode] || teamCode;

  if (isHost) {
    lobby.host.teamCode = teamCode;
    lobby.host.teamName = teamName;
    lobby.host.squad = pool;
    lobby.host.xi = [];
    
    await ctx.answerCallbackQuery({ text: `✅ You picked ${teamCode}!` });
    
    const teams = Object.keys(IPL_SQUADS_POOL);
    const kb = new InlineKeyboard();
    for (let i = 0; i < teams.length; i += 2) {
      const row = [teams[i], teams[i + 1]].filter(Boolean);
      const availableRow = row.filter(t => t !== teamCode);
      if (availableRow.length > 0) {
        kb.row(...availableRow.map(t => ({ text: t, callback_data: `cipl_pick_team:${t}:${chatId}` })));
      }
    }
    
    await ctx.editMessageText(
      `🏆 <b>IPL 2026 MODE</b> 🏆\n` +
      `═══════════════════════════════\n` +
      `• Length: ${lobby.overs} Over(s)\n` +
      `• Host picked: <b>${teamCode}</b>\n\n` +
      `👇 @${escapeHTML(lobby.guest.username)} (Guest), pick <b>your team</b>:`,
      { parse_mode: 'HTML', reply_markup: kb }
    ).catch(()=>{});
    
  } else if (isGuest) {
    lobby.guest.teamCode = teamCode;
    lobby.guest.teamName = teamName;
    lobby.guest.squad = pool;
    lobby.guest.xi = [];
    
    await ctx.answerCallbackQuery({ text: `✅ You picked ${teamCode}!` });
    
    lobby.status = 'toss_guess';
    
    const tossText = 
      `🏆 <b>TEAMS SELECTED!</b> 🏆\n` +
      `═════════════════════════════\n` +
      `• Host (@${escapeHTML(lobby.host.username)}): <b>${lobby.host.teamCode}</b>\n` +
      `• Guest (@${escapeHTML(lobby.guest.username)}): <b>${lobby.guest.teamCode}</b>\n` +
      `═════════════════════════════\n\n` +
      `🪙 <b>TOSS TIME!</b> 🪙\n` +
      `👉 @${escapeHTML(lobby.guest.username)}, call the toss:`;

    const keyboard = new InlineKeyboard()
      .text('Heads 🪙', 'cric_toss_guess:heads')
      .text('Tails 🪙', 'cric_toss_guess:tails');
      
    await ctx.editMessageText(tossText, { parse_mode: 'HTML', reply_markup: keyboard }).catch(()=>{});
  }
});
''',
    content,
    flags=re.DOTALL
)

# Chunk 4
content = content.replace(
    '''          cricLobby.overs = parsedOvers;
          cricLobby.status = 'toss_guess';
          
          const tossText = 
            `🪙 <b>TOSS TIME!</b> 🪙\\n` +
            `═════════════════════════════\\n` +
            `• <b>Length:</b> ${parsedOvers} Over(s)\\n` +
            `• Host: @${escapeHTML(cricLobby.host.username)}\\n` +
            `• Guest: @${escapeHTML(cricLobby.guest.username)}\\n\\n` +
            `👉 @${escapeHTML(cricLobby.guest.username)}, call the toss:`;

          const keyboard = new InlineKeyboard()
            .text('Heads 🪙', 'cric_toss_guess:heads')
            .text('Tails 🪙', 'cric_toss_guess:tails');
            
          await ctx.reply(tossText, { parse_mode: 'HTML', reply_markup: keyboard });
          return;''',
    '''          cricLobby.overs = parsedOvers;
          
          if (cricLobby.iplMode) {
            cricLobby.status = 'ipl_team_picker';
            
            const teams = Object.keys(IPL_SQUADS_POOL);
            const kb = new InlineKeyboard();
            for (let i = 0; i < teams.length; i += 2) {
              const row = [teams[i], teams[i + 1]].filter(Boolean);
              kb.row(...row.map(t => ({ text: t, callback_data: `cipl_pick_team:${t}:${cricLobby.chatId}` })));
            }
            
            await ctx.reply(
              `🏆 <b>IPL 2026 MODE</b> 🏆\\n` +
              `═══════════════════════════════\\n` +
              `• Length: ${parsedOvers} Over(s)\\n\\n` +
              `👇 @${escapeHTML(cricLobby.host.username)} (Host), pick <b>your team</b>:`,
              { parse_mode: 'HTML', reply_markup: kb }
            );
            return;
          } else {
            cricLobby.status = 'toss_guess';
            
            const tossText = 
              `🪙 <b>TOSS TIME!</b> 🪙\\n` +
              `═════════════════════════════\\n` +
              `• <b>Length:</b> ${parsedOvers} Over(s)\\n` +
              `• Host: @${escapeHTML(cricLobby.host.username)}\\n` +
              `• Guest: @${escapeHTML(cricLobby.guest.username)}\\n\\n` +
              `👉 @${escapeHTML(cricLobby.guest.username)}, call the toss:`;

            const keyboard = new InlineKeyboard()
              .text('Heads 🪙', 'cric_toss_guess:heads')
              .text('Tails 🪙', 'cric_toss_guess:tails');
              
            await ctx.reply(tossText, { parse_mode: 'HTML', reply_markup: keyboard });
            return;
          }'''
)

with open('bot.js', 'w') as f:
    f.write(content)

print("Done")
