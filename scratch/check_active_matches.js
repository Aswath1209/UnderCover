const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env file manually
function loadEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
  return env;
}

const env = loadEnv(path.join(__dirname, '..', '.env'));
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY);

async function check() {
  console.log("Querying active cricket matches...");
  const { data, error } = await supabase
    .from('cricket_matches')
    .select('id, status, chat_id, host_id, guest_id, updated_at')
    .neq('status', 'completed');
    
  if (error) {
    console.error("Error querying matches:", error);
    return;
  }
  
  console.log(`Found ${data.length} active matches:`);
  console.log(JSON.stringify(data, null, 2));
}

check();
