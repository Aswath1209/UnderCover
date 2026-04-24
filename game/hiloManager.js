const stats = require('../data/hiloStats.json');

const activeGames = new Map();

function getRandomPlayer(excludeName = null) {
  let pool = stats;
  if (excludeName) pool = stats.filter(p => p.name !== excludeName);
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomConstraint(player) {
  const keys = Object.keys(player).filter(k => k !== 'name');
  return keys[Math.floor(Math.random() * keys.length)];
}

function createGame(userId, betAmount) {
  const p1 = getRandomPlayer();
  const p2 = getRandomPlayer(p1.name);
  const constraint = getRandomConstraint(p1);
  
  const state = {
    userId,
    betAmount,
    multiplier: 1.0,
    currentPlayer: p1,
    nextPlayer: p2,
    constraint: constraint,
    messageId: null
  };
  
  activeGames.set(userId, state);
  return state;
}

function getGame(userId) {
  return activeGames.get(userId);
}

function endGame(userId) {
  activeGames.delete(userId);
}

function nextRound(userId) {
  const state = activeGames.get(userId);
  if (!state) return null;
  
  // Increase multiplier slowly (+0.2x)
  state.multiplier = parseFloat((state.multiplier + 0.2).toFixed(1));
  
  // Carry over the target player to be the new base player
  state.currentPlayer = state.nextPlayer;
  
  // Pick a new target player ensuring it's not the same player
  state.nextPlayer = getRandomPlayer(state.currentPlayer.name);
  
  // Constraint remains the same!
  return state;
}

function nextRoundDraw(userId) {
  const state = activeGames.get(userId);
  if (!state) return null;
  
  state.currentPlayer = state.nextPlayer;
  state.nextPlayer = getRandomPlayer(state.currentPlayer.name);
  
  // Constraint remains the same!
  return state;
}

module.exports = {
  createGame,
  getGame,
  endGame,
  nextRound,
  nextRoundDraw
};
