require('dotenv').config();
const { supabase } = require('../db/supabase');

async function test() {
  if (!supabase) {
    console.log("No supabase");
    return;
  }
  
  // Get one profile
  const { data: pData, error: pErr } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profile columns:", pData ? Object.keys(pData[0] || {}) : pErr);

  // Get one user_owned_player
  const { data: oData, error: oErr } = await supabase.from('user_owned_players').select('*').limit(1);
  console.log("Owned player columns:", oData ? Object.keys(oData[0] || {}) : oErr);
}

test();
