require('dotenv').config();
const sb = require('./db/supabase');
async function check() {
  const matches = await sb.getActiveCricketMatches();
  if (matches.length > 0) {
    matches.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const m = matches[0];
    const state = m.state_json;
    console.log("Match ID:", m.id);
    console.log("Host ID:", state.host.telegramId);
    console.log("Guest ID:", state.guest ? state.guest.telegramId : 'None');
  }
}
check();
