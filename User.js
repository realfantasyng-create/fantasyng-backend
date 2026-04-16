// =====================================================
// models/User.js — User Database Schema
// FantasyNG Backend
// ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({

  // ── BASIC INFO ──────────────────────────────────
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    required: true,
    select: false, // Never return password in queries
  },

  // ── PERSONAL INFO ────────────────────────────────
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true,
  },
  dateOfBirth: {
    type: Date,
    required: true,
  },
  age: {
    type: Number,
    min: 18, // 18+ only — enforced in auth controller too
  },

  // ── LOCATION ─────────────────────────────────────
  location: {
    state: { type: String, default: '' },
    city: { type: String, default: '' },
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
  },

  // ── PROFILE ──────────────────────────────────────
  profilePhoto: { type: String, default: '' }, // URL to photo
  bio: { type: String, maxlength: 500, default: '' },
  interests: [{ type: String }],
  genderPreference: {
    type: String,
    enum: ['male', 'female', 'both'],
    default: 'both',
  },

  // ── BADGE SYSTEM ─────────────────────────────────
  // Badge tiers: free, blue, red, golden, executive
  badge: {
    type: String,
    enum: ['free', 'blue', 'red', 'golden', 'executive'],
    default: 'free',
  },
  badgeExpiry: { type: Date, default: null },
  // If admin elevated, store what badge they had before
  originalBadge: { type: String, default: 'free' },
  isAdminElevated: { type: Boolean, default: false },

  // ── TRUST SCORE ──────────────────────────────────
  trustScore: { type: Number, default: 0, min: 0, max: 100 },
  metAndSafeBadges: { type: Number, default: 0 }, // Count of "Met & Safe" reviews

  // ── ADMIN ROLE ───────────────────────────────────
  // Roles: member, moderator, chief_moderator, coo, ceo
  role: {
    type: String,
    enum: ['member', 'moderator', 'chief_moderator', 'coo', 'ceo'],
    default: 'member',
  },

  // ── VERIFICATION ─────────────────────────────────
  isVerified: { type: Boolean, default: false },
  verificationLevel: {
    type: String,
    enum: ['none', 'blue', 'red', 'golden'],
    default: 'none',
  },

  // ── STRIKES ──────────────────────────────────────
  strikes: { type: Number, default: 0 },

  // ── ACCOUNT STATUS ────────────────────────────────
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active',
  },
  suspendedUntil: { type: Date, default: null },
  banReason: { type: String, default: '' },

  // ── PRIVACY SETTINGS ─────────────────────────────
  anonymousModeOn: { type: Boolean, default: false }, // Golden only
  ghostMode: { type: Boolean, default: false },       // Red + Golden
  ghostList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Who they're hiding from
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  lastSeenSetting: {
    type: String,
    enum: ['exact', 'recently', 'hidden'],
    default: 'exact',
  },

  // ── ACTIVITY ─────────────────────────────────────
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },

  // ── PASSWORD RESET ────────────────────────────────
  resetPasswordOTP: { type: String, default: null },
  resetPasswordExpiry: { type: Date, default: null },

  // ── DAILY LIMITS TRACKER ─────────────────────────
  // Resets every midnight
  dailyMessageCount: { type: Number, default: 0 },
  dailyLikeCount: { type: Number, default: 0 },
  lastDailyReset: { type: Date, default: Date.now },

}, { timestamps: true }); // Adds createdAt and updatedAt automatically

// ── HOOK: Hash password before saving ─────────────
UserSchema.pre('save', async function (next) {
  // Only hash if password was changed
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

// ── HOOK: Calculate age from date of birth ─────────
UserSchema.pre('save', function (next) {
  if (this.dateOfBirth) {
    const today = new Date();
    const dob = new Date(this.dateOfBirth);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    this.age = age;
  }
  next();
});

// ── METHOD: Compare password ──────────────────────
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// ── METHOD: Check if badge is expired ────────────
UserSchema.methods.isBadgeExpired = function () {
  if (!this.badgeExpiry) return false;
  return new Date() > new Date(this.badgeExpiry);
};

// ── METHOD: Get daily message limit by badge ─────
UserSchema.methods.getMessageLimit = function () {
  const limits = { free: 20, blue: 60, red: Infinity, golden: Infinity, executive: Infinity };
  return limits[this.badge] || 20;
};

// ── METHOD: Get daily like limit by badge ────────
UserSchema.methods.getLikeLimit = function () {
  const limits = { free: 5, blue: 20, red: 50, golden: Infinity, executive: Infinity };
  return limits[this.badge] || 5;
};

module.exports = mongoose.model('User', UserSchema);
