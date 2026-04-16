// =====================================================
// routes/payment.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const { initiatePayment, verifyPayment, paystackWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth.middleware');

router.post('/initiate', protect, initiatePayment);
router.get('/verify/:reference', protect, verifyPayment);
router.post('/webhook', paystackWebhook); // No auth — Paystack calls this directly

module.exports = router;
