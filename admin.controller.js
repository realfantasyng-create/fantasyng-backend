// =====================================================
// controllers/admin.controller.js
// Admin Panel — Member management, Reports, Revenue
// Only accessible by admin roles
// =====================================================
const User = require('./User');
const mongoose = require('mongoose');

// ── @GET /api/admin/members ───────────────────────
const getAllMembers = async (req, res) => {
  try {
    const { search, badge, status, role, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (search) filter.$or = [
      { username: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
      { phone: new RegExp(search, 'i') },
    ];
    if (badge) filter.badge = badge;
    if (status) filter.status = status;
    if (role) filter.role = role;

    const members = await User.find(filter)
     .select('-passwordHash')
     .sort({ createdAt: -1 })
     .skip((page - 1) * limit)
     .limit(parseInt(limit));

    const total = await User.countDocuments(filter);

    res.json({ success: true, total, count: members.length, members });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/members/:id/ban ──────────────
// Permanently ban — Chief Mod, Executives only
const banMember = async (req, res) => {
  try {
    if (!['chief_moderator', 'coo', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Chief Moderator or higher required to permanently ban.' });
    }

    const { reason } = req.body;
    await User.findByIdAndUpdate(req.params.id, {
      status: 'banned',
      banReason: reason || 'Violated FantasyNG Terms of Service',
    });

    // Log the action
    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.create({
      adminId: req.user._id,
      adminRole: req.user.role,
      action: 'Permanently banned member',
      targetUserId: req.params.id,
      details: reason || '',
    });

    res.json({ success: true, message: 'Member permanently banned.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/members/:id/suspend ──────────
const suspendMember = async (req, res) => {
  try {
    const { days = 7, reason } = req.body;
    const suspendedUntil = new Date(Date.now() + days * 86400000);

    await User.findByIdAndUpdate(req.params.id, {
      status: 'suspended',
      suspendedUntil,
      banReason: reason || '',
    });

    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.create({
      adminId: req.user._id, adminRole: req.user.role,
      action: `Suspended member for ${days} days`,
      targetUserId: req.params.id, details: reason || '',
    });

    res.json({ success: true, message: `Member suspended for ${days} days.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/members/:id/reinstate ─────────
const reinstateMember = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      status: 'active', suspendedUntil: null, banReason: '',
    });

    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.create({
      adminId: req.user._id, adminRole: req.user.role,
      action: 'Reinstated member', targetUserId: req.params.id,
    });

    res.json({ success: true, message: 'Member reinstated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/members/:id/elevate ───────────
// Elevate to admin role — Executives only
const elevateMember = async (req, res) => {
  try {
    if (!['coo', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Executives only can elevate members.' });
    }

    const { newRole } = req.body;
    if (!['moderator', 'chief_moderator'].includes(newRole)) {
      return res.status(400).json({ success: false, message: 'Invalid role. Can only elevate to moderator or chief_moderator.' });
    }

    const member = await User.findById(req.params.id);
    if (!member) return res.status(404).json({ success: false, message: 'Member not found.' });

    // Save original badge before elevation
    const originalBadge = member.badge;

    await User.findByIdAndUpdate(req.params.id, {
      role: newRole,
      badge: 'golden', // Auto-assign Golden badge to any admin
      originalBadge,
      isAdminElevated: true,
    });

    const AuditLog = mongoose.model('AuditLog');
    await AuditLog.create({
      adminId: req.user._id, adminRole: req.user.role,
      action: `Elevated member to ${newRole}`, targetUserId: req.params.id,
    });

    res.json({ success: true, message: `Member elevated to ${newRole}. Golden badge auto-assigned.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/members/:id/change-badge ─────
// Change badge without payment — Executives only
const changeBadgeWithoutPayment = async (req, res) => {
  try {
    if (!['coo', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Only Executives can change badges without payment.' });
    }

    const { badge } = req.body;
    await User.findByIdAndUpdate(req.params.id, { badge });

    res.json({ success: true, message: `Badge changed to ${badge}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/admin/reports ───────────────────────
const getReports = async (req, res) => {
  try {
    const Report = mongoose.model('Report');
    const { status = 'pending', page = 1, limit = 20 } = req.query;

    const reports = await Report.find({ status })
     .populate('reporterId', 'username email')
     .populate('reportedUserId', 'username email badge status')
     .sort({ createdAt: -1 })
     .skip((page - 1) * limit)
     .limit(parseInt(limit));

    res.json({ success: true, count: reports.length, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @PUT /api/admin/reports/:id/resolve ───────────
const resolveReport = async (req, res) => {
  try {
    const { action, notes } = req.body; // action: warn/suspend/ban/dismiss
    const Report = mongoose.model('Report');

    await Report.findByIdAndUpdate(req.params.id, {
      status: 'resolved',
      adminAction: action,
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    });

    res.json({ success: true, message: 'Report resolved.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @POST /api/admin/posts/:id/promote ────────────
// Promote post to front page
const promotePost = async (req, res) => {
  try {
    const Post = mongoose.model('Post');
    await Post.findByIdAndUpdate(req.params.id, {
      isPromotedToFrontPage: true,
      promotedAt: new Date(),
      promotedBy: req.user._id,
    });

    res.json({ success: true, message: 'Post promoted to front page.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/admin/revenue ───────────────────────
// EXECUTIVES ONLY — Full revenue data
const getRevenue = async (req, res) => {
  try {
    if (!['coo', 'ceo'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Revenue data restricted to Executives only.' });
    }

    const { Subscription, VirtualGift } = require('./Others');

    const totalBadgeRevenue = await Subscription.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalGiftCommissions = await VirtualGift.aggregate([
      { $group: { _id: null, total: { $sum: '$platformCommission' } } }
    ]);

    const totalMembers = await User.countDocuments();
    const activeMembers = await User.countDocuments({ status: 'active' });
    const badgeBreakdown = await User.aggregate([
      { $group: { _id: '$badge', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      revenue: {
        badges: totalBadgeRevenue[0]?.total || 0,
        giftCommissions: totalGiftCommissions[0]?.total || 0,
        total: (totalBadgeRevenue[0]?.total || 0) + (totalGiftCommissions[0]?.total || 0),
      },
      members: { total: totalMembers, active: activeMembers },
      badgeBreakdown,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/admin/audit-log ─────────────────────
const getAuditLog = async (req, res) => {
  try {
    const AuditLog = mongoose.model('AuditLog');
    const { page = 1, limit = 50 } = req.query;

    // CEO sees all. COO sees moderator actions only.
    const filter = {};
    if (req.user.role === 'coo') {
      filter.adminRole = { $in: ['moderator', 'chief_moderator'] };
    }

    const logs = await AuditLog.find(filter)
     .populate('adminId', 'username role')
     .populate('targetUserId', 'username')
     .sort({ createdAt: -1 })
     .skip((page - 1) * limit)
     .limit(parseInt(limit));

    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/admin/dashboard ─────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const Report = mongoose.model('Report');
    const BadgeApplication = require('./BadgeApplication');

    const [totalMembers, newToday, pendingReports, pendingBadges, onlineNow] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      Report.countDocuments({ status: 'pending' }),
      BadgeApplication.countDocuments({ status: 'pending' }),
      User.countDocuments({ isOnline: true }),
    ]);

    res.json({
      success: true,
      stats: { totalMembers, newToday, pendingReports, pendingBadges, onlineNow },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = {
  getAllMembers, banMember, suspendMember, reinstateMember,
  elevateMember, changeBadgeWithoutPayment,
  getReports, resolveReport, promotePost,
  getRevenue, getAuditLog, getDashboardStats,
};
