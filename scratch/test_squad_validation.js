const ai = require('../game/ai');

const runTests = () => {
  console.log("=== Testing selectValidPlayingXI ===");

  // 1. Less than 11 players
  const smallSquad = Array(10).fill({ role: 'batsman' });
  const res1 = ai.selectValidPlayingXI(smallSquad);
  console.log("Test 1 (Small Squad) success:", res1.success);
  console.log("Test 1 error:", res1.error);
  if (res1.success || !res1.error.includes("You own")) {
    console.error("FAIL: Test 1 failed!");
    process.exit(1);
  }

  // 2. 11+ players but missing roles in entire squad
  const missingRoleSquad = Array(12).fill({ role: 'batsman' });
  const res2 = ai.selectValidPlayingXI(missingRoleSquad);
  console.log("\nTest 2 (Missing roles in entire squad) success:", res2.success);
  console.log("Test 2 error:", res2.error);
  if (res2.success || !res2.error.includes("Insufficient Players")) {
    console.error("FAIL: Test 2 failed!");
    process.exit(1);
  }

  // 3. 11+ players but invalid Playing XI (too many bowlers)
  const invalidXISquad = [
    // Playing XI: 2 batsmen, 1 keeper, 1 all-rounder, 7 bowlers = 11 players
    { name: "B1", role: 'batsman', ovr: 80 }, { name: "B2", role: 'batsman', ovr: 78 },
    { name: "K1", role: 'wicket_keeper', ovr: 81 },
    { name: "A1", role: 'all_rounder', ovr: 82 },
    { name: "BW1", role: 'bowler', ovr: 75 }, { name: "BW2", role: 'bowler', ovr: 74 },
    { name: "BW3", role: 'bowler', ovr: 73 }, { name: "BW4", role: 'bowler', ovr: 72 },
    { name: "BW5", role: 'bowler', ovr: 71 }, { name: "BW6", role: 'bowler', ovr: 70 },
    { name: "BW7", role: 'bowler', ovr: 69 },
    // Bench: satisfies entire squad minimums
    { name: "B3", role: 'batsman', ovr: 70 },
    { name: "A2", role: 'all_rounder', ovr: 70 },
  ];
  const res3 = ai.selectValidPlayingXI(invalidXISquad);
  console.log("\nTest 3 (Invalid Playing XI - too many bowlers) success:", res3.success);
  console.log("Test 3 error:", res3.error);
  if (res3.success || !res3.error.includes("satisfy the role constraints") || res3.error.includes("<pos1>")) {
    console.error("FAIL: Test 3 failed!");
    process.exit(1);
  }

  // 4. Valid squad
  const validSquad = [
    { name: "B1", role: 'batsman', ovr: 80 }, { name: "B2", role: 'batsman', ovr: 78 }, { name: "B3", role: 'batsman', ovr: 77 },
    { name: "K1", role: 'wicket_keeper', ovr: 81 },
    { name: "A1", role: 'all_rounder', ovr: 82 }, { name: "A2", role: 'all_rounder', ovr: 70 },
    { name: "BW1", role: 'bowler', ovr: 75 }, { name: "BW2", role: 'bowler', ovr: 74 }, { name: "BW3", role: 'bowler', ovr: 73 },
    { name: "BW4", role: 'bowler', ovr: 72 }, { name: "BW5", role: 'bowler', ovr: 71 },
  ];
  const res4 = ai.selectValidPlayingXI(validSquad);
  console.log("\nTest 4 (Valid Squad) success:", res4.success);
  if (!res4.success) {
    console.error("FAIL: Test 4 failed!", res4.error);
    process.exit(1);
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY! ===");
};

runTests();
