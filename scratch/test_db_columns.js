require('dotenv').config();
const sb = require('../db/supabase');

async function test() {
  console.log("Fetching a profile to check columns...");
  const { data, error } = await sb.supabase.from('profiles').select('*').limit(1);
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Columns:", Object.keys(data[0] || {}));
    console.log("Sample profile:", data[0]);
  }
  
  console.log("Fetching a user_owned_players row to check columns...");
  const { data: owned, error: ownedErr } = await sb.supabase.from('user_owned_players').select('*').limit(1);
  if (ownedErr) {
    console.error("Error:", ownedErr);
  } else {
    console.log("Columns:", Object.keys(owned[0] || {}));
    console.log("Sample owned player:", owned[0]);
  }
}

test().catch(console.error);
