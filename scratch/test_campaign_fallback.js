const campaignStore = require('../db/campaignStore');

async function test() {
  console.log("Testing Campaign Store Fallback...");
  
  const userId = "test_user_999";
  const dummyCampaign = {
    userId,
    username: "TestPlayer",
    type: "IPL",
    edition: "2026",
    playerTeam: "RCB",
    status: "ACTIVE",
    currentRound: 1,
    schedule: [],
    standings: {},
    playerSquad: []
  };

  console.log("Saving campaign...");
  const saveSuccess = await campaignStore.saveCampaign(userId, dummyCampaign);
  console.log("Save outcome:", saveSuccess);

  console.log("Loading campaign...");
  const loadedCampaign = await campaignStore.getCampaign(userId);
  console.log("Loaded campaign:", loadedCampaign);

  if (loadedCampaign && loadedCampaign.username === "TestPlayer") {
    console.log("SUCCESS: Fallback system works flawlessly!");
  } else {
    console.error("FAIL: Fallback system failed!");
  }

  // Clean up
  await campaignStore.deleteCampaign(userId);
  console.log("Cleaned up test campaign.");
}

test();
