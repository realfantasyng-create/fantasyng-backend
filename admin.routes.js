// =====================================================
// routes/admin.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const {
  getAllMembers, banMember, suspendMember, reinstateMember,
  elevateMember, changeBadgeWithoutPayment,
  getReports, resolveReport, promotePost,
  getRevenue, getAuditLog, getDashboardStats,
} = require('../controllers/admin.controller');
const { protect, adminOnly, executivesOnly, ceoOnly } = require('../middleware/auth.middleware');

// All admin routes require login + admin role
router.use(protect, adminOnly);

router.get('/dashboard', getDashboardStats);
router.get('/members', getAllMembers);
router.put('/members/:id/ban', banMember);
router.put('/members/:id/suspend', suspendMember);
router.put('/members/:id/reinstate', reinstateMember);
router.put('/members/:id/elevate', executivesOnly, elevateMember);
router.put('/members/:id/badge', executivesOnly, changeBadgeWithoutPayment);

router.get('/reports', getReports);
router.put('/reports/:id/resolve', resolveReport);

router.post('/posts/:id/promote', promotePost);

// Executives only
router.get('/revenue', executivesOnly, getRevenue);

// Audit log — CEO sees all, COO sees partial (handled in controller)
router.get('/audit-log', getAuditLog);

module.exports = router;
