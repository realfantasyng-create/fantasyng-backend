// =====================================================
// routes/badge.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const {
  applyForBadge, getMyApplications,
  getApplicationQueue, approveApplication, rejectApplication,
} = require('../badge.controller');
const { protect, adminOnly } = require('../auth.middleware');
const upload = require('../upload.middleware');

// Member routes
router.post('/apply', protect,
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'id',    maxCount: 1 },
  ]),
  applyForBadge
);
router.get('/my-applications', protect, getMyApplications);

// Admin routes
router.get('/queue', protect, adminOnly, getApplicationQueue);
router.put('/approve/:id', protect, adminOnly, approveApplication);
router.put('/reject/:id', protect, adminOnly, rejectApplication);

module.exports = router;
