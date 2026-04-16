// =====================================================
// models/Post.js — Public Post Schema
// FantasyNG Backend
// =====================================================
const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, default: '' },
  mediaUrls: [{ type: String }],
  mediaType: { type: String, enum: ['text', 'photo', 'short_video', 'long_video'], default: 'text' },

  // Badge level when post was created (affects feed priority)
  badgeTierAtPost: { type: String, enum: ['free', 'blue', 'red', 'golden', 'executive'], default: 'free' },

  // Post expiry — golden posts never expire
  expiresAt: { type: Date, default: null },

  // Front page promotion
  isPromotedToFrontPage: { type: Boolean, default: false },
  promotedAt: { type: Date, default: null },
  promotedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Sponsored post (business paid for placement)
  isSponsored: { type: Boolean, default: false },
  sponsorName: { type: String, default: '' },

  // Engagement
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  commentsCount: { type: Number, default: 0 },

  // Pinning (Red: 1 post, Golden: 3 posts)
  isPinned: { type: Boolean, default: false },

  // Moderation
  flagged: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },

}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
