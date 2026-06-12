require('dotenv').config();
const sb = require('../db/supabase');

async function check() {
  console.log("Fetching unique groups...");
  const { data: groups, error } = await sb.supabase
    .from('group_stats')
    .select('chat_id');
  
  if (error) {
    console.error("Error fetching group_stats:", error);
    return;
  }
  
  const uniqueChatIds = Array.from(new Set(groups.map(g => g.chat_id)));
  console.log(`Found ${uniqueChatIds.length} unique group chats.`);
  
  for (let chatId of uniqueChatIds.slice(0, 10)) {
    const leaderboard = await sb.getGroupLeaderboard(chatId, 'rating');
    if (leaderboard.length > 0) {
      console.log(`\nLeaderboard for group ${chatId}:`);
      leaderboard.forEach((p, idx) => {
        console.log(`  ${idx + 1}. User ${p.user_id} (${p.first_name}) -> Rating: ${p.rating}, Wins: ${p.wins}, Coins: ${p.coins}`);
      });
    }
  }
}

check().catch(console.error);
