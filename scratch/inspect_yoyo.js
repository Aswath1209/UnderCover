const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspectYoyo() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', 8055416217)
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Yoyo's profile:", profile);

  // Check if there are any bonus claims
  const { data: claims } = await supabase
    .from('bonus_claims')
    .select('*')
    .eq('user_id', 8055416217);
  console.log("Yoyo's bonus claims:", claims);

  // Check if they own any football players or other records
  const { data: owned } = await supabase
    .from('user_owned_players')
    .select('*')
    .eq('user_id', 8055416217);
  console.log("Yoyo's owned records (all sports):", owned);
}

inspectYoyo();
