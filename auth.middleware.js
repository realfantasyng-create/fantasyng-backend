// =====================================================
// middleware/auth.middleware.js
// Verifies JWT token on every protected route
// FantasyNG Backend | ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Protect route — must be logged in ─────────────
const protect = async (req, res, next) => {
  let token;

  // Check Authorization header for Bearer token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized. Please log in.' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from database (exclude password)
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }

    // Check if account is banned or suspended
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, message: 'Your account has been permanently banned.' });
    }

    if (user.status === 'suspended') {
      const now = new Date();
      if (user.suspendedUntil && now < user.suspendedUntil) {
        return res.status(403).json({
          success: false,
          message: `Your account is suspended until ${user.suspendedUntil.toLocaleDateString()}.`,
        });
      } else {
        // Suspension expired — restore account
        user.status = 'active';
        await user.save();
      }
    }

    // Check if badge has expired and downgrade if needed
    if (user.badge !== 'free' && user.badge !== 'executive' && user.isBadgeExpired()) {
      user.badge = 'free';
      await user.save();
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token. Please log in again.' });
  }
};

// ── Role check middleware ──────────────────────────
// Usage: roleCheck('ceo', 'coo') — pass allowed roles
const roleCheck = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }
    next();
  };
};

// ── Executives only (CEO + COO) ───────────────────
const executivesOnly = (req, res, next) => {
  if (!['ceo', 'coo'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to Executives only.',
    });
  }
  next();
};

// ── CEO only ─────────────────────────────────────
const ceoOnly = (req, res, next) => {
  if (req.user.role !== 'ceo') {
    return res.status(403).json({
      success: false,
      message: 'Access restricted to CEO only.',
    });
  }
  next();
};

// ── Any admin ─────────────────────────────────────
const adminOnly = (req, res, next) => {
  if (req.user.role === 'member') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required.',
    });
  }
  next();
};

module.exports = { protect, roleCheck, executivesOnly, ceoOnly, adminOnly };
