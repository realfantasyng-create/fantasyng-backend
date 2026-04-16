// =====================================================
// models/Message.js — Chat Message Schema
// FantasyNG Backend
// ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({

  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true,
    index: true,
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // Message content
  content: { type: String, default: '' },
  mediaType: {
    type: String,
    enum: ['text', 'photo', 'short_video', 'long_video', 'voice', 'video_call'],
    default: 'text',
  },
  mediaUrl: { type: String, default: '' },

  // Status
  isRead: { type: Boolean, default: false },
  readAt: { type: Date, default: null },

  // Deletion — SOFT DELETE ONLY (admin can recover within 90 days)
  // Per blueprint: instant permanent deletion is SCRAPPED
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  permanentDeleteAt: { type: Date, default: null }, // Set to 90 days after deletedAt

  // Moderation
  flagged: { type: Boolean, default: false },
  flagReason: { type: String, default: '' },
  flaggedAt: { type: Date, default: null },

}, { timestamps: true });

// ── HOOK: Set permanentDeleteAt 90 days after soft delete ──
MessageSchema.pre('save', function (next) {
  if (this.isModified('isDeleted') && this.isDeleted && this.deletedAt) {
    const ninetyDays = new Date(this.deletedAt);
    ninetyDays.setDate(ninetyDays.getDate() + 90);
    this.permanentDeleteAt = ninetyDays;
  }
  next();
});

module.exports = mongoose.model('Message', MessageSchema);
