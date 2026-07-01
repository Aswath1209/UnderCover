const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables for standalone script testing
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

const FILE_PATH = path.join(__dirname, '../data/user_cricket_campaigns.json');

// Ensure local directory exists for fallback
try {
  const dir = path.dirname(FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.error('[CampaignStore] Failed to create local data directory:', e);
}

// Track whether we should skip DB and use local fallback directly
let forceLocalFallback = false;

/**
 * Loads campaign state from Supabase, falling back to local file.
 */
async function getCampaign(userId) {
  if (supabase && !forceLocalFallback) {
    try {
      const { data, error } = await supabase
        .from('user_cricket_campaigns')
        .select('state')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        return data.state;
      }
      if (error && error.message.includes('relation "user_cricket_campaigns" does not exist')) {
        console.warn('[CampaignStore] Supabase table "user_cricket_campaigns" not found. Falling back to local JSON file.');
        forceLocalFallback = true;
      }
    } catch (e) {
      console.error('[CampaignStore] Supabase fetch error, using local fallback:', e);
    }
  }

  // Local file fallback
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf8');
      const all = JSON.parse(content || '{}');
      return all[String(userId)] || null;
    }
  } catch (e) {
    console.error('[CampaignStore] Failed to read local campaign backup:', e);
  }
  return null;
}

/**
 * Saves campaign state to Supabase, falling back to local file.
 */
async function saveCampaign(userId, campaign) {
  if (supabase && !forceLocalFallback) {
    try {
      const { error } = await supabase
        .from('user_cricket_campaigns')
        .upsert({
          user_id: userId,
          state: campaign,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });

      if (!error) {
        return true;
      }
      if (error && error.message.includes('relation "user_cricket_campaigns" does not exist')) {
        console.warn('[CampaignStore] Supabase table not found on save. Falling back.');
        forceLocalFallback = true;
      }
    } catch (e) {
      console.error('[CampaignStore] Supabase save error, using local fallback:', e);
    }
  }

  // Local file fallback
  try {
    let all = {};
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf8');
      all = JSON.parse(content || '{}');
    }
    all[String(userId)] = campaign;
    fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[CampaignStore] Failed to write local campaign backup:', e);
    return false;
  }
}

/**
 * Deletes campaign state.
 */
async function deleteCampaign(userId) {
  if (supabase && !forceLocalFallback) {
    try {
      const { error } = await supabase
        .from('user_cricket_campaigns')
        .delete()
        .eq('user_id', userId);

      if (!error) {
        return true;
      }
    } catch (e) {
      console.error('[CampaignStore] Supabase delete error:', e);
    }
  }

  // Local file fallback
  try {
    if (fs.existsSync(FILE_PATH)) {
      const content = fs.readFileSync(FILE_PATH, 'utf8');
      const all = JSON.parse(content || '{}');
      if (all[String(userId)]) {
        delete all[String(userId)];
        fs.writeFileSync(FILE_PATH, JSON.stringify(all, null, 2), 'utf8');
      }
    }
    return true;
  } catch (e) {
    console.error('[CampaignStore] Failed to delete local campaign backup:', e);
    return false;
  }
}

module.exports = {
  getCampaign,
  saveCampaign,
  deleteCampaign
};
