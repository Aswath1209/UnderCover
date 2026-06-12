const legacyPrices = require('../db/legacyPrices.json');
const MIGRATION_CUTOFF = new Date('2026-06-05T09:00:00Z');

function resolvePlayerPrice(player, acquiredAt) {
  if (player.sport === 'cricket' && acquiredAt) {
    const acqDate = new Date(acquiredAt);
    if (acqDate < MIGRATION_CUTOFF) {
      const legacyPrice = legacyPrices[player.id];
      if (legacyPrice !== undefined) {
        return legacyPrice;
      }
    }
  }
  return player.buy_price;
}

// Let's test with Shaun Pollock (whose price was corrected from 2545500 to 2605500)
// ID of Shaun Pollock: 090079b3-aa92-4d2e-be25-a756d90a7dd3
const pollock = {
  id: '090079b3-aa92-4d2e-be25-a756d90a7dd3',
  name: 'Shaun Pollock',
  buy_price: 2605500,
  sport: 'cricket'
};

// Let's test with Chris Cooke (whose price was corrected from 650 to 56420)
// ID of Chris Cooke: 014c1b05-402b-48ae-a975-15b43747d943
const cooke = {
  id: '014c1b05-402b-48ae-a975-15b43747d943',
  name: 'Chris Cooke',
  buy_price: 56420,
  sport: 'cricket'
};

function runTest() {
  console.log("--- Testing Shaun Pollock ---");
  const oldAcquired = '2026-05-10T12:00:00Z';
  const newAcquired = '2026-06-06T12:00:00Z';

  const priceOldPollock = resolvePlayerPrice(pollock, oldAcquired);
  const priceNewPollock = resolvePlayerPrice(pollock, newAcquired);

  console.log(`Pristine price in JSON map: ${legacyPrices[pollock.id]}`);
  console.log(`Current DB buy price: ${pollock.buy_price}`);
  console.log(`Resolved price for older purchase (${oldAcquired}): ${priceOldPollock} (expected: 2545500)`);
  console.log(`Resolved price for newer purchase (${newAcquired}): ${priceNewPollock} (expected: 2605500)`);

  if (priceOldPollock === 2545500 && priceNewPollock === 2605500) {
    console.log("✅ Shaun Pollock price resolution logic is correct!");
  } else {
    console.error("❌ Shaun Pollock price resolution logic failed!");
  }

  console.log("\n--- Testing Chris Cooke ---");
  const priceOldCooke = resolvePlayerPrice(cooke, oldAcquired);
  const priceNewCooke = resolvePlayerPrice(cooke, newAcquired);

  console.log(`Pristine price in JSON map: ${legacyPrices[cooke.id]}`);
  console.log(`Current DB buy price: ${cooke.buy_price}`);
  console.log(`Resolved price for older purchase (${oldAcquired}): ${priceOldCooke} (expected: 650)`);
  console.log(`Resolved price for newer purchase (${newAcquired}): ${priceNewCooke} (expected: 56420)`);

  if (priceOldCooke === 650 && priceNewCooke === 56420) {
    console.log("✅ Chris Cooke price resolution logic is correct!");
  } else {
    console.error("❌ Chris Cooke price resolution logic failed!");
  }
}

runTest();
