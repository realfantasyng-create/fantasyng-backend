// =====================================================
// models/BadgeApplication.js
// =====================================================
const mongoose = require('mongoose');

const BadgeApplicationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badgeTier: { type: String, enum: ['blue', 'red', 'golden'], required: true },
  plan: { type: String, enum: ['monthly', '3months', '6months', 'annual'], required: true },

  // Submitted evidence URLs (stored in cloud)
  submittedPhoto: { type: String, default: '' },   // Blue badge selfie
  submittedVideo: { type: String, default: '' },   // Red/Golden face video
  submittedId: { type: String, default: '' },      // Golden ID document

  // Google Vision API result
  googleVisionResult: { type: Object, default: {} },
  visionPassed: { type: Boolean, default: false },

  // Admin review
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },

}, { timestamps: true });

module.exports = mongoose.model('BadgeApplication', BadgeApplicationSchema);
