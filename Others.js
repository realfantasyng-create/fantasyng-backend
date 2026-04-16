// =====================================================
// models/Subscription.js
// =====================================================
const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  badgeTier: { type: String, enum: ['blue', 'red', 'golden'], required: true },
  plan: { type: String, enum: ['monthly', '3months', '6months', 'annual'], required: true },
  amount: { type: Number, required: true },
  paystackReference: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Subscription', SubscriptionSchema);


// =====================================================
// models/VirtualGift.js
// =====================================================
const VirtualGiftSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  giftType: { type: String, enum: ['rose', 'diamond', 'crown', 'flame'], required: true },
  amount: { type: Number, required: true }, // Full price paid
  platformCommission: { type: Number, required: true }, // 30% of amount
  paystackReference: { type: String, default: '' },
}, { timestamps: true });

mongoose.model('VirtualGift', VirtualGiftSchema);


// =====================================================
// models/Report.js
// =====================================================
const ReportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isAnonymous: { type: Boolean, default: false }, // Hides reporter from reported person — NOT from admin
  reportType: {
    type: String,
    enum: ['fake_profile', 'no_show', 'harassment', 'underage', 'scam', 'other'],
    required: true,
  },
  description: { type: String, default: '' },
  evidence: [{ type: String }], // URLs
  status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
  adminAction: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
}, { timestamps: true });

mongoose.model('Report', ReportSchema);


// =====================================================
// models/Review.js
// =====================================================
const ReviewSchema = new mongoose.Schema({
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reviewedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Ratings (true/false questions from blueprint)
  showedUp: { type: Boolean, default: null },
  matchedPhotos: { type: Boolean, default: null },
  wasRespectful: { type: Boolean, default: null },
  overallRating: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: '' },
  isAnonymous: { type: Boolean, default: false },
  isDisputed: { type: Boolean, default: false },
  disputeStatus: { type: String, enum: ['none', 'pending', 'resolved'], default: 'none' },
}, { timestamps: true });

mongoose.model('Review', ReviewSchema);


// =====================================================
// models/Event.js
// =====================================================
const EventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  location: { type: String, default: '' },
  city: { type: String, default: '' },
  eventDate: { type: Date, required: true },
  ticketPrice: { type: Number, default: 0 },
  totalTickets: { type: Number, default: 0 },
  soldTickets: { type: Number, default: 0 },
  rsvpList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

mongoose.model('Event', EventSchema);


// =====================================================
// models/AuditLog.js — Cannot be deleted or edited
// =====================================================
const AuditLogSchema = new mongoose.Schema({
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminRole: { type: String, required: true },
  action: { type: String, required: true }, // e.g. "banned user", "approved badge"
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  details: { type: String, default: '' },
}, { timestamps: true });

// Prevent deletion of audit logs
AuditLogSchema.pre('remove', function (next) {
  const err = new Error('Audit logs cannot be deleted');
  next(err);
});

mongoose.model('AuditLog', AuditLogSchema);


// =====================================================
// models/Story.js
// =====================================================
const StorySchema = new mongoose.Schema({
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  mediaUrl: { type: String, required: true },
  mediaType: { type: String, enum: ['photo', 'video'], default: 'photo' },
  views: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  expiresAt: { type: Date, required: true }, // Always 24 hours from creation
}, { timestamps: true });

mongoose.model('Story', StorySchema);


// Export all models
module.exports = {
  Subscription: mongoose.model('Subscription'),
  VirtualGift: mongoose.model('VirtualGift'),
  Report: mongoose.model('Report'),
  Review: mongoose.model('Review'),
  Event: mongoose.model('Event'),
  AuditLog: mongoose.model('AuditLog'),
  Story: mongoose.model('Story'),
};
