require('dotenv').config();
const sb = require('./db/supabase');
async function check() {
  const matches = await sb.getActiveCricketMatches();
  console.log(Object.keys(matches[0]));
  console.log(matches[0].match_id);
}
check();
