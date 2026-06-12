require('dotenv').config();
const sb = require('../db/supabase');

async function check() {
  console.log("Fetching global rating leaderboard...");
  const leaderboard = await sb.getGlobalLeaderboard('rating');
  console.log("Leaderboard rating results:");
  leaderboard.forEach((p, idx) => {
    console.log(`${idx + 1}. User ${p.user_id} (${p.first_name}) -> Rating: ${p.rating}, Wins: ${p.wins}, Coins: ${p.coins}`);
  });

  const testUser1 = 1585569288; // kartikdob (rank 2)
  const rank1 = await sb.getUserGlobalRank(testUser1, 'rating');
  console.log(`\nRank of kartikdob (${testUser1}): expected 2, got ${rank1}`);

  const testUser2 = 8501010609; // UNKNOWN (rank 1)
  const rank2 = await sb.getUserGlobalRank(testUser2, 'rating');
  console.log(`Rank of UNKNOWN (${testUser2}): expected 1, got ${rank2}`);

  const testUser3 = 5278396877; // rating 0 user from the end of backfill
  const rank3 = await sb.getUserGlobalRank(testUser3, 'rating');
  console.log(`Rank of user with rating 0 (${testUser3}): got ${rank3}`);
}

check().catch(console.error);
