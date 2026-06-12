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

  // Find majority price for each OVR
  const ovrMap = {};
  players.forEach(p => {
    if (!ovrMap[p.ovr]) {
      ovrMap[p.ovr] = {};
    }
    const price = p.buy_price || 0;
    ovrMap[p.ovr][price] = (ovrMap[p.ovr][price] || 0) + 1;
  });

  const majorityPrices = {};
  Object.entries(ovrMap).forEach(([ovr, prices]) => {
    const sorted = Object.entries(prices).sort((a, b) => b[1] - a[1]);
    majorityPrices[ovr] = parseInt(sorted[0][0]);
  });

  // Find players with non-majority prices
  const anomalies = [];
  players.forEach(p => {
    const majPrice = majorityPrices[p.ovr];
    if (p.buy_price !== majPrice) {
      anomalies.push({
        id: p.id,
        name: p.name,
        ovr: p.ovr,
        price: p.buy_price,
        expected: majPrice
      });
    }
  });

  console.log(`Found ${anomalies.length} pricing anomalies out of ${players.length} players:`);
  
  // Sort anomalies by OVR desc
  anomalies.sort((a, b) => b.ovr - a.ovr);
  
  anomalies.forEach(a => {
    console.log(`Player: "${a.name}" | OVR: ${a.ovr} | Price: ${a.price} | Expected: ${a.expected}`);
  });
}

inspect();
