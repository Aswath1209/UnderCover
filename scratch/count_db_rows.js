require('dotenv').config();
const sb = require('../db/supabase');

async function test() {
  const { count, error } = await sb.supabase
    .from('user_owned_players')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Total user owned players rows:", count);
  }

  const { count: profileCount, error: profileErr } = await sb.supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  if (profileErr) {
    console.error("Error:", profileErr);
  } else {
    console.log("Total profiles rows:", profileCount);
  }
}

test().catch(console.error);
