// =====================================================
// utils/helpers.js — Common Utility Functions
// =====================================================

// Format Naira amount
const formatNaira = (amount) => `₦${Number(amount).toLocaleString('en-NG')}`;

// Calculate days between dates
const daysBetween = (date1, date2) => {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.abs(Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24)));
};

// Calculate age from date of birth
const calculateAge = (dob) => {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

// Get badge expiry days by plan
const getPlanDays = (plan) => {
  const days = { monthly: 30, '3months': 90, '6months': 180, annual: 365 };
  return days[plan] || 30;
};

// Check if user can award free badge
// Only Executives (CEO/COO) and Chief Moderator
const canAwardFreeBadge = (role) => {
  return ['ceo', 'coo', 'chief_moderator'].includes(role);
};

// Sanitize user object for public response (remove sensitive fields)
const sanitizeUser = (user) => {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.resetPasswordOTP;
  delete obj.resetPasswordExpiry;
  delete obj.blockedUsers;
  delete obj.ghostList;
  return obj;
};

module.exports = {
  formatNaira, daysBetween, calculateAge,
  getPlanDays, canAwardFreeBadge, sanitizeUser,
};
