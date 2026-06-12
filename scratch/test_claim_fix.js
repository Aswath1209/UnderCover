require('dotenv').config({ path: 'undercover-bot/.env' });
const sb = require('../db/supabase');

async function testClaim() {
  const testUserId = 888888888; // dummy ID
  console.log(`--- Running Starter Pack Claim Test for User ID: ${testUserId} ---`);

  // Ensure database client is active
  if (!sb.supabase) {
    console.error("Database connection is disabled.");
    return;
  }

  // 1. Clean up existing dummy user data first
  console.log("Cleaning up test user data...");
  await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);
  await sb.supabase.from('profiles').delete().eq('user_id', testUserId);

  // 2. Insert fresh profile with claimed_starter: false
  console.log("Creating new user profile (claimed_starter = false)...");
  await sb.supabase.from('profiles').insert({
    user_id: testUserId,
    first_name: "TestUser",
    claimed_starter: false,
    coins: 2000
  });

  // 3. Claim starter pack first time
  console.log("First claim attempt...");
  const claim1 = await sb.claimStarterPack(testUserId);
  console.log("First claim result success:", claim1.success);
  console.log("First claim result player count:", claim1.players ? claim1.players.length : 0);

  // Verify profile states
  const { data: profileAfter1 } = await sb.supabase
    .from('profiles')
    .select('claimed_starter')
    .eq('user_id', testUserId)
    .single();
  console.log("Profile claimed_starter state:", profileAfter1 ? profileAfter1.claimed_starter : null);

  // 4. Sell some players (delete from user_owned_players to simulate selling)
  console.log("Simulating player sales to reduce squad size below 11...");
  const { data: ownedRows } = await sb.supabase
    .from('user_owned_players')
    .select('player_id')
    .eq('user_id', testUserId);
  console.log(`Initial squad size: ${ownedRows ? ownedRows.length : 0}`);

  if (ownedRows && ownedRows.length > 0) {
    // Delete 5 players
    const toDelete = ownedRows.slice(0, 5).map(r => r.player_id);
    await sb.supabase.from('user_owned_players')
      .delete()
      .eq('user_id', testUserId)
      .in('player_id', toDelete);
  }

  const { data: ownedRowsAfter } = await sb.supabase
    .from('user_owned_players')
    .select('player_id')
    .eq('user_id', testUserId);
  console.log(`Squad size after simulated sales: ${ownedRowsAfter ? ownedRowsAfter.length : 0}`);

  // 5. Claim starter pack second time (expecting ALREADY_CLAIMED, no backfill)
  console.log("Second claim attempt (with squad size < 11)...");
  const claim2 = await sb.claimStarterPack(testUserId);
  console.log("Second claim result success:", claim2.success);
  console.log("Second claim result error:", claim2.error);

  // Verify squad size did not change
  const { data: ownedRowsFinal } = await sb.supabase
    .from('user_owned_players')
    .select('player_id')
    .eq('user_id', testUserId);
  console.log(`Final squad size (should still be same): ${ownedRowsFinal ? ownedRowsFinal.length : 0}`);

  // 6. Final Clean up
  console.log("Cleaning up test user data...");
  await sb.supabase.from('user_owned_players').delete().eq('user_id', testUserId);
  await sb.supabase.from('profiles').delete().eq('user_id', testUserId);
  
  console.log("Test finished!");
}

testClaim().catch(console.error);
