require('dotenv').config();
const sb = require('../db/supabase');

// Mock resolveCaptain function to verify its behavior
async function resolveCaptain(userId) {
  try {
    const squad = await sb.getUserCricketTeam(userId);
    if (!squad || squad.length === 0) return null;

    const assignedCaptainId = await sb.getCaptain(userId, 'cricket');
    if (assignedCaptainId) {
      const captainPlayer = squad.find(p => p.id === assignedCaptainId);
      if (captainPlayer) {
        return captainPlayer;
      }
    }

    // Fallback: highest rated player in the team
    const sorted = [...squad].sort((a, b) => {
      if (b.ovr !== a.ovr) return b.ovr - a.ovr;
      const bBat = b.batting_rating || 0;
      const aBat = a.batting_rating || 0;
      if (bBat !== aBat) return bBat - aBat;
      return a.name.localeCompare(b.name);
    });

    return sorted[0];
  } catch (e) {
    console.error("Error in resolveCaptain:", e);
    return null;
  }
}

async function test() {
  if (!sb.supabase) {
    console.log("No supabase client initialized.");
    return;
  }

  const testUserId = 999999999; // Test user ID
  console.log("Starting captain logic tests for User ID:", testUserId);

  // 1. Clean up any existing test records
  console.log("Cleaning up existing test data...");
  await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);

  try {
    // 2. Fetch some player IDs from cricketplayers to populate user squad
    const { data: players, error: pErr } = await sb.supabase.from('cricketplayers').select('*').limit(3);
    if (pErr || !players || players.length < 3) {
      throw new Error("Failed to load sample players from DB");
    }

    const [p1, p2, p3] = players;
    console.log(`Using players:
    - ${p1.name} (OVR: ${p1.ovr})
    - ${p2.name} (OVR: ${p2.ovr})
    - ${p3.name} (OVR: ${p3.ovr})`);

    // Insert squad players (sport = 'cricket')
    await sb.supabase.from('user_owned_players').insert([
      { user_id: testUserId, player_id: p1.id, sport: 'cricket', squad_order: 1 },
      { user_id: testUserId, player_id: p2.id, sport: 'cricket', squad_order: 2 },
      { user_id: testUserId, player_id: p3.id, sport: 'cricket', squad_order: 3 }
    ]);

    // Find the highest rated player among them
    const sortedMock = [p1, p2, p3].sort((a, b) => b.ovr - a.ovr);
    const expectedDefaultCaptain = sortedMock[0];

    // TEST 1: Default captain when none is explicitly assigned
    const cap1 = await resolveCaptain(testUserId);
    console.log(`TEST 1 (No captain assigned): Resolved Captain = ${cap1 ? cap1.name : 'null'} (Expected: ${expectedDefaultCaptain.name})`);
    if (cap1 && cap1.id === expectedDefaultCaptain.id) {
      console.log("✅ TEST 1 PASSED!");
    } else {
      console.log("❌ TEST 1 FAILED!");
    }

    // TEST 2: Assign a captain manually (e.g. p2)
    console.log(`Assigning ${p2.name} as captain...`);
    const setRes = await sb.setCaptain(testUserId, p2.id, 'cricket');
    if (!setRes.success) throw new Error("Failed to assign captain: " + setRes.error);

    const cap2 = await resolveCaptain(testUserId);
    console.log(`TEST 2 (Assigned captain): Resolved Captain = ${cap2 ? cap2.name : 'null'} (Expected: ${p2.name})`);
    if (cap2 && cap2.id === p2.id) {
      console.log("✅ TEST 2 PASSED!");
    } else {
      console.log("❌ TEST 2 FAILED!");
    }

    // TEST 3: "Sold" the captain (delete p2 from user_owned_players)
    console.log(`Simulating sell/removal of captain ${p2.name}...`);
    await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId).eq('player_id', p2.id).eq('sport', 'cricket');

    // Expected fallback is now the highest rated remaining player among p1 and p3
    const remainingMock = [p1, p3].sort((a, b) => b.ovr - a.ovr);
    const expectedFallbackAfterSell = remainingMock[0];

    const cap3 = await resolveCaptain(testUserId);
    console.log(`TEST 3 (Captain sold/removed): Resolved Captain = ${cap3 ? cap3.name : 'null'} (Expected fallback: ${expectedFallbackAfterSell.name})`);
    if (cap3 && cap3.id === expectedFallbackAfterSell.id) {
      console.log("✅ TEST 3 PASSED!");
    } else {
      console.log("❌ TEST 3 FAILED!");
    }

  } finally {
    // Cleanup
    console.log("Cleaning up test records...");
    await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);
    console.log("Cleanup done.");
  }
}

test().catch(console.error);
