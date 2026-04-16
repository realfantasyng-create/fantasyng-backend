// =====================================================
// controllers/payment.controller.js
// Paystack Integration — Badge Subscriptions + Gifts
// =====================================================
const paystackService = require('./paystack.service');
const { Subscription, VirtualGift } = require('./Others');
const User = require('./User');
const mongoose = require('mongoose');

// Badge prices in NAIRA
const BADGE_PRICES_NGN = {
  blue: { monthly: 1500, '3months': 3500, '6months': 6000, annual: 10000 },
  red: { monthly: 3500, '3months': 8500, '6months': 15000, annual: 25000 },
  golden: { monthly: 6000, '3months': 15000, '6months': 27000, annual: 45000 },
};

const PLAN_DAYS = { monthly: 30, '3months': 90, '6months': 180, annual: 365 };

const GIFT_PRICES = { rose: 200, diamond: 500, crown: 1000, flame: 1500 };

// ── @POST /api/payment/initiate ───────────────────
// Start a Paystack transaction
const initiatePayment = async (req, res) => {
  try {
    const { type, badgeTier, plan, giftType, receiverId } = req.body;
    const user = req.user;

    let amount, metadata, callbackUrl;

    if (type === 'badge') {
      if (!badgeTier ||!plan) {
        return res.status(400).json({ success: false, message: 'Badge tier and plan required.' });
      }
      amount = BADGE_PRICES_NGN[badgeTier]?.[plan];
      if (!amount) return res.status(400).json({ success: false, message: 'Invalid badge/plan selection.' });

      metadata = { type: 'badge', userId: user._id.toString(), badgeTier, plan };
      callbackUrl = `${process.env.FRONTEND_URL}/upgrade-success.html`;

    } else if (type === 'gift') {
      if (!giftType ||!receiverId) {
        return res.status(400).json({ success: false, message: 'Gift type and receiver required.' });
      }
      amount = GIFT_PRICES[giftType];
      if (!amount) return res.status(400).json({ success: false, message: 'Invalid gift type.' });

      metadata = { type: 'gift', senderId: user._id.toString(), receiverId, giftType };
      callbackUrl = `${process.env.FRONTEND_URL}/gifts-success.html`;

    } else {
      return res.status(400).json({ success: false, message: 'Invalid payment type.' });
    }

    // Initialize Paystack transaction
    const transaction = await paystackService.initializeTransaction({
      email: user.email,
      amount: amount * 100, // Convert to kobo
      metadata,
      callback_url: callbackUrl,
    });

    res.json({
      success: true,
      authorizationUrl: transaction.authorization_url,
      reference: transaction.reference,
    });

  } catch (error) {
    console.error('Payment initiation error:', error);
    res.status(500).json({ success: false, message: 'Payment failed to initialize.' });
  }
};

// ── @GET /api/payment/verify/:reference ───────────
const verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    const transaction = await paystackService.verifyTransaction(reference);

    if (transaction.status!== 'success') {
      return res.status(400).json({ success: false, message: 'Payment not successful.' });
    }

    const { type, userId, badgeTier, plan, senderId, receiverId, giftType } = transaction.metadata;

    if (type === 'badge') {
      // Activate badge
      const days = PLAN_DAYS[plan] || 30;
      const expiryDate = new Date(Date.now() + days * 86400000);

      await User.findByIdAndUpdate(userId, {
        badge: badgeTier,
        badgeExpiry: expiryDate,
      });

      // Record subscription
      await Subscription.create({
        userId,
        badgeTier,
        plan,
        amount: transaction.amount / 100,
        paystackReference: reference,
        status: 'active',
        endDate: expiryDate,
      });

      return res.json({ success: true, message: `${badgeTier} badge activated!`, expiryDate });
    }

    if (type === 'gift') {
      const amount = transaction.amount / 100;
      await VirtualGift.create({
        senderId,
        receiverId,
        giftType,
        amount,
        platformCommission: amount * 0.30, // 30% platform fee
        paystackReference: reference,
      });
      return res.json({ success: true, message: 'Gift sent!' });
    }

    res.json({ success: true, message: 'Payment verified.' });
  } catch (error) {
    console.error('Payment verify error:', error);
    res.status(500).json({ success: false, message: 'Payment verification failed.' });
  }
};

// ── @POST /api/payment/webhook ────────────────────
// Paystack sends automatic notifications here
const paystackWebhook = async (req, res) => {
  try {
    // Verify webhook signature
    const hash = require('crypto')
     .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
     .update(JSON.stringify(req.body))
     .digest('hex');

    if (hash!== req.headers['x-paystack-signature']) {
      return res.status(400).send('Invalid signature');
    }

    const { event, data } = req.body;

    if (event === 'charge.success') {
      // Same logic as verifyPayment — auto-activate on successful payment
      const { type, userId, badgeTier, plan } = data.metadata;

      if (type === 'badge') {
        const days = PLAN_DAYS[plan] || 30;
        await User.findByIdAndUpdate(userId, {
          badge: badgeTier,
          badgeExpiry: new Date(Date.now() + days * 86400000),
        });
      }
    }

    res.sendStatus(200);
  } catch (error) {
    console.error('Webhook error:', error);
    res.sendStatus(500);
  }
};

module.exports = { initiatePayment, verifyPayment, paystackWebhook };
