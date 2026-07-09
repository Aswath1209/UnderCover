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

async function fix() {
  console.log("Fetching active matches with status 'toss'...");
  const { data, error } = await supabase
    .from('cricket_matches')
    .select('*')
    .eq('status', 'toss');
    
  if (error) {
    console.error("Error querying matches:", error);
    return;
  }
  
  console.log(`Found ${data.length} matches to fix.`);
  
  for (const match of data) {
    console.log(`Fixing match ${match.id}...`);
    const state = match.state_json;
    if (state) {
      state.status = 'xi_selection';
    }
    
    const { error: updateError } = await supabase
      .from('cricket_matches')
      .update({
        status: 'xi_selection',
        state_json: state,
        updated_at: new Date().toISOString()
      })
      .eq('id', match.id);
      
    if (updateError) {
      console.error(`Error updating match ${match.id}:`, updateError);
    } else {
      console.log(`Successfully updated match ${match.id} to 'xi_selection'.`);
    }
  }
}

fix();
