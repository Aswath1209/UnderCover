const stats = require('../data/hiloStats.json');

const activeGames = new Map();

function getRandomPlayer(seenPlayersList = []) {
  let pool = stats;
  if (seenPlayersList.length > 0) pool = stats.filter(p => !seenPlayersList.includes(p.name));
  
  // Failsafe if they manage to see all 32 players (insane luck)
  if (pool.length === 0) pool = stats; 
  
  return pool[Math.floor(Math.random() * pool.length)];
}

function getRandomConstraint(player) {
  const keys = Object.keys(player).filter(k => k !== 'name');
  return keys[Math.floor(Math.random() * keys.length)];
}

function createGame(userId, betAmount) {
  const p1 = getRandomPlayer([]);
  const seenPlayers = [p1.name];
  const p2 = getRandomPlayer(seenPlayers);
  seenPlayers.push(p2.name);
  
  const constraint = getRandomConstraint(p1);
  
  const state = {
    userId,
    betAmount,
    multiplier: 1.0,
    currentPlayer: p1,
    nextPlayer: p2,
    constraint: constraint,
    seenPlayers: seenPlayers,
    messageId: null
  };
  
  activeGames.set(userId, state);
  return state;
}

function getGame(userId) {
  return activeGames.get(userId);
}

function getActiveGamesCount() {
  return activeGames.size;
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
  
  // Pick a new target player ensuring it's not a previously seen player
  state.nextPlayer = getRandomPlayer(state.seenPlayers);
  state.seenPlayers.push(state.nextPlayer.name);
  
  // Constraint remains the same!
  return state;
}

function nextRoundDraw(userId) {
  const state = activeGames.get(userId);
  if (!state) return null;
  
  state.currentPlayer = state.nextPlayer;
  state.nextPlayer = getRandomPlayer(state.seenPlayers);
  state.seenPlayers.push(state.nextPlayer.name);
  
  // Constraint remains the same!
  return state;
}

function getRiggedPlayer(basePlayer, constraint, guess, seenPlayersList = []) {
  const baseVal = basePlayer[constraint];
  let pool = stats.filter(p => !seenPlayersList.includes(p.name));
  
  // Failsafe if empty
  if (pool.length === 0) pool = stats;

  let riggedPool = [];
  if (guess === 'higher') {
    // User guessed Higher, so we want a card that is LOWER or EQUAL
    riggedPool = pool.filter(p => p[constraint] <= baseVal);
  } else if (guess === 'lower') {
    // User guessed Lower, so we want a card that is HIGHER or EQUAL
    riggedPool = pool.filter(p => p[constraint] >= baseVal);
  }

  // If we found candidates to make them lose, pick one
  if (riggedPool.length > 0) {
    return riggedPool[Math.floor(Math.random() * riggedPool.length)];
  }

  // If no candidates found to force a loss (rare), just give them a normal random one
  return pool[Math.floor(Math.random() * pool.length)];
}

module.exports = {
  createGame,
  getGame,
  getActiveGamesCount,
  endGame,
  nextRound,
  nextRoundDraw,
  getRiggedPlayer
};
