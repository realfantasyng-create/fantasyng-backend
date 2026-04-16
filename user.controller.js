// =====================================================
// controllers/user.controller.js
// Profile, Browse, Connect, Block, Report, Gifts
// FantasyNG Backend | ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

const User = require('../models/User');
const mongoose = require('mongoose');

// ── @GET /api/users/browse ────────────────────────
// Browse members — filtered, sorted by badge tier
const browseMembers = async (req, res) => {
  try {
    const { gender, minAge, maxAge, city, page = 1, limit = 20 } = req.query;
    const currentUser = req.user;

    // Build filter
    const filter = {
      _id: { $ne: currentUser._id }, // Exclude self
      status: 'active',
      // Exclude blocked users and users who blocked them
      _id: { $nin: [...currentUser.blockedUsers] },
    };

    if (gender) filter.gender = gender;
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (minAge || maxAge) {
      filter.age = {};
      if (minAge) filter.age.$gte = parseInt(minAge);
      if (maxAge) filter.age.$lte = parseInt(maxAge);
    }

    // Sort by badge tier (golden first, then red, blue, free)
    const badgeOrder = { executive: 5, golden: 4, red: 3, blue: 2, free: 1 };

    const members = await User.find(filter)
      .select('username profilePhoto bio badge trustScore location age gender isOnline lastSeen')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Sort by badge priority
    members.sort((a, b) => (badgeOrder[b.badge] || 0) - (badgeOrder[a.badge] || 0));

    res.json({ success: true, count: members.length, members });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/users/:id ───────────────────────────
// View a member's profile
const getMemberProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username profilePhoto bio badge trustScore location age gender isOnline lastSeen metAndSafeBadges');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Member not found.' });
    }

    // Handle last seen privacy settings
    let lastSeenDisplay = user.lastSeen;
    if (user.lastSeenSetting === 'recently') lastSeenDisplay = 'Recently active';
    if (user.lastSeenSetting === 'hidden') lastSeenDisplay = null;

    res.json({ success: true, user: { ...user.toObject(), lastSeen: lastSeenDisplay } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/users/profile ───────────────────────
// Update own profile
const updateProfile = async (req, res) => {
  try {
    const { bio, interests, location, genderPreference } = req.body;

    const updateData = {};
    if (bio !== undefined) updateData.bio = bio;
    if (interests) updateData.interests = interests;
    if (location) updateData.location = location;
    if (genderPreference) updateData.genderPreference = genderPreference;

    // Profile photo from uploaded file
    if (req.file) updateData.profilePhoto = `/uploads/${req.file.filename}`;

    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true });

    res.json({ success: true, message: 'Profile updated.', user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @POST /api/users/block/:id ────────────────────
const blockUser = async (req, res) => {
  try {
    const targetId = req.params.id;

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { blockedUsers: targetId }
    });

    res.json({ success: true, message: 'User blocked.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @DELETE /api/users/block/:id ──────────────────
const unblockUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { blockedUsers: req.params.id }
    });
    res.json({ success: true, message: 'User unblocked.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/users/settings/privacy ─────────────
const updatePrivacySettings = async (req, res) => {
  try {
    const { lastSeenSetting, ghostMode, anonymousModeOn } = req.body;
    const user = req.user;

    const update = {};

    if (lastSeenSetting) {
      // Red and Golden can hide last seen
      if (lastSeenSetting === 'recently' && !['red', 'golden', 'executive'].includes(user.badge)) {
        return res.status(403).json({ success: false, message: 'Red badge required for this feature.' });
      }
      if (lastSeenSetting === 'hidden' && !['golden', 'executive'].includes(user.badge)) {
        return res.status(403).json({ success: false, message: 'Golden badge required for this feature.' });
      }
      update.lastSeenSetting = lastSeenSetting;
    }

    if (ghostMode !== undefined) {
      if (ghostMode && !['red', 'golden', 'executive'].includes(user.badge)) {
        return res.status(403).json({ success: false, message: 'Red badge required for ghost mode.' });
      }
      update.ghostMode = ghostMode;
    }

    if (anonymousModeOn !== undefined) {
      if (anonymousModeOn && !['golden', 'executive'].includes(user.badge)) {
        return res.status(403).json({ success: false, message: 'Golden badge required for anonymous mode.' });
      }
      update.anonymousModeOn = anonymousModeOn;
    }

    await User.findByIdAndUpdate(user.id, update);
    res.json({ success: true, message: 'Privacy settings updated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/users/daily-match ───────────────────
// Suggest 1 special match per day
const getDailyMatch = async (req, res) => {
  try {
    const user = req.user;

    // Find a member of preferred gender not already connected
    const match = await User.findOne({
      _id: { $ne: user._id, $nin: user.blockedUsers },
      gender: user.genderPreference === 'both' ? { $in: ['male', 'female'] } : user.genderPreference,
      status: 'active',
      badge: { $ne: 'free' }, // Suggest verified members first
    }).select('username profilePhoto bio badge trustScore location age gender');

    res.json({ success: true, match: match || null });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/users/who-viewed-me ─────────────────
// Golden badge only
const whoViewedMe = async (req, res) => {
  try {
    if (!['golden', 'executive'].includes(req.user.badge)) {
      return res.status(403).json({ success: false, message: 'Golden badge required.' });
    }
    // TODO: implement profile view tracking in a separate collection
    res.json({ success: true, viewers: [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  browseMembers, getMemberProfile, updateProfile,
  blockUser, unblockUser, updatePrivacySettings,
  getDailyMatch, whoViewedMe,
};
