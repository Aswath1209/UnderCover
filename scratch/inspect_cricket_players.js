const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || 'https://yjsotgclzaiahobhzupu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseKey) {
  console.error("Missing SUPABASE_KEY!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Fetching player counts...");
  
  let allPlayers = [];
  let from = 0;
  const limit = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('cricketplayers')
      .select('name, country, ovr, role')
      .range(from, from + limit - 1);
      
    if (error) {
      console.error("Error fetching:", error);
      break;
    }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  
  console.log(`Total players in DB: ${allPlayers.length}`);
  
  // Group by country
  const countries = {};
  allPlayers.forEach(p => {
    countries[p.country] = (countries[p.country] || 0) + 1;
  });
  
  console.log("Players by country:");
  console.log(JSON.stringify(countries, null, 2));
  
  // Sort players by OVR descending to see the top players
  const top10 = [...allPlayers].sort((a,b) => b.ovr - a.ovr).slice(0, 20);
  console.log("Top 20 Players in DB:");
  console.log(top10);
  
  // Let's search specifically for some Zimbabwe players to see if they exist
  const zim = allPlayers.filter(p => p.country === 'Zimbabwe');
  console.log(`Zimbabwe players in DB (${zim.length}):`);
  console.log(zim.map(p => `${p.name} (${p.ovr} OVR)`).slice(0, 15));
}

run();
