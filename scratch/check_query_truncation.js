require('dotenv').config();
const sb = require('../db/supabase');

async function test() {
  const { data: owned, error } = await sb.supabase
    .from('user_owned_players')
    .select('user_id, player_id')
    .eq('sport', 'cricket')
    .limit(5000);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Query returned length with limit 5000:", owned.length);
  }
}

test().catch(console.error);
