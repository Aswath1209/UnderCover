const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspect() {
  const { data: players, error } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price');

  if (error) {
    console.error("Error:", error);
    return;
  }

  // Group by OVR and count occurrences of each price
  const ovrMap = {};
  players.forEach(p => {
    if (!ovrMap[p.ovr]) {
      ovrMap[p.ovr] = {};
    }
    const price = p.buy_price || 0;
    ovrMap[p.ovr][price] = (ovrMap[p.ovr][price] || 0) + 1;
  });

  console.log("OVR to Price distribution (Price: count):");
  Object.keys(ovrMap).sort((a, b) => parseInt(a) - parseInt(b)).forEach(ovr => {
    console.log(`OVR ${ovr}:`);
    const sortedPrices = Object.entries(ovrMap[ovr]).sort((x, y) => y[1] - x[1]);
    sortedPrices.forEach(([price, count]) => {
      console.log(`  Price ${price}: ${count} players`);
    });
  });
}

inspect();
