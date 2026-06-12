const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, coins, wins, matches_played')
    .order('coins', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Top 20 users by coins:");
  console.log(data);
}

checkProfiles();
