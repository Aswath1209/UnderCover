const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkAyush() {
  const { data, error } = await supabase
    .from('user_owned_players')
    .select('*')
    .eq('user_id', 6296522446)
    .eq('sport', 'cricket');

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Ayush!'s owned players:");
  console.log(data);
}

checkAyush();
