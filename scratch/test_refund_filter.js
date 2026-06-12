const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const legacyPrices = require('../db/legacyPrices.json');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MIGRATION_CUTOFF = new Date('2026-06-05T09:00:00Z');

async function debugFilter() {
  const { data: players } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price');

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

  const { data: owned } = await supabase
    .from('user_owned_players')
    .select('*')
    .eq('user_id', 6296522446)
    .eq('sport', 'cricket');

  console.log("Ayush!'s owned players count:", owned.length);
  owned.forEach(o => {
    const isUnderpriced = underpricedHighOvr[o.player_id] !== undefined;
    const acqDate = new Date(o.acquired_at);
    const isBeforeCutoff = acqDate < MIGRATION_CUTOFF;
    
    console.log(`Player ID: ${o.player_id}`);
    console.log(`  Name: ${isUnderpriced ? underpricedHighOvr[o.player_id].name : 'Not Underpriced'}`);
    console.log(`  OVR check: ${isUnderpriced ? underpricedHighOvr[o.player_id].ovr : 'N/A'}`);
    console.log(`  Is Underpriced & High OVR: ${isUnderpriced}`);
    console.log(`  Acquired At: ${o.acquired_at}`);
    console.log(`  Is Before Cutoff: ${isBeforeCutoff}`);
  });
}

debugFilter();
