const matchManager = require('./game/matchManager');
const lobby = {
  chatId: 123,
  host: { telegramId: 1, username: 'A', xi: [], squad: [] },
  guest: { telegramId: 2, username: 'B', xi: [], squad: [] },
  overs: 2,
  iplMode: true,
  tossWinner: { telegramId: 1 },
  tossDecision: 'bat'
};
const match = matchManager.createMatchFromLobby({ dbMatchId: '123', lobby });
console.log(match.serialize().iplMode);
