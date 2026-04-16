// =====================================================
// routes/auth.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const { signup, login, logout, forgotPassword, resetPassword, getMe } = require('../controllers/auth.controller');
const { protect } = require('../auth.middleware');

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);

module.exports = router;
