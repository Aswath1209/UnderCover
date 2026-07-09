const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('cricketplayers').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log("cricketplayers columns:", Object.keys(data[0] || {}));
    console.log("sample row:", data[0]);
  }
}

check();
