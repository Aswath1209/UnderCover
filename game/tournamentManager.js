const squadsData = require('../data/squads.json');
const campaignStore = require('../db/campaignStore');
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
        id: matchCard.id,
        name: matchCard.name,
        role: matchCard.role,
        ovr: member.ovr, // squad base rating
        batting_rating: member.bat,
        bowling_rating: member.bowl,
        batting_hand: matchCard.batting_hand || member.batting_hand || 'right',
        batting_archetype: matchCard.batting_archetype || member.batting_archetype || 'Anchor',
        bowler_type: matchCard.bowler_type || member.bowler_type || 'fast',
        upgraded: member.upgraded || false
      });
    } else {
      const roleLower = (member.role || 'batsman').toLowerCase().replace(' ', '_');
      resolved.push({
        id: member.id || `temp_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        name: member.name,
        role: roleLower === 'wicketkeeper' ? 'wicket_keeper' : roleLower === 'all-rounder' ? 'all_rounder' : roleLower,
        ovr: member.ovr || 50,
        batting_rating: member.bat || member.ovr || 50,
        bowling_rating: member.bowl || 15,
        batting_hand: member.batting_hand || 'right',
        batting_archetype: member.batting_archetype || 'Anchor',
        bowler_type: member.bowler_type || 'fast',
        upgraded: member.upgraded || false
      });
    }
  }
  return resolved;
}

// Team Tier configuration for dynamic rewards
const TEAM_TIERS = {
  // IPL Teams
  'CSK': { tier: 'S', multiplier: 1.0 },
  'MI': { tier: 'S', multiplier: 1.0 },
  'KKR': { tier: 'S', multiplier: 1.0 },
  'SRH': { tier: 'S', multiplier: 1.0 },
  'RR': { tier: 'S', multiplier: 1.0 },
  'RCB': { tier: 'A', multiplier: 1.25 },
  'GT': { tier: 'A', multiplier: 1.25 },
  'LSG': { tier: 'B', multiplier: 1.5 },
  'DC': { tier: 'C', multiplier: 2.0 },
  'PBKS': { tier: 'D', multiplier: 3.0 },
  
  // World Cup Teams
  'IND': { tier: 'S', multiplier: 1.0 },
  'AUS': { tier: 'S', multiplier: 1.0 },
  'ENG': { tier: 'S', multiplier: 1.0 },
  'SA': { tier: 'A', multiplier: 1.25 },
  'NZ': { tier: 'A', multiplier: 1.25 },
  'PAK': { tier: 'B', multiplier: 1.5 },
  'WI': { tier: 'B', multiplier: 1.5 },
  'AFG': { tier: 'C', multiplier: 2.0 },
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
        const matchCard = ownedPlayers.find(op => 
          op.name.trim().toLowerCase() === member.name.trim().toLowerCase()
        );
        if (matchCard && (matchCard.ovr || 0) > (member.ovr || 0)) {
          return {
            ...member,
            id: matchCard.id, // Replace with db player id
            ovr: matchCard.ovr,
            role: matchCard.role || member.role,
            batting_rating: matchCard.batting_rating || member.batting_rating,
            bowling_rating: matchCard.bowling_rating || member.bowling_rating,
            batting_hand: matchCard.batting_hand || member.batting_hand,
            batting_archetype: matchCard.batting_archetype || member.batting_archetype,
            bowler_type: matchCard.bowler_type || member.bowler_type,
            upgraded: true
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
    activeMatchState: null,
    activeMatchId: null
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

  if (campaign.status === 'PLAYOFFS' && campaign.playoffsFixture) {
    opponentTeam = campaign.playoffsFixture.opponent;
  } else {
    const nextFixture = campaign.schedule.find(f => f.round === campaign.currentRound && f.status === 'PENDING');
    if (!nextFixture) {
      if (campaign.status === 'ACTIVE') {
        startPlayoffs(campaign);
        await campaignStore.saveCampaign(userId, campaign);
        return campaign;
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
  
  const matchId = `camp_${userId}_${Date.now()}`;
  const matchManager = require('./matchManager');
  
  matchManager.createCampaignMatch({
    dbMatchId: matchId,
    userId: userId,
    username: campaign.username,
    playerTeam: campaign.playerTeam,
    opponentTeam: opponentTeam,
    playerSquad: campaign.playerSquad,
    opponentSquad: opponentSquad,
    totalOvers: campaign.type === 'ODI_WC' ? 5 : 2
  });

  campaign.activeMatchState = { status: 'PLAYING' };
  campaign.activeMatchId = matchId;
  await campaignStore.saveCampaign(userId, campaign);
  
  return campaign;
}

/**
 * Dummy function for backward compatibility
 */
async function playMatchBall(userId, playerChoice) {
  return { error: 'Campaign matches are played in the main web app now.' };
}

/**
 * Plays playoffs semifinal matching
 */
function startPlayoffs(campaign) {
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
    const playerRank = sorted.findIndex(t => t.teamKey === campaign.playerTeam);
    let opponent = '';
    
    if (playerRank === 0) opponent = sorted[3].teamKey;
    else if (playerRank === 1) opponent = sorted[2].teamKey;
    else if (playerRank === 2) opponent = sorted[1].teamKey;
    else opponent = sorted[0].teamKey;

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
  const sorted = Object.values(campaign.standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.won - a.won;
  });
  
  const candidates = sorted.slice(0, 4)
    .map(t => t.teamKey)
    .filter(t => t !== campaign.playerTeam && t !== campaign.playoffsFixture.opponent);

  return candidates[Math.floor(Math.random() * candidates.length)] || 'AUS';
}

/**
 * Resolves campaign match when standard match completes
 */
async function resolveCampaignMatch(userId, finishedMatch) {
  const campaign = await campaignStore.getCampaign(userId);
  if (!campaign) return;

  const inn1 = finishedMatch.innings[0];
  const inn2 = finishedMatch.innings[1];
  
  let playerWon = false;
  if (inn2.runs >= inn2.target) {
    playerWon = inn2.battingId.toString() === userId.toString();
  } else if (inn2.runs < inn1.runs) {
    playerWon = inn1.battingId.toString() === userId.toString();
  } else {
    playerWon = Math.random() < 0.5;
  }

  const multiplier = getTeamRewardMultiplier(campaign.playerTeam);
  let coinsEarned = 0;
  let messageExtra = '';

  let playerRuns = 0;
  let oppRuns = 0;
  if (inn1.battingId.toString() === userId.toString()) {
    playerRuns = inn1.runs;
    oppRuns = inn2.runs;
  } else {
    playerRuns = inn2.runs;
    oppRuns = inn1.runs;
  }

  if (campaign.status === 'PLAYOFFS' && campaign.playoffsFixture) {
    const fixture = campaign.playoffsFixture;
    fixture.status = 'COMPLETED';
    fixture.result = playerWon ? 'WON' : 'LOST';
    fixture.playerScore = playerRuns;
    fixture.opponentScore = oppRuns;

    if (playerWon) {
      if (fixture.round === 'SEMIFINAL') {
        campaign.playoffsFixture = {
          round: 'GRAND_FINAL',
          opponent: getOtherPlayoffsWinner(campaign),
          status: 'PENDING'
        };
        coinsEarned = Math.floor(10000 * multiplier);
        messageExtra = `🏆 Semifinal Victory! You won ${coinsEarned.toLocaleString()} coins! (Difficulty Multiplier: ${multiplier}x)`;
      } else if (fixture.round === 'GRAND_FINAL') {
        campaign.status = 'COMPLETED';
        campaign.winner = campaign.playerTeam;
        coinsEarned = Math.floor(50000 * multiplier);
        messageExtra = `🏆 CHAMPIONS! You won ${coinsEarned.toLocaleString()} coins for winning the tournament! (Difficulty Multiplier: ${multiplier}x)`;
      }
    } else {
      campaign.status = 'COMPLETED';
      campaign.winner = fixture.opponent;
      messageExtra = `❌ You were knocked out of the playoffs! Better luck next campaign.`;
    }
  } else {
    const fixture = campaign.schedule.find(f => f.round === campaign.currentRound);
    if (fixture) {
      fixture.status = 'COMPLETED';
      fixture.result = playerWon ? 'WON' : 'LOST';
      fixture.playerScore = playerRuns;
      fixture.opponentScore = oppRuns;
    }

    const playerStand = campaign.standings[campaign.playerTeam];
    const oppStand = campaign.standings[fixture.opponentTeam];
    
    playerStand.played++;
    oppStand.played++;

    if (playerWon) {
      playerStand.won++;
      playerStand.pts += 2;
      oppStand.lost++;
      coinsEarned = Math.floor(2500 * multiplier);
      messageExtra = `🏏 Match Won! You earned ${coinsEarned.toLocaleString()} coins. (Difficulty Multiplier: ${multiplier}x)`;
    } else {
      oppStand.won++;
      oppStand.pts += 2;
      playerStand.lost++;
      messageExtra = `Match Lost. No coins rewarded.`;
    }

    // Simulate other AI matches in this round
    if (fixture && fixture.otherFixtures) {
      fixture.otherFixtures.forEach(fix => {
        const res = simulateAIMatch(fix.teamA, fix.teamB);
        fix.status = 'COMPLETED';
        fix.winner = res.winner;
        fix.scoreA = res.scoreA;
        fix.scoreB = res.scoreB;

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

    campaign.currentRound++;

    const totalRounds = Object.keys(campaign.standings).length - 1;
    if (campaign.currentRound > totalRounds) {
      startPlayoffs(campaign);
    }
  }

  campaign.activeMatchState = null;
  campaign.activeMatchId = null;

  if (coinsEarned > 0) {
    try {
      await supabaseHelper.addCoins(campaign.userId, coinsEarned);
    } catch (e) {
      console.error('[TournamentManager] Failed to credit coin rewards:', e);
    }
  }

  campaign.lastRewardMessage = messageExtra;
  await campaignStore.saveCampaign(campaign.userId, campaign);

  // Send bot notification
  try {
    const sb = require('../db/supabase');
    const { bot } = require('../bot');
    const { escapeHTML } = require('../utils');
    const profile = await sb.getProfile(userId);
    const username = profile ? profile.first_name : 'Player';
    const text = `🏆 <b>Tournament Match Resolved!</b>\n\n` +
                 `👤 Player: <b>${escapeHTML(username)}</b>\n` +
                 `⚔️ Matchup: <b>${campaign.playerTeam}</b> vs <b>${finishedMatch.guest.username}</b>\n` +
                 `📈 Outcome: <b>${playerWon ? 'WON ✅' : 'LOST ❌'}</b>\n` +
                 `📊 Score: ${inn1.runs}/${inn1.wickets} vs ${inn2.runs}/${inn2.wickets}\n\n` +
                 `${messageExtra}`;

    const cleanHost = process.env.WEBAPP_URL ? process.env.WEBAPP_URL.replace(/^https?:\/\//, '') : 'undercover-fuxy.onrender.com';
    const webAppUrl = `https://${cleanHost}/cricket/tournament?userId=${userId}`;
    const keyboard = {
      inline_keyboard: [
        [{ text: "🎮 Launch Campaign Dashboard", web_app: { url: webAppUrl } }]
      ]
    };

    await bot.api.sendMessage(userId, text, { parse_mode: 'HTML', reply_markup: keyboard });
  } catch (err) {
    console.error("Failed to send tournament completion telegram notification:", err);
  }
}

module.exports = {
  startCampaign,
  startNextMatch,
  playMatchBall,
  resolveCampaignMatch
};
