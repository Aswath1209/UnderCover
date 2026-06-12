const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkAyushNames() {
  const { data: owned, error } = await supabase
    .from('user_owned_players')
    .select('player_id')
    .eq('user_id', 6296522446)
    .eq('sport', 'cricket');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const ids = owned.map(o => o.player_id);
  const { data: players, error: plErr } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price')
    .in('id', ids);

  if (plErr) {
    console.error("Error:", plErr);
    return;
  }

  console.log("Ayush!'s owned player details:");
  players.forEach(p => {
    console.log(`- ${p.name} (ID: ${p.id}, OVR: ${p.ovr}, Price: ${p.buy_price})`);
  });
}

checkAyushNames();
