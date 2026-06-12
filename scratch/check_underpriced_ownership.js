const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const legacyPrices = require('../db/legacyPrices.json');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function findUnderpriced() {
  const { data: players, error } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const underpricedIds = new Set();
  const playerMap = {};
  players.forEach(p => {
    const oldPrice = legacyPrices[p.id];
    if (oldPrice !== undefined && oldPrice < p.buy_price) {
      underpricedIds.add(p.id);
      playerMap[p.id] = { name: p.name, ovr: p.ovr, oldPrice, newPrice: p.buy_price };
    }
  });

  console.log(`Checking ownership for ${underpricedIds.size} underpriced players with pagination...`);

  // Query user_owned_players with pagination
  const allOwned = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error: ownedErr } = await supabase
      .from('user_owned_players')
      .select('user_id, player_id, acquired_at')
      .eq('sport', 'cricket')
      .range(from, from + limit - 1);

    if (ownedErr) {
      console.error("Error fetching owned players:", ownedErr);
      return;
    }
    if (!data || data.length === 0) break;
    allOwned.push(...data);
    if (data.length < limit) break;
    from += limit;
  }

  const underpricedOwners = [];
  allOwned.forEach(o => {
    if (underpricedIds.has(o.player_id)) {
      underpricedOwners.push({
        user_id: o.user_id,
        player_id: o.player_id,
        player_name: playerMap[o.player_id].name,
        ovr: playerMap[o.player_id].ovr,
        acquired_at: o.acquired_at
      });
    }
  });

  console.log(`\nFound ${underpricedOwners.length} total underpriced card ownership records.`);
  
  // Group by user
  const userGroups = {};
  underpricedOwners.forEach(o => {
    if (!userGroups[o.user_id]) {
      userGroups[o.user_id] = [];
    }
    userGroups[o.user_id].push(o);
  });

  const userIds = Object.keys(userGroups);
  if (userIds.length === 0) {
    console.log("No users own any of the underpriced players!");
    return;
  }

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, first_name, coins')
    .in('user_id', userIds.map(id => parseInt(id)));

  if (profErr) {
    console.error("Error fetching profiles:", profErr);
    return;
  }

  console.log(`\nThere are ${profiles.length} unique users owning these underpriced cards:`);
  profiles.forEach(p => {
    const cards = userGroups[p.user_id];
    console.log(`- User: ${p.first_name} (${p.user_id})`);
    console.log(`  Coins: ${p.coins}`);
    console.log(`  Owned Underpriced Cards (${cards.length}):`);
    cards.forEach(c => {
      console.log(`    • ${c.player_name} (OVR ${c.ovr}) - Acquired: ${c.acquired_at}`);
    });
  });
}

findUnderpriced();
