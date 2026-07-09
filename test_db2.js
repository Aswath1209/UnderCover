const { Match } = require('./game/matchManager');
const m = new Match({ id: '1', type: 'pvp', chatId: 1, totalOvers: 2, pitch: 'pace', host: {}, guest: {} });
m.iplMode = true;
console.log(m.serialize().iplMode);
