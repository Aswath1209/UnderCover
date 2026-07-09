const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking if user_cricket_campaigns table exists...");
  const { data, error } = await supabase
    .from('user_cricket_campaigns')
    .select('*')
    .limit(1);
    
  if (error) {
    console.log("Table does not exist or error occurred:", error.message);
  } else {
    console.log("Table 'user_cricket_campaigns' exists! Current rows count:", data.length);
  }
}

run();
