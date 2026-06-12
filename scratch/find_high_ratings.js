require('dotenv').config();
const sb = require('../db/supabase');

async function find() {
  const { data, error } = await sb.supabase
    .from('profiles')
    .select('user_id, first_name, rating, wins, coins')
    .gte('rating', 80)
    .order('rating', { ascending: false });
  
  if (error) {
    console.error("Error finding high ratings:", error);
    return;
  }
  
  console.log("High rating users:", data);
}

find().catch(console.error);
