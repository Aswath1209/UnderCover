require('dotenv').config();
const sb = require('./db/supabase');
async function check() {
  const matches = await sb.getActiveCricketMatches();
  if (matches.length > 0) {
    matches.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const m = matches[0];
    console.log("Match ID:", m.id);
    const state = m.state_json;
    console.log("state.iplMode:", state.iplMode);
    console.log("host.xi length:", state.host.xi ? state.host.xi.length : 'undefined');
    console.log("guest.xi length:", state.guest ? (state.guest.xi ? state.guest.xi.length : 'undefined') : 'N/A');
    console.log("host.telegramId:", state.host.telegramId);
  } else {
    console.log("No active matches.");
  }
}
check();
