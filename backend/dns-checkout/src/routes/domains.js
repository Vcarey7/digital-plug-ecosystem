import express from 'express';
import { supabase } from '../lib/supabase.js';
import { checkAvailability, NamecheapNotConfiguredError } from '../services/namecheap.js';

export const domainsRouter = express.Router();

// GET /api/domains/search?domain=example.com
// DNS-side availability + retail price only. The frontend checks on-chain
// (PlugRegistry.isAvailable) availability itself, directly against the
// contract -- that half never needs to go through this backend.
domainsRouter.get('/search', async (req, res) => {
  const domain = String(req.query.domain || '').trim().toLowerCase();
  if (!domain || !domain.includes('.')) {
    return res.status(400).json({ error: 'domain must be a full name, e.g. example.com' });
  }
  const tld = domain.slice(domain.indexOf('.') + 1);

  try {
    const [availability, { data: pricing, error }] = await Promise.all([
      checkAvailability(domain),
      supabase.from('dns_tlds').select('*').eq('tld', tld).maybeSingle(),
    ]);
    if (error) throw error;

    res.json({
      domain,
      available: availability.available,
      premium: availability.premium,
      tld,
      priced: Boolean(pricing),
      active: pricing?.active ?? false,
      retailPriceCents: pricing?.retail_price ?? null,
    });
  } catch (e) {
    if (e instanceof NamecheapNotConfiguredError) {
      return res.status(503).json({ error: e.message });
    }
    res.status(502).json({ error: e.message });
  }
});
