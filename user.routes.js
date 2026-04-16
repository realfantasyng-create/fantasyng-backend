// =====================================================
// routes/user.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const {
  browseMembers, getMemberProfile, updateProfile,
  blockUser, unblockUser, updatePrivacySettings,
  getDailyMatch, whoViewedMe,
} = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/browse', protect, browseMembers);
router.get('/daily-match', protect, getDailyMatch);
router.get('/who-viewed-me', protect, whoViewedMe);
router.get('/:id', protect, getMemberProfile);
router.put('/profile', protect, upload.single('photo'), updateProfile);
router.put('/settings/privacy', protect, updatePrivacySettings);
router.post('/block/:id', protect, blockUser);
router.delete('/block/:id', protect, unblockUser);

module.exports = router;
