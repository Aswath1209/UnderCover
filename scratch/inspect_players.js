require('dotenv').config({ path: 'undercover-bot/.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function inspect() {
  const { data: players, error } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price')
    .order('ovr', { ascending: true })
    .limit(20);

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Sample players:", players);
  }
}

inspect();
