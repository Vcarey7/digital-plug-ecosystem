import express from 'express';
import { listOrdersFor } from '../services/orders.js';

export const ordersRouter = express.Router();

// GET /api/orders?email=... | ?wallet=...
ordersRouter.get('/', async (req, res) => {
  const email = req.query.email ? String(req.query.email) : undefined;
  const walletAddress = req.query.wallet ? String(req.query.wallet) : undefined;
  if (!email && !walletAddress) {
    return res.status(400).json({ error: 'pass ?email= or ?wallet=' });
  }
  try {
    const orders = await listOrdersFor({ email, walletAddress });
    res.json({ orders });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});
