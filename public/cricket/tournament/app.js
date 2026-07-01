const TG = window.Telegram?.WebApp;
if (TG) {
  TG.ready();
  TG.expand();
}

// Extract userId from URL query parameter or default to Telegram WebApp user ID
const urlParams = new URLSearchParams(window.location.search);
const userId = urlParams.get('userId') || TG?.initDataUnsafe?.user?.id || 'test_user_123';

let activeCampaign = null;
let currentSelection = {
  tour: 'IPL',
  edition: '2026',
  team: ''
};

// Map of tournament editions
const EDITIONS = {
  IPL: ['2026'],
  T20_WC: ['2026']
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
});

// Helper for API calls
async function apiCall(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    const response = await fetch(endpoint, options);
    return await response.json();
  } catch (error) {
    console.error(`API Call failed to ${endpoint}:`, error);
    alert('Network error. Check connection.');
    return { error: 'Network error' };
  }
}

// Show/Hide Screens
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.add('active');
  }
}

function initApp() {
  checkActiveCampaign();
}

// Check if player has an active save campaign
async function checkActiveCampaign() {
  const res = await apiCall(`/api/tournament/state?userId=${userId}`);
  
  if (res && res.campaign) {
    activeCampaign = res.campaign;
    if (activeCampaign.activeMatchId) {
      window.location.href = `/cricket?match_id=${activeCampaign.activeMatchId}&chat_id=${userId}&userId=${userId}`;
      return;
    }
    renderDashboard();
    showScreen('dashboard-screen');
  } else {
    // Start portal selector flow
    loadPortalOptions();
    showScreen('portal-screen');
  }
}

// Load choices in selection screen
async function loadPortalOptions() {
  // 1. Setup tournament selector
  const tourBtns = document.querySelectorAll('#tour-selector .selector-btn');
  tourBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tour === currentSelection.tour);
  });

  // 2. Load Editions
  const editionContainer = document.getElementById('edition-selector');
  editionContainer.innerHTML = '';
  const editions = EDITIONS[currentSelection.tour] || [];
  currentSelection.edition = editions[0] || '';

  editions.forEach((ed, idx) => {
    const btn = document.createElement('button');
    btn.className = `selector-btn ${idx === 0 ? 'active' : ''}`;
    btn.textContent = ed;
    btn.dataset.edition = ed;
    btn.onclick = () => {
      document.querySelectorAll('#edition-selector .selector-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSelection.edition = ed;
      loadTeams(currentSelection.tour, ed);
    };
    editionContainer.appendChild(btn);
  });

  // 3. Load Teams for active combination
  loadTeams(currentSelection.tour, currentSelection.edition);
}

// Fetch list of teams for tour/edition
async function loadTeams(tour, edition) {
  const res = await apiCall(`/api/tournament/teams?type=${tour}&edition=${edition}`);
  const teamContainer = document.getElementById('team-selector');
  teamContainer.innerHTML = '';
  
  if (res && res.teams) {
    const teamKeys = Object.keys(res.teams);
    currentSelection.team = teamKeys[0] || '';
    
    // Update multiplier badge if any
    updateMultiplierBadge(currentSelection.team);

    teamKeys.forEach((key, idx) => {
      const team = res.teams[key];
      const btn = document.createElement('button');
      btn.className = `team-btn ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `<span>${team.logo || '🏏'}</span> ${team.name}`;
      btn.onclick = () => {
        document.querySelectorAll('#team-selector .team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentSelection.team = key;
        updateMultiplierBadge(key);
      };
      teamContainer.appendChild(btn);
    });
  }
}

// Updates multiplier details based on difficulty
function updateMultiplierBadge(teamKey) {
  const badgeContainer = document.getElementById('multiplier-badge-container');
  const badgeText = document.getElementById('reward-multiplier-text');
  
  // Multilpliers configuration matching backend
  const multipliers = {
    'CSK': { label: 'S-Tier (Meta)', mult: '1.0x' },
    'MI': { label: 'S-Tier (Meta)', mult: '1.0x' },
    'RCB': { label: 'A-Tier (Challenger)', mult: '1.25x' },
    'PBKS': { label: 'D-Tier (Underdog)', mult: '3.0x' },
    'IND': { label: 'S-Tier (Meta)', mult: '1.0x' },
    'AUS': { label: 'S-Tier (Meta)', mult: '1.0x' },
    'PAK': { label: 'B-Tier (Competitor)', mult: '1.5x' },
    'ZIM': { label: 'D-Tier (Underdog)', mult: '3.0x' },
    'USA': { label: 'D-Tier (Underdog)', mult: '3.0x' }
  };

  const info = multipliers[teamKey] || { label: 'Standard', mult: '1.0x' };
  badgeText.innerHTML = `🔥 <strong>${info.label}</strong> &bull; ${info.mult} Coin Multiplier`;
  badgeContainer.classList.remove('hidden');
}

// Set up UI Event listeners
function setupEventListeners() {
  // Tour button change
  document.querySelectorAll('#tour-selector .selector-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('#tour-selector .selector-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSelection.tour = btn.dataset.tour;
      loadPortalOptions();
    };
  });

  // Start campaign button
  document.getElementById('start-campaign-btn').onclick = async () => {
    const username = TG?.initDataUnsafe?.user?.username || TG?.initDataUnsafe?.user?.first_name || 'Player';
    const res = await apiCall('/api/tournament/start', 'POST', {
      userId,
      username,
      type: currentSelection.tour,
      edition: currentSelection.edition,
      playerTeam: currentSelection.team
    });

    if (res && res.campaign) {
      activeCampaign = res.campaign;
      renderDashboard();
      showScreen('dashboard-screen');
    } else {
      alert('Failed to start campaign.');
    }
  };

  // Dashboard Tabs switcher
  document.getElementById('tab-standings').onclick = (e) => switchTab('standings', e.target);
  document.getElementById('tab-fixtures').onclick = (e) => switchTab('fixtures', e.target);
  document.getElementById('tab-squad').onclick = (e) => switchTab('squad', e.target);

  // Play Next Match button
  document.getElementById('play-match-btn').onclick = async () => {
    const res = await apiCall('/api/tournament/match/start', 'POST', { userId });
    
    if (res && res.campaign && res.campaign.activeMatchId) {
      window.location.href = `/cricket?match_id=${res.campaign.activeMatchId}&chat_id=${userId}&userId=${userId}`;
    } else {
      alert('Failed to start campaign match.');
    }
  };

  // Reset Campaign
  document.getElementById('reset-campaign-btn').onclick = async () => {
    if (confirm('Are you sure you want to reset this tournament campaign? Your progress will be lost.')) {
      await apiCall('/api/tournament/reset', 'POST', { userId });
      activeCampaign = null;
      loadPortalOptions();
      showScreen('portal-screen');
    }
  };

  // Quit Gameplay
  document.getElementById('quit-gameplay-btn').onclick = () => {
    if (confirm('Go back to dashboard? Match progress will be paused.')) {
      showScreen('dashboard-screen');
      checkActiveCampaign();
    }
  };

  // Number choices input buttons (1-6)
  document.querySelectorAll('.num-btn').forEach(btn => {
    btn.onclick = () => submitPlayerChoice(parseInt(btn.dataset.val));
  });

  // Close overlay button
  document.getElementById('close-result-overlay-btn').onclick = () => {
    document.getElementById('match-result-overlay').classList.add('hidden');
    showScreen('dashboard-screen');
    checkActiveCampaign();
  };
}

// Switch view tabs in dashboard
function switchTab(tabId, tabButton) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  tabButton.classList.add('active');

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${tabId}`).classList.add('active');
}

// Renders standings, schedules, and lineup list
function renderDashboard() {
  if (!activeCampaign) return;

  // Title info
  const campaignName = `${activeCampaign.type.replace('_', ' ')} ${activeCampaign.edition}`;
  document.getElementById('dash-campaign-badge').textContent = campaignName;
  
  const playerTeamData = activeCampaign.standings[activeCampaign.playerTeam];
  document.getElementById('dash-team-title').textContent = `${playerTeamData.logo} ${playerTeamData.name}`;

  // 1. Render Standings Table
  const standingsBody = document.getElementById('standings-tbody');
  standingsBody.innerHTML = '';
  
  const sortedStandings = Object.values(activeCampaign.standings).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    return b.won - a.won;
  });

  sortedStandings.forEach(row => {
    const tr = document.createElement('tr');
    if (row.teamKey === activeCampaign.playerTeam) {
      tr.className = 'highlight';
    }
    tr.innerHTML = `
      <td>${row.logo} ${row.name}</td>
      <td class="txt-center">${row.played}</td>
      <td class="txt-center">${row.won}</td>
      <td class="txt-center">${row.lost}</td>
      <td class="txt-center" style="font-weight: bold;">${row.pts}</td>
    `;
    standingsBody.appendChild(tr);
  });

  // 2. Render Fixtures List
  const fixturesContainer = document.getElementById('fixtures-list-container');
  fixturesContainer.innerHTML = '';

  activeCampaign.schedule.forEach(f => {
    const card = document.createElement('div');
    card.className = 'fixture-card';
    
    let statusClass = '';
    let statusText = f.status;
    if (f.status === 'COMPLETED') {
      statusClass = f.result === 'WON' ? 'won' : 'lost';
      statusText = `${f.result} (${f.playerScore} vs ${f.opponentScore})`;
    } else if (f.round === activeCampaign.currentRound) {
      statusText = '🔥 Active Match';
    }

    card.innerHTML = `
      <div class="fixture-details">
        <span class="fixture-round">Round ${f.round}</span>
        <span class="fixture-teams">${playerTeamData.name} vs ${activeCampaign.standings[f.opponentTeam].name}</span>
        <span class="fixture-status ${statusClass}">${statusText}</span>
      </div>
    `;
    fixturesContainer.appendChild(card);
  });

  // 3. Render Squad List with upgraded state badge
  const squadContainer = document.getElementById('squad-list-container');
  squadContainer.innerHTML = '';

  activeCampaign.playerSquad.forEach(member => {
    const card = document.createElement('div');
    card.className = 'squad-member-card';
    
    const upgradeBadge = member.upgraded 
      ? '<span class="upgraded-glow-tag">Upgraded Card</span>' 
      : '';

    card.innerHTML = `
      <div>
        <div class="member-name">${member.name} ${upgradeBadge}</div>
        <div class="member-role">${member.role}</div>
      </div>
      <div class="member-ovr">OVR ${member.ovr}</div>
    `;
    squadContainer.appendChild(card);
  });

  // 4. Update Next Match Docked Bar
  const nextFixture = activeCampaign.schedule.find(f => f.round === activeCampaign.currentRound && f.status === 'PENDING');
  if (nextFixture) {
    const oppData = activeCampaign.standings[nextFixture.opponentTeam];
    document.getElementById('next-match-fixtures-label').textContent = `${playerTeamData.logo} vs ${oppData.logo} (Round ${nextFixture.round})`;
    document.querySelector('.next-match-bar').classList.remove('hidden');
  } else {
    // No next fixture (Qualified or completed)
    if (activeCampaign.status === 'PLAYOFFS' && activeCampaign.playoffsFixture) {
      const oppData = activeCampaign.standings[activeCampaign.playoffsFixture.opponent];
      document.getElementById('next-match-fixtures-label').textContent = `${activeCampaign.playoffsFixture.round}: ${playerTeamData.logo} vs ${oppData.logo}`;
      document.querySelector('.next-match-bar').classList.remove('hidden');
    } else {
      document.querySelector('.next-match-bar').classList.add('hidden');
      
      // If completed
      if (activeCampaign.status === 'COMPLETED') {
        const resetBtn = document.getElementById('reset-campaign-btn');
        resetBtn.textContent = 'Restart';
        resetBtn.className = 'btn btn-primary btn-sm';
      }
    }
  }
}

// Loads screen states for live gameplay
function loadGameplayScreen() {
  if (!activeCampaign || !activeCampaign.activeMatchState) return;
  const match = activeCampaign.activeMatchState;
  
  // Header title
  document.getElementById('match-team-header').textContent = `${match.player.teamKey} vs ${match.ai.teamKey}`;

  // Clear commentary
  document.getElementById('game-commentary-feed').innerHTML = '<div class="comment-item">📢 Players are walking out to the middle. Get ready!</div>';

  updateGameplayUI();
}

function updateGameplayUI() {
  const match = activeCampaign.activeMatchState;
  if (!match) return;

  const isPlayerBatting = (match.innings === 1 && match.firstBatting === 'player') ||
                           (match.innings === 2 && match.firstBatting === 'ai');

  const battingTeam = isPlayerBatting ? match.player : match.ai;
  const bowlingTeam = isPlayerBatting ? match.ai : match.player;

  // Score display
  document.getElementById('game-score-display').textContent = `${battingTeam.score}/${battingTeam.wickets}`;
  
  const oversStr = `${Math.floor(battingTeam.balls / 6)}.${battingTeam.balls % 6}`;
  document.getElementById('game-overs').textContent = oversStr;
  document.getElementById('game-total-overs').textContent = `${match.totalOvers}.0`;

  // Innings badge
  const inningsBadge = document.getElementById('game-innings-badge');
  inningsBadge.textContent = match.innings === 1 ? '1st INNINGS' : '2nd INNINGS';

  // Target / runs needed display
  const targetContainer = document.getElementById('game-target-container');
  if (match.innings === 2 && match.target) {
    targetContainer.classList.remove('hidden');
    document.getElementById('game-target-val').textContent = match.target;
    
    const runsNeeded = match.target - battingTeam.score;
    const ballsRemaining = (match.totalOvers * 6) - battingTeam.balls;
    document.getElementById('game-runs-needed-msg').textContent = `Need ${runsNeeded} run(s) from ${ballsRemaining} ball(s)`;
  } else {
    targetContainer.classList.add('hidden');
  }

  // Crease players
  const currentBatsman = battingTeam.battingOrder[battingTeam.currentBatsmanIdx] || { name: '-', runs: 0, balls: 0 };
  const currentBowler = bowlingTeam.bowlers[bowlingTeam.currentBowlerIdx] || { name: '-', wickets: 0, runsConceded: 0, ballsBowled: 0 };

  document.getElementById('crease-batsman-name').textContent = currentBatsman.name;
  document.getElementById('crease-batsman-stats').textContent = `${currentBatsman.runs} (${currentBatsman.balls}b)`;

  document.getElementById('crease-bowler-name').textContent = currentBowler.name;
  const bowlOvers = `${Math.floor(currentBowler.ballsBowled / 6)}.${currentBowler.ballsBowled % 6}`;
  document.getElementById('crease-bowler-stats').textContent = `${currentBowler.wickets}-${currentBowler.runsConceded} (${bowlOvers} ov)`;

  // Prompt Title
  document.getElementById('choice-prompt-title').textContent = isPlayerBatting ? 'CHOOSE YOUR RUNS' : 'CHOOSE BOWLER TRICK';
}

// Submits batsman/bowler number choice
async function submitPlayerChoice(choice) {
  const res = await apiCall('/api/tournament/match/play', 'POST', {
    userId,
    choice
  });

  if (res && res.outcome) {
    // Update state
    activeCampaign = res.campaign;

    // Add commentary
    addCommentary(res.outcome);
    
    if (res.outcome.matchCompleted) {
      setTimeout(() => showMatchCompletedOverlay(res.outcome), 1200);
    } else {
      updateGameplayUI();
    }
  }
}

// Adds commentary line
function addCommentary(outcome) {
  const feed = document.getElementById('game-commentary-feed');
  const match = activeCampaign.activeMatchState;
  if (!match) return;
  const battingTeam = outcome.isPlayerBatting ? match.player : match.ai;

  const over = Math.floor((battingTeam.balls - 1) / 6);
  const ball = ((battingTeam.balls - 1) % 6) + 1;

  const div = document.createElement('div');
  div.className = 'comment-item';
  div.innerHTML = `<span class="comment-ball">${over}.${ball}</span> ${outcome.comment}`;
  
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

// Shows result popup
function showMatchCompletedOverlay(outcome) {
  const match = activeCampaign.activeMatchState || activeCampaign.schedule.find(f => f.round === activeCampaign.currentRound - 1);
  
  document.getElementById('overlay-result-title').textContent = 'Match Finished!';
  
  const wonMatch = outcome.comment.includes('wins') || outcome.comment.includes('successfully');
  document.getElementById('overlay-result-desc').textContent = outcome.comment.split('\n\n').pop();
  
  document.getElementById('mini-team-a-name').textContent = activeCampaign.playerTeam;
  document.getElementById('mini-team-a-score').textContent = `${activeCampaign.activeMatchState ? activeCampaign.activeMatchState.player.score : (activeCampaign.lastMatchState ? activeCampaign.lastMatchState.player.score : 0)} runs`;
  
  document.getElementById('mini-team-b-name').textContent = activeCampaign.activeMatchState ? activeCampaign.activeMatchState.ai.teamKey : 'OPP';
  document.getElementById('mini-team-b-score').textContent = `${activeCampaign.activeMatchState ? activeCampaign.activeMatchState.ai.score : (activeCampaign.lastMatchState ? activeCampaign.lastMatchState.ai.score : 0)} runs`;

  // Render last reward coins message if present
  const rewardContainer = document.getElementById('overlay-reward-container');
  if (activeCampaign.lastRewardMessage) {
    rewardContainer.innerHTML = activeCampaign.lastRewardMessage;
    rewardContainer.classList.remove('hidden');
  } else {
    rewardContainer.classList.add('hidden');
  }

  document.getElementById('match-result-overlay').classList.remove('hidden');
}
