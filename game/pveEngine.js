const squads = require('../data/squads.json');

/**
 * Creates a new PvE Match State
 */
function createMatch({ playerTeam, opponentTeam, tournamentType, edition, playerSquad, opponentSquad, totalOvers = 2, maxWickets = 3 }) {
  return {
    tournamentType,
    edition,
    totalOvers,
    maxWickets,
    innings: 1, // 1st innings
    firstBatting: Math.random() < 0.5 ? 'player' : 'ai',
    currentBatting: null, // set on start
    status: 'PLAYING',
    
    // Player team state
    player: {
      teamKey: playerTeam,
      score: 0,
      wickets: 0,
      balls: 0,
      battingOrder: playerSquad.map(p => ({ ...p, runs: 0, balls: 0, isOut: false, status: 'NOT_OUT' })),
      bowlers: playerSquad.map(p => ({ ...p, ballsBowled: 0, runsConceded: 0, wickets: 0 })),
      currentBatsmanIdx: 0,
      currentBowlerIdx: 0
    },

    // AI team state
    ai: {
      teamKey: opponentTeam,
      score: 0,
      wickets: 0,
      balls: 0,
      battingOrder: opponentSquad.map(p => ({ ...p, runs: 0, balls: 0, isOut: false, status: 'NOT_OUT' })),
      bowlers: opponentSquad.map(p => ({ ...p, ballsBowled: 0, runsConceded: 0, wickets: 0 })),
      currentBatsmanIdx: 0,
      currentBowlerIdx: 0
    },

    target: null,
    ballsThisOver: 0,
    history: [], // Ball-by-ball logs
    playerLastChoices: [] // Keep track of player's last 5 choices for AI pattern prediction
  };
}

/**
 * Gets the AI's throw (1-6) based on player/opponent rating, role, and player choice patterns.
 * @param {string} role 'batsman' | 'bowler'
 * @param {object} aiPlayer The AI player card
 * @param {object} opponentPlayer The active opponent player card
 * @param {number[]} playerLastChoices Array of recent choices the player made
 * @param {object} situation Context details (target, runs needed, balls left)
 * @returns {number} 1 to 6
 */
function getAIChoice(role, aiPlayer, opponentPlayer, playerLastChoices, situation = {}) {
  // Default equal weight distributions
  let weights = [0.16, 0.16, 0.16, 0.16, 0.16, 0.20]; // 1, 2, 3, 4, 5, 6

  if (role === 'bowler') {
    // Bowler AI: Wants to match the batsman's choice to get a wicket
    // Analyze player's recent choice patterns
    if (playerLastChoices && playerLastChoices.length > 0) {
      const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
      playerLastChoices.forEach(c => counts[c] = (counts[c] || 0) + 1);

      // Skew weights towards most frequent player choices
      const totalRecent = playerLastChoices.length;
      for (let i = 1; i <= 6; i++) {
        const ratio = counts[i] / totalRecent;
        weights[i - 1] = 0.08 + ratio * 0.5; // Skew up to 58% towards their frequent choices
      }
    }

    // High Bowler rating vs weak batsman rating: makes bowler smarter at predicting
    const bowlRating = aiPlayer.bowl || aiPlayer.bowling_rating || 80;
    const batRating = opponentPlayer.bat || opponentPlayer.batting_rating || 80;
    if (bowlRating > batRating + 10) {
      // Skew a little more towards predicting typical safe numbers like 1, 2, 4
      weights[0] += 0.05; // 1
      weights[1] += 0.05; // 2
      weights[3] += 0.05; // 4
    }
  } else {
    // Batsman AI: Wants to score runs without matching the bowler
    // Skew based on batting rating
    const batRating = aiPlayer.bat || aiPlayer.batting_rating || 80;
    const bowlRating = opponentPlayer.bowl || opponentPlayer.bowling_rating || 80;

    if (batRating > 90) {
      // Star batsmen love boundaries (4, 6)
      weights = [0.10, 0.15, 0.10, 0.35, 0.05, 0.25]; // Skew towards 4 and 6
    } else if (batRating < 75) {
      // Tailenders take less risk or throw erratic numbers
      weights = [0.25, 0.25, 0.15, 0.15, 0.10, 0.10]; // Skew towards 1, 2
    }

    // Situation adjustments
    if (situation.runsNeeded && situation.ballsRemaining) {
      const rr = (situation.runsNeeded / situation.ballsRemaining) * 6;
      if (rr > 12) {
        // High chase pressure: MUST go for 4s and 6s
        weights = [0.05, 0.10, 0.05, 0.40, 0.05, 0.35];
      } else if (rr < 4) {
        // Safe chase: play low risk
        weights = [0.30, 0.30, 0.20, 0.10, 0.05, 0.05];
      }
    }
  }

  // Normalize weights
  const sum = weights.reduce((a, b) => a + b, 0);
  const normalized = weights.map(w => w / sum);

  // Cumulative distribution selection
  const rand = Math.random();
  let cumulative = 0;
  for (let i = 0; i < 6; i++) {
    cumulative += normalized[i];
    if (rand <= cumulative) {
      return i + 1;
    }
  }

  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Evaluates special edition trait adjustments.
 */
function applySpecialTraits(match, playerChoice, aiChoice, isPlayerBatting) {
  const activeBatsman = isPlayerBatting 
    ? match.player.battingOrder[match.player.currentBatsmanIdx]
    : match.ai.battingOrder[match.ai.currentBatsmanIdx];

  const activeBowler = isPlayerBatting
    ? match.player.bowlers[match.player.currentBowlerIdx]
    : match.ai.bowlers[match.ai.currentBowlerIdx];

  if (!activeBatsman) return null;

  // 1. T20 World Cup 2007 - Yuvraj Singh Six-Hitter Trait
  if (match.edition === '2007' || match.edition === '2026') {
    if (activeBatsman.name.toLowerCase().includes('yuvraj')) {
      // If Yuvraj chooses 6, and AI bowler chooses 6 (which would be out),
      // Yuvraj has a 25% chance of "powering through" the delivery, escaping the out and scoring 6!
      if (playerChoice === 6 && aiChoice === 6 && Math.random() < 0.25) {
        return { traitTriggered: true, description: "🔥 Yuvraj Singh triggers 'Six-Hitter' trait! Powering through the bowler's trick to smash a massive 6! 💥", customOutcome: 'runs', runs: 6 };
      }
    }
  }

  // 2. MS Dhoni Finisher Trait
  if (activeBatsman.name.toLowerCase().includes('dhoni')) {
    // If chasing in the 2nd innings, Dhoni gets a boost
    if (match.innings === 2) {
      const batTeam = isPlayerBatting ? match.player : match.ai;
      const target = match.target;
      if (target) {
        const runsNeeded = target - batTeam.score;
        if (runsNeeded <= 25 && Math.random() < 0.25) {
          // Escape an OUT
          if (playerChoice === aiChoice) {
            return { 
              traitTriggered: true, 
              description: "🧠 MS Dhoni triggers 'Master Finisher' trait! Calculated escape from a near-wicket delivery! 🏆", 
              customOutcome: 'escape' 
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Plays a single ball in the PvE match.
 * @param {object} match Current match state
 * @param {number} playerChoice Number thrown by player (1-6)
 * @returns {object} Outcome report: { status, runs, wicket, comment, matchCompleted }
 */
function playBall(match, playerChoice) {
  if (match.status === 'COMPLETED') {
    return { matchCompleted: true };
  }

  // Log player choice
  match.playerLastChoices.push(playerChoice);
  if (match.playerLastChoices.length > 5) {
    match.playerLastChoices.shift();
  }

  const isPlayerBatting = (match.innings === 1 && match.firstBatting === 'player') ||
                           (match.innings === 2 && match.firstBatting === 'ai');

  // Identify active players
  const battingTeam = isPlayerBatting ? match.player : match.ai;
  const bowlingTeam = isPlayerBatting ? match.ai : match.player;

  const currentBatsman = battingTeam.battingOrder[battingTeam.currentBatsmanIdx];
  const currentBowler = bowlingTeam.bowlers[bowlingTeam.currentBowlerIdx];

  // Calculate situation parameters for AI
  const situation = {};
  if (match.innings === 2 && match.target) {
    situation.runsNeeded = match.target - battingTeam.score;
    const totalBalls = match.totalOvers * 6;
    situation.ballsRemaining = totalBalls - battingTeam.balls;
  }

  // Get AI Choice
  const aiChoice = getAIChoice(
    isPlayerBatting ? 'bowler' : 'batsman',
    isPlayerBatting ? currentBowler : currentBatsman,
    isPlayerBatting ? currentBatsman : currentBowler,
    match.playerLastChoices,
    situation
  );

  const batChoice = isPlayerBatting ? playerChoice : aiChoice;
  const bowlChoice = isPlayerBatting ? aiChoice : playerChoice;

  let outcome = 'runs';
  let runs = batChoice;
  let wicket = false;
  let comment = '';

  // Apply Special Traits
  const traitReport = applySpecialTraits(match, playerChoice, aiChoice, isPlayerBatting);
  if (traitReport) {
    comment = traitReport.description;
    if (traitReport.customOutcome === 'runs') {
      runs = traitReport.runs;
      wicket = false;
      outcome = 'runs';
    } else if (traitReport.customOutcome === 'escape') {
      // Escape out: batsman scores 1 run instead
      runs = 1;
      wicket = false;
      outcome = 'runs';
    }
  } else {
    // Normal hand cricket outcome
    if (batChoice === bowlChoice) {
      outcome = 'out';
      wicket = true;
      runs = 0;
    }
  }

  // Update Player Stats
  battingTeam.balls++;
  if (currentBatsman) {
    currentBatsman.balls++;
  }
  if (currentBowler) {
    currentBowler.ballsBowled++;
  }

  if (wicket) {
    battingTeam.wickets++;
    if (currentBatsman) {
      currentBatsman.isOut = true;
      currentBatsman.status = 'OUT';
    }
    if (currentBowler) {
      currentBowler.wickets++;
    }

    comment = comment || `❌ OUT! ${currentBatsman ? currentBatsman.name : 'Batsman'} has been dismissed by ${currentBowler ? currentBowler.name : 'Bowler'}! (Matched: ${batChoice})`;
    
    // Rotate to next batsman
    battingTeam.currentBatsmanIdx++;
  } else {
    battingTeam.score += runs;
    if (currentBatsman) {
      currentBatsman.runs += runs;
    }
    if (currentBowler) {
      currentBowler.runsConceded += runs;
    }
    
    comment = comment || `🏏 Score! ${currentBatsman ? currentBatsman.name : 'Batsman'} plays ${runs} run(s).`;
  }

  // Over tracking
  match.ballsThisOver++;
  if (match.ballsThisOver >= 6) {
    match.ballsThisOver = 0;
    // Rotate bowler automatically (simply cycle through bowlers roster)
    bowlingTeam.currentBowlerIdx = (bowlingTeam.currentBowlerIdx + 1) % bowlingTeam.bowlers.length;
  }

  // Check Innings transitions
  let inningsOver = false;
  let matchCompleted = false;

  const totalBallsLimit = match.totalOvers * 6;

  // Innings 1 Ends
  if (match.innings === 1) {
    if (battingTeam.wickets >= match.maxWickets || battingTeam.balls >= totalBallsLimit || battingTeam.currentBatsmanIdx >= battingTeam.battingOrder.length) {
      inningsOver = true;
      match.innings = 2;
      match.target = battingTeam.score + 1;
      match.ballsThisOver = 0;
      comment += `\n\n📢 **Innings Break!** ${battingTeam.teamKey} finishes at ${battingTeam.score}/${battingTeam.wickets}. \n🎯 Target for ${bowlingTeam.teamKey}: **${match.target} runs** from ${totalBallsLimit} balls.`;
    }
  } 
  // Innings 2 Chasing & Game completion
  else if (match.innings === 2) {
    if (battingTeam.score >= match.target) {
      matchCompleted = true;
      match.status = 'COMPLETED';
      comment += `\n\n🏆 **MATCH OVER!** ${battingTeam.teamKey} successfully chased the target and wins by ${match.maxWickets - battingTeam.wickets} wickets! 🎉`;
    } else if (battingTeam.wickets >= match.maxWickets || battingTeam.balls >= totalBallsLimit || battingTeam.currentBatsmanIdx >= battingTeam.battingOrder.length) {
      matchCompleted = true;
      match.status = 'COMPLETED';
      if (battingTeam.score === match.target - 1) {
        comment += `\n\n🤝 **MATCH TIED!** Both teams scored ${battingTeam.score} runs! What a finish!`;
      } else {
        comment += `\n\n🏆 **MATCH OVER!** ${bowlingTeam.teamKey} defends the target and wins by ${match.target - 1 - battingTeam.score} runs! 🎉`;
      }
    }
  }

  // Log to history
  const logEntry = {
    innings: match.innings,
    over: Math.floor((battingTeam.balls - 1) / 6),
    ball: ((battingTeam.balls - 1) % 6) + 1,
    batsman: currentBatsman ? currentBatsman.name : 'Unknown',
    bowler: currentBowler ? currentBowler.name : 'Unknown',
    batChoice,
    bowlChoice,
    runs,
    wicket,
    comment
  };
  match.history.push(logEntry);

  return {
    status: match.status,
    innings: match.innings,
    runs,
    wicket,
    comment,
    matchCompleted,
    isPlayerBatting
  };
}

module.exports = {
  createMatch,
  playBall
};
