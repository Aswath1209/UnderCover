const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const legacyPrices = require('../db/legacyPrices.json');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const MIGRATION_CUTOFF = new Date('2026-06-05T09:00:00Z');

async function testToRefund() {
  const { data: players } = await supabase
    .from('cricketplayers')
    .select('id, name, ovr, buy_price');

  const underpricedHighOvr = {};
  players.forEach(p => {
    const oldPrice = legacyPrices[p.id];
    if (oldPrice !== undefined && oldPrice < p.buy_price && p.ovr >= 79) {
      underpricedHighOvr[p.id] = {
        name: p.name,
        ovr: p.ovr,
        oldPrice,
        newPrice: p.buy_price
      };
    }
  });

  const { data: owned } = await supabase
    .from('user_owned_players')
    .select('*')
    .eq('sport', 'cricket');

  const toRefund = [];
  owned.forEach(o => {
    if (underpricedHighOvr[o.player_id]) {
      const acqDate = new Date(o.acquired_at);
      if (acqDate < MIGRATION_CUTOFF) {
        toRefund.push({
          recordId: o.id,
          userId: o.user_id,
          playerId: o.player_id,
          playerName: underpricedHighOvr[o.player_id].name,
          ovr: underpricedHighOvr[o.player_id].ovr,
          refundAmount: underpricedHighOvr[o.player_id].oldPrice
        });
      }
    }
  });

  console.log("Total toRefund length:", toRefund.length);
  const ayushRecords = toRefund.filter(tr => tr.userId === 6296522446);
  console.log("Ayush!'s records in toRefund:", ayushRecords);
}

testToRefund();
