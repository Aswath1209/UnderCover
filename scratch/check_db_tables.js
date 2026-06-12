const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function listTables() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .limit(1);

  // We can execute raw SQL on supabase or inspect via schema query if we have postgres functions.
  // Wait, let's see what tables we can query directly by checking standard table names.
  // Standard tables in this project: profiles, group_stats, group_settings, bonus_claims, group_rewards, user_owned_players, cricketplayers, hilo_games
  // Let's query pg_tables if we have RPC or we can just try to fetch from some audit/transaction table.
  
  // Let's write a quick query to fetch table names using Postgres catalog if possible, or try common log/transaction names.
  const tables = ['profiles', 'group_stats', 'group_settings', 'bonus_claims', 'group_rewards', 'user_owned_players', 'cricketplayers', 'hilo_games', 'transactions', 'logs', 'audit_log', 'coin_history'];
  for (const t of tables) {
    try {
      const { data, error } = await supabase.from(t).select('*').limit(1);
      if (!error) {
        console.log(`Table exists: ${t}`);
      } else {
        // console.log(`Table error ${t}:`, error.message);
      }
    } catch (e) {
      // console.log(`Table error ${t}:`, e.message);
    }
  }
}

listTables();
