const { calculateBallOutcome } = require('../game/engine');

function runTest() {
  console.log("=== STARTING CRICKET ENGINE RE-ENGINEERING VERIFICATION TESTS ===\n");

  // 1. Rating Difference Multiplier Test
  console.log("1. TESTING RATING DIFFERENCE MULTIPLIER:");
  const highRatedBatsman = { batting_rating: 95, batting_archetype: 'Anchor', batting_hand: 'right', name: 'Legend Batsman' };
  const lowRatedBatsman = { batting_rating: 40, batting_archetype: 'Anchor', batting_hand: 'right', name: 'Rookie Batsman' };
  const avgBowler = { bowling_rating: 60, bowling_archetype: 'Economy', bowler_type: 'fast', name: 'Avg Bowler' };

  let highRunsTotal = 0;
  let lowRunsTotal = 0;
  let highWicketsTotal = 0;
  let lowWicketsTotal = 0;

  const N = 1000;
  for (let i = 0; i < N; i++) {
    const resHigh = calculateBallOutcome(highRatedBatsman, avgBowler, 'off_cutter', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 0 } });
    const resLow = calculateBallOutcome(lowRatedBatsman, avgBowler, 'off_cutter', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 0 } });
    
    highRunsTotal += resHigh.runs;
    lowRunsTotal += resLow.runs;
    if (resHigh.isWicket) highWicketsTotal++;
    if (resLow.isWicket) lowWicketsTotal++;
  }

  console.log(`- High Rated Batsman (95 rating) vs Bowler (60 rating):`);
  console.log(`  Runs scored in ${N} balls: ${highRunsTotal} (Avg: ${(highRunsTotal/N).toFixed(2)})`);
  console.log(`  Wickets lost: ${highWicketsTotal} (Wicket rate: ${(highWicketsTotal/N * 100).toFixed(2)}%)`);
  
  console.log(`- Low Rated Batsman (40 rating) vs Bowler (60 rating):`);
  console.log(`  Runs scored in ${N} balls: ${lowRunsTotal} (Avg: ${(lowRunsTotal/N).toFixed(2)})`);
  console.log(`  Wickets lost: ${lowWicketsTotal} (Wicket rate: ${(lowWicketsTotal/N * 100).toFixed(2)}%)`);
  
  if (highRunsTotal > lowRunsTotal && highWicketsTotal < lowWicketsTotal) {
    console.log("✅ Rating impact verified: High-rated player scored more and lost fewer wickets!");
  } else {
    console.log("❌ Rating impact failed verification.");
  }
  console.log("");

  // 2. Bowler Spamming Test
  console.log("2. TESTING BOWLER SPAM ADVANTAGE FOR BATSMAN:");
  const batsman = { batting_rating: 60, batting_archetype: 'Anchor', batting_hand: 'right', name: 'Standard Batsman' };
  const bowler = { bowling_rating: 60, bowling_archetype: 'Economy', bowler_type: 'fast', name: 'Spam Bowler' };

  let controlRuns = 0;
  let controlWickets = 0;
  let spammedRuns = 0;
  let spammedWickets = 0;

  for (let i = 0; i < N; i++) {
    // Control: Bowler changes deliveries
    const resControl = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 },
      deliveryHistory: ['inswinger', 'outswinger'],
      speedHistory: ['fast', 'slow']
    });
    // Spammed: Bowler bowls the same delivery and speed repeatedly
    const resSpammed = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 },
      deliveryHistory: ['off_cutter', 'off_cutter'], // Bowled 3 times consecutively
      speedHistory: ['normal', 'normal']             // Speed spam 3 times consecutively
    });

    controlRuns += resControl.runs;
    spammedRuns += resSpammed.runs;
    if (resControl.isWicket) controlWickets++;
    if (resSpammed.isWicket) spammedWickets++;
  }

  console.log(`- Control (No Spam): Runs: ${controlRuns} (Avg: ${(controlRuns/N).toFixed(2)}), Wickets: ${controlWickets}`);
  console.log(`- Bowler Spamming:   Runs: ${spammedRuns} (Avg: ${(spammedRuns/N).toFixed(2)}), Wickets: ${spammedWickets}`);
  
  if (spammedRuns > controlRuns && spammedWickets < controlWickets) {
    console.log("✅ Bowler spam verified: Batsman scored more runs and faced lower wicket chance when bowler spammed!");
  } else {
    console.log("❌ Bowler spam failed verification.");
  }
  console.log("");

  // 3. Free Hit Test
  console.log("3. TESTING FREE HIT LOGIC:");
  let freeHitWickets = 0;
  let freeHitFours = 0;
  let freeHitSixes = 0;
  let freeHitCommentarySample = "";

  for (let i = 0; i < N; i++) {
    const resFH = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], {
      isFreeHit: true,
      batsmanStats: { balls: 0 }
    });
    if (resFH.isWicket) freeHitWickets++;
    if (resFH.runs === 4) freeHitFours++;
    if (resFH.runs === 6) freeHitSixes++;
    if (i === 0) freeHitCommentarySample = resFH.commentary;
  }

  console.log(`- Out of ${N} Free Hits:`);
  console.log(`  Wickets: ${freeHitWickets} (Expected: 0)`);
  console.log(`  Boundaries (4s & 6s): ${freeHitFours + freeHitSixes} (Avg: ${(freeHitFours+freeHitSixes)/N * 100}%)`);
  console.log(`  Commentary Sample: "${freeHitCommentarySample}"`);

  if (freeHitWickets === 0 && freeHitCommentarySample.includes('[FREE HIT]')) {
    console.log("✅ Free Hit logic verified: 0 wickets down and commentary properly tagged!");
  } else {
    console.log("❌ Free Hit logic failed verification.");
  }
  console.log("");

  // 4. Platoon (Left/Right Matchups) Test
  console.log("4. TESTING PLATOON MATCHUPS:");
  const offSpinner = { bowling_rating: 60, bowling_archetype: 'Economy', bowler_type: 'off_spin', name: 'Off Spinner' };
  const leftHander = { batting_rating: 60, batting_hand: 'left', batting_archetype: 'Anchor', name: 'Lefty Batsman' };
  const rightHander = { batting_rating: 60, batting_hand: 'right', batting_archetype: 'Anchor', name: 'Righty Batsman' };

  let offSpinVsLeftRuns = 0;
  let offSpinVsRightRuns = 0;

  for (let i = 0; i < N; i++) {
    const resL = calculateBallOutcome(leftHander, offSpinner, 'off_spin', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 0 } });
    const resR = calculateBallOutcome(rightHander, offSpinner, 'off_spin', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 0 } });
    offSpinVsLeftRuns += resL.runs;
    offSpinVsRightRuns += resR.runs;
  }

  console.log(`- Off Spinner vs Left Hand batsman: Runs: ${offSpinVsLeftRuns}`);
  console.log(`- Off Spinner vs Right Hand batsman: Runs: ${offSpinVsRightRuns}`);

  if (offSpinVsRightRuns > offSpinVsLeftRuns) {
    console.log("✅ Platoon matchups verified: Right-hander scored more than Left-hander against Off-spin!");
  } else {
    console.log("❌ Platoon matchups failed verification.");
  }
  console.log("");

  // 5. Batsman Set-ness (Confidence Boost) Test
  console.log("5. TESTING BATSMAN SET-NESS:");
  let freshWickets = 0;
  let setWickets = 0;
  let freshRuns = 0;
  let setRuns = 0;

  for (let i = 0; i < N; i++) {
    const resFresh = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 0 } });
    const resSet = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], { batsmanStats: { balls: 15 } }); // Set batsman (15 balls faced)
    freshRuns += resFresh.runs;
    setRuns += resSet.runs;
    if (resFresh.isWicket) freshWickets++;
    if (resSet.isWicket) setWickets++;
  }

  console.log(`- Fresh Batsman (0 balls faced): Runs: ${freshRuns}, Wickets: ${freshWickets}`);
  console.log(`- Set Batsman (15 balls faced):  Runs: ${setRuns}, Wickets: ${setWickets}`);

  if (setRuns > freshRuns && setWickets < freshWickets) {
    console.log("✅ Batsman set-ness verified: Set batsman scored more and lost fewer wickets!");
  } else {
    console.log("❌ Batsman set-ness failed verification.");
  }
  console.log("");

  // 6. Bowler Rhythm / Fatigue Test
  console.log("6. TESTING BOWLER RHYTHM/FATIGUE:");
  let tightRuns = 0;
  let expensiveRuns = 0;

  for (let i = 0; i < N; i++) {
    // Tight Bowler: Economy < 6 (e.g. bowled 6 balls, conceded 3 runs -> econ 3.0)
    const resTight = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 },
      bowlerStats: { overs: 1.0, runsConceded: 3 }
    });
    // Expensive Bowler: Economy > 12 (e.g. bowled 6 balls, conceded 15 runs -> econ 15.0)
    const resExpensive = calculateBallOutcome(batsman, bowler, 'off_cutter', 'drive', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 },
      bowlerStats: { overs: 1.0, runsConceded: 15 }
    });
    tightRuns += resTight.runs;
    expensiveRuns += resExpensive.runs;
  }

  console.log(`- Against Tight Bowler (3 econ): Runs scored: ${tightRuns}`);
  console.log(`- Against Expensive Bowler (15 econ): Runs scored: ${expensiveRuns}`);

  if (expensiveRuns > tightRuns) {
    console.log("✅ Bowler rhythm/fatigue verified: Batsman scored more runs against an expensive/fatigued bowler!");
  } else {
    console.log("❌ Bowler rhythm/fatigue failed verification.");
  }
  console.log("");

  // 7. Match Pressure (Chasing Context) Test
  console.log("7. TESTING MATCH PRESSURE CHASE:");
  let normalWickets = 0;
  let normalRuns = 0;
  let pressureWickets = 0;
  let pressureRuns = 0;
  const pressureN = 30000;

  for (let i = 0; i < pressureN; i++) {
    const resNormal = calculateBallOutcome(batsman, bowler, 'off_cutter', 'loft', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 }
    });
    // Chasing: needs 30 runs off 12 balls (Required Rate 15.0 runs/over)
    const resPressure = calculateBallOutcome(batsman, bowler, 'off_cutter', 'loft', 'balanced', 'normal', [], {
      batsmanStats: { balls: 0 },
      isSecondInnings: true,
      target: 100,
      runsScored: 70,
      ballsRemaining: 12
    });
    normalRuns += resNormal.runs;
    pressureRuns += resPressure.runs;
    if (resNormal.isWicket) normalWickets++;
    if (resPressure.isWicket) pressureWickets++;
  }

  console.log(`- Normal Chase (No pressure): Runs: ${normalRuns} (Avg: ${(normalRuns/pressureN).toFixed(2)}), Wickets: ${normalWickets} (${(normalWickets/pressureN*100).toFixed(2)}%)`);
  console.log(`- High Pressure Chase:        Runs: ${pressureRuns} (Avg: ${(pressureRuns/pressureN).toFixed(2)}), Wickets: ${pressureWickets} (${(pressureWickets/pressureN*100).toFixed(2)}%)`);

  if (pressureRuns > normalRuns && pressureWickets > normalWickets) {
    console.log("✅ Match pressure verified: Batsman hit more boundaries/runs but faced higher wicket risk!");
  } else {
    console.log("❌ Match pressure failed verification.");
  }
  console.log("");

  console.log("=== ALL TEST RUNS COMPLETED ===");
}

runTest();
