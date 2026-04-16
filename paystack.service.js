// =====================================================
// services/paystack.service.js
// Paystack API — Initialize & Verify Transactions
// =====================================================
const axios = require('axios');

const PAYSTACK_BASE = 'https://api.paystack.co';

// ── Initialize a transaction ──────────────────────
const initializeTransaction = async ({ email, amount, metadata, callback_url }) => {
  const response = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    { email, amount, metadata, callback_url },
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );
  if (!response.data.status) throw new Error('Paystack initialization failed');
  return response.data.data; // { authorization_url, reference }
};

// ── Verify a transaction ──────────────────────────
const verifyTransaction = async (reference) => {
  const response = await axios.get(
    `${PAYSTACK_BASE}/transaction/verify/${reference}`,
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
  );
  if (!response.data.status) throw new Error('Paystack verification failed');
  return response.data.data; // { status, amount, metadata, ... }
};

module.exports = { initializeTransaction, verifyTransaction };
