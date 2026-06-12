const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkKeshavOwners() {
  const { data: owners, error } = await supabase
    .from('user_owned_players')
    .select('user_id, acquired_at')
    .eq('player_id', '0c7d494e-b09a-4352-858a-9757a2c1c6bf');

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log(`There are ${owners.length} current owners of Keshav Maharaj.`);
  
  const userIds = owners.map(o => o.user_id);
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('user_id, first_name, coins')
    .in('user_id', userIds);

  if (profErr) {
    console.error("Error fetching profiles:", profErr);
    return;
  }

  console.log("Owner profiles:");
  console.log(profiles);
}

checkKeshavOwners();
