require('dotenv').config();
const sb = require('../db/supabase');

async function test() {
  const { data, error } = await sb.supabase.rpc('exec_sql', { sql: 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rating INT DEFAULT 0;' });
  if (error) {
    console.log("RPC exec_sql failed (as expected):", error.message);
  } else {
    console.log("RPC exec_sql succeeded! Data:", data);
  }
}

test().catch(console.error);
