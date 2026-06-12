const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspect() {
  const { data, error } = await supabase
    .from('user_owned_players')
    .select('*')
    .limit(1);

  if (error) {
    console.error("Error:", error);
    return;
  }
  console.log("Columns of user_owned_players:", Object.keys(data[0]));
  console.log("Sample row:", data[0]);
}

inspect();
