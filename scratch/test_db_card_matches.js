const fs = require('fs');
const path = require('path');
// Let's load supabase credentials from .env
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing supabase credentials in env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const cardDir = path.join(__dirname, '..', 'assets', 'cards');
const cardFiles = fs.readdirSync(cardDir);

function findPreexistingCard(playerName) {
  const target = playerName.toLowerCase().replace(/[\s_]+/g, '');
  const matchedFile = cardFiles.find(f => f.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[\s_]+/g, '') === target);
  if (matchedFile) {
    return matchedFile;
  }
  return null;
}

async function run() {
  const { data: players, error } = await supabase.from('cricketplayers').select('name, ovr');
  if (error) {
    console.error("Error fetching players:", error);
    process.exit(1);
  }

  console.log(`Loaded ${players.length} players from DB.`);
  console.log(`Loaded ${cardFiles.length} card files from assets/cards.`);

  let matchedCount = 0;
  let unmatchedCount = 0;

  players.forEach(p => {
    const matched = findPreexistingCard(p.name);
    if (matched) {
      matchedCount++;
    } else {
      unmatchedCount++;
      if (p.ovr >= 90) {
        console.log(`Unmatched High OVR Player: "${p.name}" (OVR: ${p.ovr})`);
      }
    }
  });

  console.log(`\nMatching Summary:`);
  console.log(`Matched: ${matchedCount}`);
  console.log(`Unmatched: ${unmatchedCount}`);
}

run();
