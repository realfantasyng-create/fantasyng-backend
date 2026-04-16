// =====================================================
// controllers/badge.controller.js
// Badge application, Google Vision check, Admin approval
// =====================================================
const BadgeApplication = require('../models/BadgeApplication');
const User = require('../models/User');
const visionService = require('../services/vision.service');

// Badge subscription pricing (in kobo for Paystack — multiply by 100)
const BADGE_PRICES = {
  blue:   { monthly: 150000, '3months': 350000, '6months': 600000, annual: 1000000 },
  red:    { monthly: 350000, '3months': 850000, '6months': 1500000, annual: 2500000 },
  golden: { monthly: 600000, '3months': 1500000, '6months': 2700000, annual: 4500000 },
};

// How many days each plan gives
const PLAN_DAYS = { monthly: 30, '3months': 90, '6months': 180, annual: 365 };

// ── @POST /api/badges/apply ───────────────────────
// Member submits verification application
const applyForBadge = async (req, res) => {
  try {
    const { badgeTier, plan } = req.body;
    const userId = req.user._id;

    if (!['blue', 'red', 'golden'].includes(badgeTier)) {
      return res.status(400).json({ success: false, message: 'Invalid badge tier.' });
    }

    // Check for pending application
    const existing = await BadgeApplication.findOne({ userId, status: 'pending' });
    if (existing) {
      return res.status(409).json({ success: false, message: 'You already have a pending application.' });
    }

    // Get uploaded files
    const files = req.files || {};
    const submittedPhoto = files.photo ? `/uploads/${files.photo[0].filename}` : '';
    const submittedVideo = files.video ? `/uploads/${files.video[0].filename}` : '';
    const submittedId    = files.id    ? `/uploads/${files.id[0].filename}`    : '';

    // ── Run Google Vision API check ─────────────────
    let googleVisionResult = {};
    let visionPassed = false;

    try {
      if (badgeTier === 'blue' && submittedPhoto) {
        // Blue: detect real human face + "FantasyNG" text
        googleVisionResult = await visionService.checkBlueBadge(submittedPhoto);
        visionPassed = googleVisionResult.hasFace && googleVisionResult.hasFantasyNGText;

      } else if (badgeTier === 'red' && submittedVideo) {
        // Red: real human face in video frames
        googleVisionResult = await visionService.checkRedBadge(submittedVideo);
        visionPassed = googleVisionResult.hasFace;

      } else if (badgeTier === 'golden' && submittedVideo && submittedId) {
        // Golden: valid ID + face matches ID
        googleVisionResult = await visionService.checkGoldenBadge(submittedVideo, submittedId);
        visionPassed = googleVisionResult.idValid && googleVisionResult.faceMatches && googleVisionResult.isAdult;
      }
    } catch (visionErr) {
      console.error('Vision API error:', visionErr);
      // Don't fail the application — admin will review manually
      googleVisionResult = { error: 'Vision API unavailable, manual review required' };
    }

    // Create application
    const application = await BadgeApplication.create({
      userId,
      badgeTier,
      plan,
      submittedPhoto,
      submittedVideo,
      submittedId,
      googleVisionResult,
      visionPassed,
    });

    res.status(201).json({
      success: true,
      message: `Application submitted! Admin will review within ${badgeTier === 'blue' ? '24' : badgeTier === 'red' ? '12' : '6'} hours.`,
      applicationId: application._id,
      visionPassed,
    });

  } catch (error) {
    console.error('Badge apply error:', error);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/badges/my-applications ─────────────
const getMyApplications = async (req, res) => {
  try {
    const applications = await BadgeApplication.find({ userId: req.user._id })
      .sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/badges/queue (Admin only) ──────────
const getApplicationQueue = async (req, res) => {
  try {
    const queue = await BadgeApplication.find({ status: 'pending' })
      .populate('userId', 'username email phone badge')
      .sort({ createdAt: 1 }); // Oldest first

    res.json({ success: true, count: queue.length, queue });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/badges/approve/:id (Admin only) ────
const approveApplication = async (req, res) => {
  try {
    const application = await BadgeApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    if (application.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Application already reviewed.' });
    }

    application.status = 'approved';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    await application.save();

    // Update user badge and expiry
    const days = PLAN_DAYS[application.plan] || 30;
    const expiryDate = new Date(Date.now() + days * 86400000);

    await User.findByIdAndUpdate(application.userId, {
      badge: application.badgeTier,
      badgeExpiry: expiryDate,
      isVerified: true,
      verificationLevel: application.badgeTier,
    });

    // Log admin action
    const { AuditLog } = require('../models/Others');
    await AuditLog.create({
      adminId: req.user._id,
      adminRole: req.user.role,
      action: `Approved ${application.badgeTier} badge for user ${application.userId}`,
      targetUserId: application.userId,
    });

    res.json({ success: true, message: 'Badge approved and activated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/badges/reject/:id (Admin only) ─────
const rejectApplication = async (req, res) => {
  try {
    const { reason } = req.body;
    const application = await BadgeApplication.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });

    application.status = 'rejected';
    application.reviewedBy = req.user._id;
    application.reviewedAt = new Date();
    application.rejectionReason = reason || 'Did not meet verification requirements.';
    await application.save();

    res.json({ success: true, message: 'Application rejected.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { applyForBadge, getMyApplications, getApplicationQueue, approveApplication, rejectApplication };
