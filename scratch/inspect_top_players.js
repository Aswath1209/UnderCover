const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  let allPlayers = [];
  let from = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('cricketplayers')
      .select('*')
      .range(from, from + limit - 1);
    if (error) {
      console.error(error);
      break;
    }
    if (!data || data.length === 0) break;
    allPlayers.push(...data);
    if (data.length < limit) break;
    from += limit;
  }
  
  console.log(`Total players fetched: ${allPlayers.length}`);
  const topPlayers = allPlayers.filter(p => p.ovr >= 92);
  console.log(`Top players (OVR >= 92): ${topPlayers.length}`);
  
  const roles = ['batsman', 'bowler', 'all_rounder', 'wicket_keeper'];
  roles.forEach(role => {
    const rolePlayers = topPlayers.filter(p => p.role === role);
    console.log(`  Role '${role}': ${rolePlayers.length} players`);
    console.log(`    Names:`, rolePlayers.map(p => `${p.name} (${p.ovr})`));
  });
}

check();
