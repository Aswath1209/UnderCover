require('dotenv').config();
const sb = require('../db/supabase');

async function check() {
  console.log("Fetching all profiles...");
  let allProfiles = [];
  let from = 0;
  let to = 999;
  
  while (true) {
    const { data, error } = await sb.supabase
      .from('profiles')
      .select('user_id, rating, first_name')
      .range(from, to);
    
    if (error) {
      console.error("Error fetching profiles:", error);
      return;
    }
    if (!data || data.length === 0) break;
    allProfiles = allProfiles.concat(data);
    if (data.length < 1000) break;
    from += 1000;
    to += 1000;
  }

  console.log(`Checking ${allProfiles.length} profiles for rating discrepancies concurrently...`);
  
  const CONCURRENCY = 50;
  let discrepancyCount = 0;
  
  for (let i = 0; i < allProfiles.length; i += CONCURRENCY) {
    const batch = allProfiles.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(async (p) => {
      try {
        const dynamic = await sb.getUserTeamRating(p.user_id);
        if (dynamic !== p.rating) {
          discrepancyCount++;
          console.log(`Discrepancy: User ${p.user_id} (${p.first_name}) -> Stored: ${p.rating}, Dynamic: ${dynamic}`);
        }
      } catch (err) {
        console.error(`Error for user ${p.user_id}:`, err);
      }
    }));
  }
  
  console.log(`Checked all profiles. Total discrepancies found: ${discrepancyCount}`);
}

check().catch(console.error);
