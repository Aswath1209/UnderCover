const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function checkActiveToday() {
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('user_id, first_name, coins, last_daily, last_spin');

  if (error) {
    console.error("Error:", error);
    return;
  }

  const activeToday = [];
  const startOfToday = new Date('2026-06-05T00:00:00Z');

  profiles.forEach(p => {
    const dailyDate = p.last_daily ? new Date(p.last_daily) : null;
    const spinDate = p.last_spin ? new Date(p.last_spin) : null;
    const isActive = (dailyDate && dailyDate >= startOfToday) || (spinDate && spinDate >= startOfToday);
    if (isActive) {
      activeToday.push(p);
    }
  });

  console.log(`Found ${activeToday.length} users active today.`);
  console.log("Active users today:");
  console.log(activeToday);
}

checkActiveToday();
