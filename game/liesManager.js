const fs = require('fs');
const path = require('path');

const quizPath = path.join(__dirname, '../data/quiz.json');
const quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));

const lobbies = new Map();

class LiesManager {
  createLobby(chatId, host, challenger = null, rounds = 10) {
    const lobby = {
      chatId,
      players: [host],
      challengerId: challenger?.id || null, // If null, anyone can join
      isDirect: !!challenger,
      scores: { [host.id]: 0 },
      state: 'LOBBY',
      round: 0,
      totalRounds: rounds,
      currentQuestion: null,
      submissions: {}, // userId -> { type, value }
      askedQuestions: [], // Track indices to avoid repetition
      createdAt: Date.now(),
      timer: null
    };
    if (challenger) {
        lobby.players.push(challenger);
        lobby.scores[challenger.id] = 0;
    }
    lobbies.set(chatId, lobby);
    return lobby;
  }

  getLobby(chatId) { return lobbies.get(chatId); }
  hasLobby(chatId) { return lobbies.has(chatId); }
  getLobbyByUserId(userId) {
    for (const lobby of lobbies.values()) {
        if (lobby.players.find(p => p.id === userId)) return lobby;
    }
    return null;
  }
  deleteLobby(chatId) { lobbies.delete(chatId); }
  getActiveGamesCount() { return lobbies.size; }

  joinLobby(chatId, user) {
    const lobby = lobbies.get(chatId);
    if (!lobby || lobby.state !== 'LOBBY') return false;
    if (lobby.players.length >= 2) return false;
    if (lobby.isDirect && user.id !== lobby.challengerId) return false;
    
    lobby.players.push(user);
    lobby.scores[user.id] = 0;
    return true;
  }

  nextRound(chatId) {
    const lobby = lobbies.get(chatId);
    if (!lobby) return null;
    
    lobby.round++;
    if (lobby.round > lobby.totalRounds) {
        lobby.state = 'END';
        return { type: 'END' };
    }

    lobby.state = 'QUIZ_PHASE';
    lobby.submissions = {};
    
    // Pick random question that hasn't been asked
    const availableIndices = quizData.questions
        .map((_, i) => i)
        .filter(i => !lobby.askedQuestions.includes(i));
    
    if (availableIndices.length === 0) {
        lobby.state = 'END';
        return { type: 'END' };
    }

    const qIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    lobby.askedQuestions.push(qIndex);
    lobby.currentQuestion = quizData.questions[qIndex];
    
    return { type: 'ROUND', round: lobby.round, question: lobby.currentQuestion.q };
  }

  submitChoice(userId, type, value = "") {
    const lobby = this.getLobbyByUserId(userId);
    if (!lobby || lobby.state !== 'QUIZ_PHASE') return { error: "No active quiz phase." };
    if (lobby.submissions[userId]) return { error: "Already submitted." };

    lobby.submissions[userId] = { type, value: value.toLowerCase().trim() };
    const allDone = Object.keys(lobby.submissions).length === 2;
    return { success: true, allDone };
  }

  checkAnswer(input, questionObj) {
    if (!input) return false;
    const variants = questionObj.v.map(v => v.toLowerCase());
    return variants.some(v => input.includes(v) || v.includes(input));
  }

  calculateResults(chatId) {
    const lobby = lobbies.get(chatId);
    if (!lobby) return null;

    const p1 = lobby.players[0];
    const p2 = lobby.players[1];
    const s1 = lobby.submissions[p1.id];
    const s2 = lobby.submissions[p2.id];
    const q = lobby.currentQuestion;

    const res = {
      [p1.id]: { points: 0, correct: false, action: s1.type, value: s1.value },
      [p2.id]: { points: 0, correct: false, action: s2.type, value: s2.value }
    };

    const is1Correct = s1.type === 'answer' && this.checkAnswer(s1.value, q);
    const is2Correct = s2.type === 'answer' && this.checkAnswer(s2.value, q);
    res[p1.id].correct = is1Correct;
    res[p2.id].correct = is2Correct;

    // SCORING LOGIC
    if (s1.type === 'answer' && s2.type === 'answer') {
        if (is1Correct && is2Correct) { res[p1.id].points = 1; res[p2.id].points = 1; }
        else if (is1Correct) { res[p1.id].points = 1; }
        else if (is2Correct) { res[p2.id].points = 1; }
    } 
    else if (s1.type === 'steal' && s2.type === 'steal') {
        res[p1.id].points = -2; res[p2.id].points = -2;
    }
    else if (s1.type === 'steal') {
        if (is2Correct) { res[p1.id].points = 2; res[p2.id].points = 0; }
        else { res[p1.id].points = -2; }
    }
    else if (s2.type === 'steal') {
        if (is1Correct) { res[p2.id].points = 2; res[p1.id].points = 0; }
        else { res[p2.id].points = -2; }
    }

    lobby.scores[p1.id] += res[p1.id].points;
    lobby.scores[p2.id] += res[p2.id].points;

    return { results: res, scores: lobby.scores, question: q.a };
  }
}

module.exports = new LiesManager();
