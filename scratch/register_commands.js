require('dotenv').config();
const { bot } = require('../bot');

async function run() {
  console.log("Registering bot commands on Telegram API...");
  await bot.api.setMyCommands([
    { command: "play", description: "Start an Undercover lobby" },
    { command: "mafia", description: "Start a Mafia lobby" },
    { command: "lies", description: "Challenge someone to Game of Lies" },
    { command: "drop", description: "🎁 Mystery Coin Drop (300-5000)" },
    { command: "spin", description: "🎡 Spin the wheel to win Will Jacks" },
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
  ]);
  console.log("Successfully registered commands!");
  process.exit(0);
}

run().catch(console.error);
