require('dotenv').config();
const sb = require('../db/supabase');

async function find() {
  const { data, error } = await sb.supabase
    .from('cricketplayers')
    .select('id, name, ovr, role')
    .ilike('name', '%Varun%');
  
  if (error) {
    console.error("Error finding player:", error);
    return;
  }
  
  console.log("Matching players:", data);
}

find().catch(console.error);
