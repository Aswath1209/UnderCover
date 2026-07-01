const squadsData = require('../data/squads.json');
const campaignStore = require('../db/campaignStore');
const pveEngine = require('./pveEngine');
const supabaseHelper = require('../db/supabase');

/**
 * Maps a roster from squads.json to database cards.
 * If a card doesn't exist, it inserts it into Supabase.
 */
async function resolveSquadRoster(roster, countryName, dbPlayers, supabaseHelper) {
  const resolved = [];
  for (const member of roster) {
    let matchCard = dbPlayers.find(p => p.name.trim().toLowerCase() === member.name.trim().toLowerCase());
    
    if (!matchCard && supabaseHelper.supabase) {
      try {
        const crypto = require('crypto');
        const newId = crypto.randomUUID();
        const roleLower = (member.role || 'batsman').toLowerCase().replace(' ', '_');
        
        let bowlerType = null;
        let bowlingArchetype = null;
        let battingArchetype = member.role === 'Bowler' ? null : 'Classic';
        
        if (member.bowl > 50) {
          bowlerType = member.bowl > 85 ? 'right-arm fast' : 'right-arm offbreak';
          bowlingArchetype = member.bowl > 85 ? 'Pacer' : 'Spinner';
        }

        const newPlayer = {
          id: newId,
          name: member.name,
          country: countryName,
          role: roleLower === 'wicketkeeper' ? 'wicket_keeper' : roleLower === 'all-rounder' ? 'all_rounder' : roleLower,
          batting_rating: member.bat || member.ovr || 50,
          bowling_rating: member.bowl || 15,
          ovr: member.ovr || 50,
          bowler_type: bowlerType,
          buy_price: Math.floor((member.ovr || 50) * 700),
          tier: 'Normal',
          batting_archetype: battingArchetype,
          bowling_archetype: bowlingArchetype,
          created_at: new Date().toISOString()
        };

        const { data, error } = await supabaseHelper.supabase
          .from('cricketplayers')
          .insert([newPlayer])
          .select();

        if (!error && data && data.length > 0) {
          matchCard = data[0];
          dbPlayers.push(matchCard);
          console.log(`[TournamentManager] Created missing player card: ${member.name}`);
        } else {
          console.error('[TournamentManager] Failed to create player card:', error);
        }
      } catch (err) {
        console.error('[TournamentManager] Exception creating player card:', err);
      }
    }

    if (matchCard) {
      resolved.push({
        ...member,
        id: matchCard.id,
        ovr: member.ovr,
        bat: member.bat,
        bowl: member.bowl
      });
    } else {
      resolved.push(member);
    }
  }
  return resolved;
}

// Team Tier configuration for dynamic rewards
const TEAM_TIERS = {
  // IPL Teams
  'CSK': { tier: 'S', multiplier: 1.0 },
  'MI': { tier: 'S', multiplier: 1.0 },
  'RCB': { tier: 'A', multiplier: 1.25 },
  'PBKS': { tier: 'D', multiplier: 3.0 },
  
  // World Cup Teams
  'IND': { tier: 'S', multiplier: 1.0 },
  'AUS': { tier: 'S', multiplier: 1.0 },
  'PAK': { tier: 'B', multiplier: 1.5 },
  'ZIM': { tier: 'D', multiplier: 3.0 },
  'USA': { tier: 'D', multiplier: 3.0 }
};

/**
 * Gets the multiplier for a team
 */
function getTeamRewardMultiplier(teamKey) {
  return TEAM_TIERS[teamKey]?.multiplier || 1.0;
}

/**
 * Generates tournament fixtures schedules.
 * In each round, we schedule the player's match and simulate the rest.
 */
function generateSchedule(type, edition, playerTeam, teamsList) {
  const fixtures = [];
  const opponents = teamsList.filter(t => t !== playerTeam);
  
  // Create round-robin fixtures for the player
  opponents.forEach((opp, index) => {
    fixtures.push({
      round: index + 1,
      matchId: `${type}_${edition}_R${index + 1}`,
      playerTeam: playerTeam,
      opponentTeam: opp,
      status: 'PENDING',
      result: null,
      playerScore: null,
      opponentScore: null,
      // Record fixtures for other AI teams in this round
      otherFixtures: generateAIFixturesForRound(index + 1, playerTeam, opp, teamsList)
    });
  });

  return fixtures;
}

/**
 * Helper to pair other AI teams in the round.
 */
function generateAIFixturesForRound(round, playerTeam, playerOpponent, teamsList) {
  const remaining = teamsList.filter(t => t !== playerTeam && t !== playerOpponent);
  const aiFixtures = [];
  
  // Simple matchmaking: pair them sequentially
  for (let i = 0; i < remaining.length; i += 2) {
    if (i + 1 < remaining.length) {
      aiFixtures.push({
        teamA: remaining[i],
        teamB: remaining[i + 1],
        status: 'PENDING',
        winner: null,
        scoreA: null,
        scoreB: null
      });
    }
  }
  return aiFixtures;
}

/**
 * Simulates an AI vs AI match.
 */
function simulateAIMatch(teamA, teamB) {
  // Simple random score generator mimicking realistic scores
  const scoreA = Math.floor(Math.random() * 80) + 120; // 120 - 200 runs
  const scoreB = Math.floor(Math.random() * 80) + 120;
  
  let winner = teamA;
  if (scoreB > scoreA) {
    winner = teamB;
  } else if (scoreA === scoreB) {
    winner = Math.random() < 0.5 ? teamA : teamB;
  }

  return {
    scoreA,
    scoreB,
    winner
  };
}

/**
 * Initializes a new campaign session.
 * Integrates owned cards as upgraded stats overrides.
 */
async function startCampaign(userId, username, type, edition, playerTeam, difficulty = 'MEDIUM') {
  const editionTeams = squadsData[type]?.[edition];
  if (!editionTeams) {
    throw new Error(`Invalid tournament type or edition: ${type} ${edition}`);
  }

  const teamsKeys = Object.keys(editionTeams);
  if (!teamsKeys.includes(playerTeam)) {
    throw new Error(`Team ${playerTeam} not found in ${type} ${edition}`);
  }

  // Get default roster
  let playerSquad = JSON.parse(JSON.stringify(editionTeams[playerTeam].roster));

  // Resolve base players to database cards first
  try {
    const dbPlayers = await supabaseHelper.getCricketPlayers();
    playerSquad = await resolveSquadRoster(playerSquad, editionTeams[playerTeam].name, dbPlayers, supabaseHelper);
  } catch (e) {
    console.error('[TournamentManager] Failed to resolve base player cards:', e);
  }

  // Sync / Override player cards using Supabase inventory
  try {
    const ownedPlayers = await supabaseHelper.getUserCricketTeam(userId);
    if (ownedPlayers && ownedPlayers.length > 0) {
      playerSquad = playerSquad.map(member => {
        // Find matching player by name (case-insensitive and trimmed)
        const matchCard = ownedPlayers.find(op => 
          op.name.trim().toLowerCase() === member.name.trim().toLowerCase()
        );
        if (matchCard && (matchCard.ovr || 0) > (member.ovr || 0)) {
          return {
            ...member,
            id: matchCard.id, // Replace with db player id
            ovr: matchCard.ovr,
            bat: matchCard.batting_rating || member.bat,
            bowl: matchCard.bowling_rating || member.bowl,
            upgraded: true // Tag to show in UI
          };
        }
        return member;
      });
    }
  } catch (e) {
    console.error('[TournamentManager] Failed to apply player card upgrades:', e);
  }

  const schedule = generateSchedule(type, edition, playerTeam, teamsKeys);

  // Initialize standings
  const standings = {};
  teamsKeys.forEach(t => {
    standings[t] = {
      teamKey: t,
      name: editionTeams[t].name,
      logo: editionTeams[t].logo || '🏏',
      played: 0,
      won: 0,
      lost: 0,
      pts: 0,
      nrr: 0.0
    };
  });

  const campaign = {
    userId,
    username,
    type,
    edition,
    playerTeam,
    difficulty,
    status: 'ACTIVE', // 'ACTIVE', 'PLAYOFFS', 'COMPLETED'
    currentRound: 1,
    schedule,
    standings,
    playerSquad,
    activeMatchState: null
  };

  await campaignStore.saveCampaign(userId, campaign);
  return campaign;
}

/**
 * Initiates the next match in the tournament schedule.
 */
async function startNextMatch(userId) {
  const campaign = await campaignStore.getCampaign(userId);
  if (!campaign || campaign.status === 'COMPLETED') {
    return null;
  }

  let opponentTeam = null;
  let isPlayoffsMatch = false;

  if (campaign.status === 'PLAYOFFS' && campaign.playoffsFixture) {
    opponentTeam = campaign.playoffsFixture.opponent;
    isPlayoffsMatch = true;
  } else {
    const nextFixture = campaign.schedule.find(f => f.round === campaign.currentRound && f.status === 'PENDING');
    if (!nextFixture) {
      if (campaign.status === 'ACTIVE') {
        return startPlayoffs(campaign);
      }
      return null;
    }
    opponentTeam = nextFixture.opponentTeam;
  }

  const opponentTeamData = squadsData[campaign.type][campaign.edition][opponentTeam];
  let opponentSquad = JSON.parse(JSON.stringify(opponentTeamData.roster));

  try {
    const dbPlayers = await supabaseHelper.getCricketPlayers();
    opponentSquad = await resolveSquadRoster(opponentSquad, opponentTeamData.name, dbPlayers, supabaseHelper);
  } catch (e) {
    console.error('[TournamentManager] Failed to resolve opponent squad cards:', e);
  }
  
  // Create match state
  const matchState = pveEngine.createMatch({
    playerTeam: campaign.playerTeam,
    opponentTeam: opponentTeam,
    tournamentType: campaign.type,
    edition: campaign.edition,
    playerSquad: campaign.playerSquad,
    opponentSquad: opponentSquad,
    totalOvers: campaign.type === 'ODI_WC' ? 5 : 2, // 5 overs for ODI, 2 for T20
    maxWickets: 3
  });

  campaign.activeMatchState = matchState;
  await campaignStore.saveCampaign(userId, campaign);
  return campaign;
}

/**
 * Plays a ball in the user's active tournament match.
 */
async function playMatchBall(userId, playerChoice) {
  const campaign = await campaignStore.getCampaign(userId);
  if (!campaign || !campaign.activeMatchState) {
    return { error: 'No active match found' };
  }

  const outcome = pveEngine.playBall(campaign.activeMatchState, playerChoice);

  if (outcome.matchCompleted) {
    await resolveCurrentRound(campaign, campaign.activeMatchState);
  } else {
    await campaignStore.saveCampaign(userId, campaign);
  }

  return {
    outcome,
    campaign
  };
}

/**
 * Resolves current round of matches.
 * Calculates difficulty rewards and transfers coins.
 */
async function resolveCurrentRound(campaign, finishedMatchState) {
  const playerWon = finishedMatchState.innings === 2 
    ? (finishedMatchState.firstBatting === 'ai' ? finishedMatchState.player.score >= finishedMatchState.target : finishedMatchState.ai.score < finishedMatchState.target - 1)
    : (finishedMatchState.firstBatting === 'player' ? finishedMatchState.player.score < finishedMatchState.ai.score : finishedMatchState.ai.score < finishedMatchState.player.score);

  const multiplier = getTeamRewardMultiplier(campaign.playerTeam);
  let coinsEarned = 0;
  let messageExtra = '';

  if (campaign.status === 'PLAYOFFS' && campaign.playoffsFixture) {
    const fixture = campaign.playoffsFixture;
    fixture.status = 'COMPLETED';
    fixture.result = playerWon ? 'WON' : 'LOST';
    fixture.playerScore = finishedMatchState.player.score;
    fixture.opponentScore = finishedMatchState.ai.score;

    if (playerWon) {
      if (fixture.round === 'SEMIFINAL') {
        // Qualify to Final
        campaign.playoffsFixture = {
          round: 'GRAND_FINAL',
          opponent: getOtherPlayoffsWinner(campaign),
          status: 'PENDING'
        };
        // Semifinal win reward
        coinsEarned = Math.floor(10000 * multiplier);
        messageExtra = `🏆 Semifinal Victory! You won ${coinsEarned.toLocaleString()} coins! (Difficulty Multiplier: ${multiplier}x)`;
      } else if (fixture.round === 'GRAND_FINAL') {
        // CHAMPION!
        campaign.status = 'COMPLETED';
        campaign.winner = campaign.playerTeam;
        
        // Tournament victory rewards (Base: 50,000)
        coinsEarned = Math.floor(50000 * multiplier);
        messageExtra = `🏆 CHAMPIONS! You won ${coinsEarned.toLocaleString()} coins for winning the tournament! (Difficulty Multiplier: ${multiplier}x)`;
      }
    } else {
      // Knocked out!
      campaign.status = 'COMPLETED';
      campaign.winner = fixture.opponent;
      messageExtra = `❌ You were knocked out of the playoffs! Better luck next campaign.`;
    }
  } else {
    // Normal group match
    const fixture = campaign.schedule.find(f => f.round === campaign.currentRound);
    fixture.status = 'COMPLETED';
    fixture.result = playerWon ? 'WON' : 'LOST';
    fixture.playerScore = finishedMatchState.player.score;
    fixture.opponentScore = finishedMatchState.ai.score;

    // Update standings for player and opponent
    const playerStand = campaign.standings[campaign.playerTeam];
    const oppStand = campaign.standings[fixture.opponentTeam];
    
    playerStand.played++;
    oppStand.played++;

    if (playerWon) {
      playerStand.won++;
      playerStand.pts += 2;
      oppStand.lost++;
      
      // Match win reward (Base: 2,500)
      coinsEarned = Math.floor(2500 * multiplier);
      messageExtra = `🏏 Match Won! You earned ${coinsEarned.toLocaleString()} coins. (Difficulty Multiplier: ${multiplier}x)`;
    } else {
      oppStand.won++;
      oppStand.pts += 2;
      playerStand.lost++;
      messageExtra = `Match Lost. No coins rewarded.`;
    }

    // Simulate other fixtures in this round
    if (fixture.otherFixtures) {
      fixture.otherFixtures.forEach(fix => {
        const res = simulateAIMatch(fix.teamA, fix.teamB);
        fix.status = 'COMPLETED';
        fix.winner = res.winner;
        fix.scoreA = res.scoreA;
        fix.scoreB = res.scoreB;

        // Update standings
        const standA = campaign.standings[fix.teamA];
        const standB = campaign.standings[fix.teamB];
        standA.played++;
        standB.played++;

        if (res.winner === fix.teamA) {
          standA.won++;
          standA.pts += 2;
          standB.lost++;
        } else {
          standB.won++;
          standB.pts += 2;
          standA.lost++;
        }
      });
    }

    // Advance round
    campaign.currentRound++;

    // Check if group stage is completed
    const totalRounds = Object.keys(campaign.standings).length - 1;
    if (campaign.currentRound > totalRounds) {
      startPlayoffs(campaign);
    }
  }

  // Clear active match state
  campaign.activeMatchState = null;

  // Add coins to user if earned
  if (coinsEarned > 0) {
    try {
      await supabaseHelper.addCoins(campaign.userId, coinsEarned);
    } catch (e) {
      console.error('[TournamentManager] Failed to credit coin rewards:', e);
    }
  }

  // Set response message to display to the user
  campaign.lastRewardMessage = messageExtra;

  await campaignStore.saveCampaign(campaign.userId, campaign);
}

/**
 * Plays playoffs semifinal matching
 */
function startPlayoffs(campaign) {
  // Sort standings
  const sorted = Object.values(campaign.standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.won - a.won;
  });

  const playerQualified = sorted.slice(0, 4).some(team => team.teamKey === campaign.playerTeam);

  if (!playerQualified) {
    campaign.status = 'COMPLETED';
    campaign.playoffMessage = `❌ Campaign Over! Your team finished ${sorted.findIndex(t => t.teamKey === campaign.playerTeam) + 1}th. You failed to qualify for the playoffs.`;
  } else {
    campaign.status = 'PLAYOFFS';
    // Player is paired 1st vs 4th or 2nd vs 3rd depending on standings rank
    const playerRank = sorted.findIndex(t => t.teamKey === campaign.playerTeam);
    let opponent = '';
    
    if (playerRank === 0) opponent = sorted[3].teamKey; // 1st vs 4th
    else if (playerRank === 1) opponent = sorted[2].teamKey; // 2nd vs 3rd
    else if (playerRank === 2) opponent = sorted[1].teamKey; // 3rd vs 2nd
    else opponent = sorted[0].teamKey; // 4th vs 1st

    campaign.playoffsFixture = {
      round: 'SEMIFINAL',
      opponent: opponent,
      status: 'PENDING'
    };
    campaign.playoffMessage = `🎉 **Playoffs Qualified!** Your team qualified for the Semi-Finals against ${campaign.standings[opponent].name}!`;
  }
}

/**
 * Returns other match playoffs winner dynamically
 */
function getOtherPlayoffsWinner(campaign) {
  // Returns a random team from top 4 that is NOT the player and NOT the player's semifinal opponent
  const sorted = Object.values(campaign.standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.won - a.won;
  });
  
  const candidates = sorted.slice(0, 4)
    .map(t => t.teamKey)
    .filter(t => t !== campaign.playerTeam && t !== campaign.playoffsFixture.opponent);

  return candidates[Math.floor(Math.random() * candidates.length)] || 'AUS';
}

module.exports = {
  startCampaign,
  startNextMatch,
  playMatchBall
};
