const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
  console.log("Deleting orphaned user_owned_players record 3039...");
  const { error } = await supabase
    .from('user_owned_players')
    .delete()
    .eq('id', 3039);
  if (error) {
    console.error("Error deleting record:", error);
  } else {
    console.log("Successfully deleted record 3039.");
  }
}

run();
