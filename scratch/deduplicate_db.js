const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const standardPrices = {
  64: 400,
  65: 450,
  66: 500,
  67: 550,
  68: 600,
  69: 650,
  70: 700,
  71: 750,
  72: 800,
  73: 850,
  74: 900,
  75: 1100,
  76: 3250,
  77: 6755,
  78: 10250,
  79: 14600,
  80: 31445,
  81: 56420,
  82: 84750,
  83: 137650,
  84: 214750,
  85: 335250,
  86: 460550,
  87: 545250,
  88: 650575,
  89: 786750,
  90: 960500,
  91: 1200000,
  92: 1505000,
  93: 1840650,
  94: 2110725,
  95: 2605500,
  96: 3050000,
  97: 3500000,
  98: 4155500,
  99: 4525000
};

async function getCricketPlayers() {
  let allPlayers = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('cricketplayers')
      .select('*')
      .range(from, from + limit - 1);
    if (error) {
      console.error("Error fetching cricket players range:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  return allPlayers;
}

async function run() {
  console.log("Fetching all cricket players from Supabase...");
  const players = await getCricketPlayers();
  console.log(`Fetched ${players.length} players.`);

  // Apply in-memory price correction to determine true values
  const correctedPlayers = players.map(p => {
    const expectedPrice = standardPrices[p.ovr];
    const needsPriceFix = expectedPrice !== undefined && (p.buy_price || 0) < expectedPrice;
    return {
      ...p,
      corrected_price: needsPriceFix ? expectedPrice : (p.buy_price || 0),
      needs_price_fix: needsPriceFix
    };
  });

  // Group by player name
  const nameMap = {};
  correctedPlayers.forEach(p => {
    if (!nameMap[p.name]) {
      nameMap[p.name] = [];
    }
    nameMap[p.name].push(p);
  });

  const toKeep = [];
  const toDelete = [];

  for (const [name, list] of Object.entries(nameMap)) {
    if (list.length > 1) {
      // Sort by OVR desc, then corrected price desc, then ID
      list.sort((a, b) => {
        if ((b.ovr || 0) !== (a.ovr || 0)) {
          return (b.ovr || 0) - (a.ovr || 0);
        }
        if (b.corrected_price !== a.corrected_price) {
          return b.corrected_price - a.corrected_price;
        }
        return a.id.localeCompare(b.id);
      });
      toKeep.push(list[0]);
      toDelete.push(...list.slice(1));
    } else {
      toKeep.push(list[0]);
    }
  }

  console.log(`Plan: Keep ${toKeep.length} players, Delete ${toDelete.length} duplicates.`);

  // 1. Process duplicate players: migrate ownerships and delete
  for (let i = 0; i < toDelete.length; i++) {
    const delPlayer = toDelete[i];
    const keepPlayer = toKeep.find(p => p.name === delPlayer.name);

    console.log(`\nProcessing duplicate: "${delPlayer.name}"`);
    console.log(`  KEEP ID: ${keepPlayer.id} | OVR: ${keepPlayer.ovr} | Price: ${keepPlayer.corrected_price}`);
    console.log(`  DEL ID : ${delPlayer.id} | OVR: ${delPlayer.ovr} | Price: ${delPlayer.buy_price}`);

    // Check if any users own the duplicate player
    const { data: ownedRecords, error: ownedErr } = await supabase
      .from('user_owned_players')
      .select('id, user_id, squad_order')
      .eq('player_id', delPlayer.id)
      .eq('sport', 'cricket');

    if (ownedErr) {
      console.error(`  Error checking ownership for ${delPlayer.name}:`, ownedErr);
      continue;
    }

    if (ownedRecords && ownedRecords.length > 0) {
      console.log(`  Found ${ownedRecords.length} users owning this duplicate card.`);
      for (const rec of ownedRecords) {
        // Check if the user already owns the KEEP version
        const { data: keepOwned, error: keepOwnedErr } = await supabase
          .from('user_owned_players')
          .select('id')
          .eq('user_id', rec.user_id)
          .eq('player_id', keepPlayer.id)
          .eq('sport', 'cricket')
          .maybeSingle();

        if (keepOwnedErr) {
          console.error(`    Error checking keep ownership for user ${rec.user_id}:`, keepOwnedErr);
          continue;
        }

        if (keepOwned) {
          // User already owns the KEEP version, delete the duplicate ownership row
          console.log(`    User ${rec.user_id} already owns KEEP card. Deleting duplicate ownership record.`);
          const { error: delOwnErr } = await supabase
            .from('user_owned_players')
            .delete()
            .eq('id', rec.id);
          if (delOwnErr) {
            console.error(`      Failed to delete duplicate ownership record:`, delOwnErr);
          }
        } else {
          // User does not own KEEP version, update player_id to keepPlayer.id
          console.log(`    User ${rec.user_id} does not own KEEP card. Updating player_id to ${keepPlayer.id}.`);
          const { error: updOwnErr } = await supabase
            .from('user_owned_players')
            .update({ player_id: keepPlayer.id })
            .eq('id', rec.id);
          if (updOwnErr) {
            console.error(`      Failed to update ownership record:`, updOwnErr);
          }
        }
      }
    }

    // Now delete from cricketplayers
    console.log(`  Deleting duplicate player row from database...`);
    const { error: delPlErr } = await supabase
      .from('cricketplayers')
      .delete()
      .eq('id', delPlayer.id);
    if (delPlErr) {
      console.error(`  Failed to delete player row:`, delPlErr);
    } else {
      console.log(`  Successfully deleted duplicate card for "${delPlayer.name}".`);
    }
  }

  // 2. Apply pricing fixes to all kept players whose database price is too low
  console.log("\nChecking and applying pricing fixes...");
  for (let i = 0; i < toKeep.length; i++) {
    const player = toKeep[i];
    if (player.needs_price_fix) {
      console.log(`Updating price for "${player.name}": ${player.buy_price} -> ${player.corrected_price} (OVR ${player.ovr})`);
      const { error: updPriceErr } = await supabase
        .from('cricketplayers')
        .update({ buy_price: player.corrected_price })
        .eq('id', player.id);
      if (updPriceErr) {
        console.error(`  Failed to update price for ${player.name}:`, updPriceErr);
      }
    }
  }

  console.log("\nDatabase de-duplication and pricing fix completed!");
}

run();
