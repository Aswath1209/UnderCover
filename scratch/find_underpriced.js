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

  const underpricedList = [];
  players.forEach(p => {
    const oldPrice = legacyPrices[p.id];
    if (oldPrice !== undefined && oldPrice < p.buy_price) {
      underpricedList.push({
        id: p.id,
        name: p.name,
        ovr: p.ovr,
        old_price: oldPrice,
        new_price: p.buy_price,
        diff: p.buy_price - oldPrice
      });
    }
  });

  // Sort by diff descending
  underpricedList.sort((a, b) => b.diff - a.diff);

  console.log(`Found ${underpricedList.length} players who were underpriced.`);
  console.log("Top 15 underpriced player price differences:");
  console.log(underpricedList.slice(0, 15));
}

findUnderpriced();
