const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const targetUsers = [
  { id: 754870983, name: 'Ajeet Kumar' },
  { id: 8055416217, name: 'Yoyo' },
  { id: 8264932529, name: 'Avneesh' },
  { id: 1315564307, name: 'nooot_your_type' },
  { id: 5659704125, name: 'आर्यन' }
];

async function inspect() {
  for (const user of targetUsers) {
    console.log(`\n================== Inspecting ${user.name} (${user.id}) ==================`);
    
    // 1. Check owned players
    const { data: owned, error: ownedErr } = await supabase
      .from('user_owned_players')
      .select('player_id, sport, acquired_at')
      .eq('user_id', user.id);
    console.log(`Owned players count: ${owned ? owned.length : 0}`);
    if (owned && owned.length > 0) {
      console.log("Sample owned players:", owned.slice(0, 5));
    }

    // 2. Check group rewards
    const { data: rewards, error: rewErr } = await supabase
      .from('group_rewards')
      .select('*')
      .eq('user_id', user.id);
    console.log(`Group rewards count: ${rewards ? rewards.length : 0}`);
    if (rewards && rewards.length > 0) {
      console.log("Rewards:", rewards);
    }

    // 3. Check bonus claims
    const { data: claims, error: claimErr } = await supabase
      .from('bonus_claims')
      .select('*')
      .eq('user_id', user.id);
    console.log(`Bonus claims count: ${claims ? claims.length : 0}`);
    if (claims && claims.length > 0) {
      console.log(`Claims count: ${claims.length}`);
    }
  }
}

inspect();
