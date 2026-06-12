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
      console.error("Error fetching cricket players:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  return allPlayers;
}

async function verify() {
  console.log("Fetching all cricket players...");
  const players = await getCricketPlayers();
  console.log(`Fetched ${players.length} players from Supabase.`);

  // 1. Check for duplicates
  const nameMap = {};
  players.forEach(p => {
    if (!nameMap[p.name]) {
      nameMap[p.name] = [];
    }
    nameMap[p.name].push(p);
  });

  const duplicates = Object.entries(nameMap).filter(([name, list]) => list.length > 1);
  if (duplicates.length === 0) {
    console.log("✅ Check 1: 0 duplicates found in database.");
  } else {
    console.error(`❌ Check 1: Found ${duplicates.length} duplicate groups!`);
    for (const [name, list] of duplicates) {
      console.log(`  Duplicate Group: "${name}"`);
      list.forEach(p => console.log(`    ID: ${p.id} | OVR: ${p.ovr} | Price: ${p.buy_price}`));
    }
  }

  // 2. Check for pricing anomalies (under-priced players)
  const priceAnomalies = [];
  players.forEach(p => {
    const expected = standardPrices[p.ovr];
    if (expected !== undefined && p.buy_price < expected) {
      priceAnomalies.push(p);
    }
  });

  if (priceAnomalies.length === 0) {
    console.log("✅ Check 2: 0 pricing anomalies (under-priced players) found in database.");
  } else {
    console.error(`❌ Check 2: Found ${priceAnomalies.length} under-priced players!`);
    priceAnomalies.forEach(p => {
      console.log(`  Player: "${p.name}" | OVR: ${p.ovr} | Price: ${p.buy_price} | Expected: ${standardPrices[p.ovr]}`);
    });
  }

  // 3. Check for orphaned player IDs in user owned players
  console.log("Fetching all user owned cricket player records...");
  let ownedRecords = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('user_owned_players')
      .select('id, user_id, player_id')
      .eq('sport', 'cricket')
      .range(from, from + limit - 1);
    if (error) {
      console.error("Error fetching owned records:", error);
      break;
    }
    if (!data || data.length === 0) break;
    ownedRecords.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  console.log(`Fetched ${ownedRecords.length} user owned players.`);

  const validPlayerIds = new Set(players.map(p => p.id));
  const invalidOwned = ownedRecords.filter(r => !validPlayerIds.has(r.player_id));

  if (invalidOwned.length === 0) {
    console.log("✅ Check 3: 0 orphaned player IDs found in user_owned_players.");
  } else {
    console.error(`❌ Check 3: Found ${invalidOwned.length} orphaned references in user_owned_players!`);
    invalidOwned.forEach(r => {
      console.log(`  Owned Record ID: ${r.id} | User ID: ${r.user_id} | Orphaned Player ID: ${r.player_id}`);
    });
  }
}

verify();
