require('dotenv').config();
const sb = require('../db/supabase');

async function check() {
  console.log("Fetching all group_stats...");
  const { data: groupUsers, error: gError } = await sb.supabase
    .from('group_stats')
    .select('user_id');
  
  if (gError) {
    console.error("Error fetching group_stats:", gError);
    return;
  }
  
  const uniqueGroupUserIds = Array.from(new Set(groupUsers.map(u => u.user_id)));
  console.log(`Found ${uniqueGroupUserIds.length} unique user IDs in group_stats.`);
  
  console.log("Fetching all profiles...");
  let allProfiles = [];
  let from = 0;
  let to = 999;
  while (true) {
    const { data, error } = await sb.supabase
      .from('profiles')
      .select('user_id')
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
  
  const profileUserIds = new Set(allProfiles.map(p => p.user_id));
  
  const missing = uniqueGroupUserIds.filter(id => !profileUserIds.has(id));
  console.log(`Found ${missing.length} users in group_stats who are missing from profiles.`);
  if (missing.length > 0) {
    console.log("Sample missing IDs:", missing.slice(0, 10));
  }
}

check().catch(console.error);
