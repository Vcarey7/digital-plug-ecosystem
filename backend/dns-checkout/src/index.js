import express from 'express';
import cors from 'cors';
import { env } from './lib/env.js';
import { domainsRouter } from './routes/domains.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';

const app = express();

app.use(cors({ origin: env.dashboardOrigin }));

// The Stripe webhook needs the raw, unparsed body to verify its signature --
// must be registered before the global json() body parser below.
app.post('/api/checkout/stripe-webhook', express.raw({ type: 'application/json' }));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.use('/api/domains', domainsRouter);
app.use('/api/checkout', checkoutRouter);
app.use('/api/orders', ordersRouter);

app.listen(env.port, () => {
  console.log(`dbws-dns-checkout listening on :${env.port}`);
});
