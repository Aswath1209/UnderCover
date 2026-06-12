const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const legacyPrices = require('../db/legacyPrices.json');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MIGRATION_CUTOFF = new Date('2026-06-05T09:00:00Z');

async function runRefund() {
  console.log("Fetching all cricket players from Supabase...");
  const { data: players, error: plErr } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price');

  if (plErr) {
    console.error("Error fetching players:", plErr);
    return;
  }

  // Identify underpriced players with OVR >= 79
  const underpricedHighOvr = {};
  players.forEach(p => {
    const oldPrice = legacyPrices[p.id];
    if (oldPrice !== undefined && oldPrice < p.buy_price && p.ovr >= 79) {
      underpricedHighOvr[p.id] = {
        name: p.name,
        ovr: p.ovr,
        oldPrice,
        newPrice: p.buy_price
      };
    }
  });

  console.log(`Found ${Object.keys(underpricedHighOvr).length} underpriced high-OVR player definitions.`);

  // Fetch all user owned cricket player records using pagination
  console.log("Fetching all user owned cricket players with pagination...");
  const allOwned = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('user_owned_players')
      .select('*')
      .eq('sport', 'cricket')
      .range(from, from + limit - 1);
    
    if (error) {
      console.error("Error fetching owned players range:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allOwned.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  console.log(`Fetched ${allOwned.length} total owned cricket player records.`);

  // Filter records that need to be refunded
  const toRefund = [];
  allOwned.forEach(o => {
    if (underpricedHighOvr[o.player_id]) {
      const acqDate = new Date(o.acquired_at);
      if (acqDate < MIGRATION_CUTOFF) {
        toRefund.push({
          recordId: o.id,
          userId: o.user_id,
          playerId: o.player_id,
          playerName: underpricedHighOvr[o.player_id].name,
          ovr: underpricedHighOvr[o.player_id].ovr,
          refundAmount: underpricedHighOvr[o.player_id].oldPrice
        });
      }
    }
  });

  if (toRefund.length === 0) {
    console.log("No users own any underpriced high-OVR players that require refunding.");
    return;
  }

  console.log(`\nFound ${toRefund.length} owned player records to refund & remove.`);

  // Group by user for transaction processing
  const userRefunds = {};
  toRefund.forEach(tr => {
    if (!userRefunds[tr.userId]) {
      userRefunds[tr.userId] = {
        userId: tr.userId,
        recordsToDelete: [],
        refundTotal: 0,
        cards: []
      };
    }
    userRefunds[tr.userId].recordsToDelete.push(tr.recordId);
    userRefunds[tr.userId].refundTotal += tr.refundAmount;
    userRefunds[tr.userId].cards.push(`${tr.playerName} (OVR ${tr.ovr}, Refund: ${tr.refundAmount})`);
  });

  for (const userIdStr of Object.keys(userRefunds)) {
    const refundInfo = userRefunds[userIdStr];
    const userId = parseInt(userIdStr);

    console.log(`\n--------------------------------------------`);
    console.log(`Processing Refund for User ID: ${userId}`);
    console.log(`Cards losing:`, refundInfo.cards);
    console.log(`Total refund amount: ${refundInfo.refundTotal} coins`);

    // 1. Fetch current profile to get current coins
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('first_name, coins')
      .eq('user_id', userId)
      .single();

    if (profErr || !profile) {
      console.error(`  Error fetching profile for user ${userId}:`, profErr);
      continue;
    }

    const currentCoins = profile.coins || 0;
    const newCoins = currentCoins + refundInfo.refundTotal;

    // 2. Delete the owned player records
    console.log(`  Deleting ${refundInfo.recordsToDelete.length} ownership records...`);
    const { error: delErr } = await supabase
      .from('user_owned_players')
      .delete()
      .in('id', refundInfo.recordsToDelete);

    if (delErr) {
      console.error(`  Failed to delete ownership records:`, delErr);
      continue;
    }

    // 3. Update the coins balance in the profile
    console.log(`  Updating coin balance: ${currentCoins} -> ${newCoins}...`);
    const { error: coinErr } = await supabase
      .from('profiles')
      .update({ coins: newCoins })
      .eq('user_id', userId);

    if (coinErr) {
      console.error(`  Failed to update coin balance:`, coinErr);
      continue;
    }

    // 4. Re-index remaining squad_order for this user to prevent gaps
    console.log(`  Re-indexing remaining squad list...`);
    const { data: remaining, error: remErr } = await supabase
      .from('user_owned_players')
      .select('id, squad_order')
      .eq('user_id', userId)
      .eq('sport', 'cricket')
      .order('squad_order', { ascending: true });

    if (remErr) {
      console.error(`  Failed to fetch remaining players for re-indexing:`, remErr);
      continue;
    }

    for (let index = 0; index < remaining.length; index++) {
      const rec = remaining[index];
      const correctOrder = index + 1;
      if (rec.squad_order !== correctOrder) {
        const { error: updErr } = await supabase
          .from('user_owned_players')
          .update({ squad_order: correctOrder })
          .eq('id', rec.id);
        if (updErr) {
          console.error(`    Failed to update squad_order for record ${rec.id}:`, updErr);
        }
      }
    }

    console.log(`  Successfully processed refund and re-indexing for ${profile.first_name}.`);
  }

  console.log("\nRefund and removal migration completed successfully!");
}

runRefund();
