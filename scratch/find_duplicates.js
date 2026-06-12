const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspect() {
  const { data: players, error } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price, role, country, tier');

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log(`Fetched ${players.length} players.`);

  // Find duplicates by name
  const nameMap = {};
  players.forEach(p => {
    if (!nameMap[p.name]) {
      nameMap[p.name] = [];
    }
    nameMap[p.name].push(p);
  });

  const duplicates = Object.entries(nameMap).filter(([name, list]) => list.length > 1);

  console.log(`Found ${duplicates.length} duplicate player names:`);
  for (const [name, list] of duplicates) {
    console.log(`\nPlayer: "${name}"`);
    list.forEach(p => {
      console.log(`  ID: ${p.id} | OVR: ${p.ovr} | Price: ${p.buy_price} | Role: ${p.role} | Country: ${p.country}`);
    });
  }
}

inspect();
