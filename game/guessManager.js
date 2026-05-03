const fs = require('fs');
const path = require('path');

const wordsPath = path.join(__dirname, '../data/guessWords.json');
const wordsData = JSON.parse(fs.readFileSync(wordsPath, 'utf8')).words;

// chatId -> { host, currentWord, isGuessingEnabled, lastWinnerId, winnerPriorityTimer }
const activeGames = new Map();

function createGame(chatId, host) {
    const game = {
        chatId,
        host: host, // { id, first_name }
        currentWord: getRandomWord(),
        isGuessingEnabled: true,
        priorityActive: false,
        lastWinnerId: null,
        winnerPriorityTimer: null,
        startTime: Date.now()
    };
    activeGames.set(chatId, game);
    return game;
}

function getRandomWord() {
    return wordsData[Math.floor(Math.random() * wordsData.length)];
}

function getGame(chatId) {
    return activeGames.get(chatId);
}

function nextWord(chatId) {
    const game = activeGames.get(chatId);
    if (!game) return null;
    game.currentWord = getRandomWord();
    return game.currentWord;
}

function endGame(chatId) {
    const game = activeGames.get(chatId);
    if (game && game.winnerPriorityTimer) clearTimeout(game.winnerPriorityTimer);
    activeGames.delete(chatId);
}

function checkGuess(chatId, guess) {
    const game = activeGames.get(chatId);
    if (!game || !game.isGuessingEnabled) return false;
    
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = game.currentWord.toLowerCase().trim();
    
    // Exact match or very close match (handle variations like MS Dhoni vs Dhoni if needed)
    return normalizedGuess === normalizedWord;
}

function getAllGames() {
    return activeGames;
}

module.exports = {
    createGame,
    getGame,
    getAllGames,
    nextWord,
    endGame,
    checkGuess,
    getRandomWord
};
