require('dotenv').config();
const sb = require('../db/supabase');

async function check() {
  console.log("1. Fetching all profiles with rating >= 80...");
  const { data: highProfiles, error } = await sb.supabase
    .from('profiles')
    .select('user_id, first_name, rating, wins, coins')
    .gte('rating', 80)
    .order('rating', { ascending: false });
  
  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(`Found ${highProfiles.length} users with rating >= 80 in the entire database:`);
  highProfiles.forEach((p, i) => {
    console.log(`  ${i+1}. User ${p.user_id} (${p.first_name}) -> Rating: ${p.rating}`);
  });

  console.log("\n2. Fetching the Global Leaderboard (Top 10):");
  const globalLb = await sb.getGlobalLeaderboard('rating');
  globalLb.forEach((p, i) => {
    console.log(`  ${i+1}. User ${p.user_id} (${p.first_name}) -> Rating: ${p.rating}`);
  });

  // Verify that all highProfiles are in the global leaderboard
  const globalIds = new Set(globalLb.map(p => p.user_id));
  const missing = highProfiles.filter(p => !globalIds.has(p.user_id));
  console.log(`\nAre there any >= 80 rating users missing from the global leaderboard? ${missing.length > 0 ? 'Yes' : 'No'}`);
  if (missing.length > 0) {
    console.log("Missing users:", missing);
  }

  console.log("\n3. Finding if any user in group_stats has rating >= 80 but is missing from global leaderboard...");
  const { data: groupStats } = await sb.supabase.from('group_stats').select('chat_id, user_id');
  const uniqueGroupUsers = Array.from(new Set(groupStats.map(gs => gs.user_id)));
  
  const { data: groupProfiles } = await sb.supabase
    .from('profiles')
    .select('user_id, first_name, rating')
    .in('user_id', uniqueGroupUsers);
    
  const highGroupUsers = groupProfiles.filter(gp => gp.rating >= 80);
  console.log(`Found ${highGroupUsers.length} users in group chats with rating >= 80:`);
  highGroupUsers.forEach(u => {
    const isGlobal = globalIds.has(u.user_id);
    console.log(`  User ${u.user_id} (${u.first_name}) -> Rating: ${u.rating} (In Global: ${isGlobal})`);
  });
}

check().catch(console.error);
