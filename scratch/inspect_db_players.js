require('dotenv').config();
const sb = require('../db/supabase');

const searchTerms = [
  "short", "klaasen", "badoni", "tendulkar", "thushara", "thakur", "sen", "conway", "salt", "green"
];

async function run() {
  const dbPlayers = await sb.getCricketPlayers();
  console.log(`Searching database for: ${searchTerms.join(', ')}`);
  
  dbPlayers.forEach(p => {
    const nameLower = p.name.toLowerCase();
    searchTerms.forEach(term => {
      if (nameLower.includes(term)) {
        console.log(`- Match: "${p.name}" (OVR: ${p.ovr}, Role: ${p.role})`);
      }
    });
  });
}

run();
