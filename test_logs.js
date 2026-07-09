// Fake script to make sure we don't have syntax errors in bot.js
const fs = require('fs');
const botCode = fs.readFileSync('./bot.js', 'utf8');
try {
  require('vm').Script(botCode);
  console.log("No syntax errors");
} catch(e) {
  console.error("Syntax error:", e);
}
