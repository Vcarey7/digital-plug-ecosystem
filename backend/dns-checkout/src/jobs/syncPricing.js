// Pulls Namecheap's current wholesale TLD pricing and upserts dns_tlds with
// a markup applied. Run on a schedule (n8n or cron) --
//   node src/jobs/syncPricing.js
//
// Money stays integer throughout: wholesale/retail are stored in USD cents.
// The markup rate is a float only transiently, during the single
// multiply-then-round step -- never persisted or compared as a float.
import { env } from '../lib/env.js';
import { supabase } from '../lib/supabase.js';
import { getTldPricing } from '../services/namecheap.js';

function toCents(usd) {
  return Math.round(usd * 100);
}

function applyMarkup(wholesaleCents, rate) {
  return Math.round(wholesaleCents * (1 + rate));
}

export async function syncPricing() {
  const pricing = await getTldPricing();
  const rows = pricing.map((p) => {
    const wholesale_cost = toCents(p.registerPriceUsd);
    return {
      tld: p.tld,
      wholesale_cost,
      retail_price: applyMarkup(wholesale_cost, env.dnsMarkupRate),
      active: true,
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase.from('dns_tlds').upsert(rows, { onConflict: 'tld' });
  if (error) throw error;
  return { synced: rows.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncPricing()
    .then((r) => {
      console.log(`Synced ${r.synced} TLDs into dns_tlds (markup: ${env.dnsMarkupRate * 100}%)`);
    })
    .catch((e) => {
      console.error('Pricing sync failed:', e);
      process.exitCode = 1;
    });
}
