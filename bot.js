// =====================================================
// utils/bot.js
// FantasyNG 24/7 Automated Moderation Bot
// Runs background tasks automatically
// =====================================================
const User = require('./User');
const Message = require('./Message');
const mongoose = require('mongoose');

// ── Run all bot tasks (called on server start + interval) ──
const runBotTasks = async () => {
  console.log('🤖 Bot running scheduled tasks...');
  await Promise.all([
    expireOldMessages(),
    expireOldStories(),
    expireOldPosts(),
    expireBadges(),
    resetDailyCounters(),
  ]);
};

// ── Permanently delete messages older than 90 days ─
const expireOldMessages = async () => {
  try {
    const result = await Message.deleteMany({
      permanentDeleteAt: { $lte: new Date() }
    });
    if (result.deletedCount > 0) {
      console.log(`🗑️ Bot: Permanently deleted ${result.deletedCount} expired messages`);
    }
  } catch (err) {
    console.error('Bot expireOldMessages error:', err.message);
  }
};

// ── Expire old stories (24 hours) ─────────────────
const expireOldStories = async () => {
  try {
    const Story = mongoose.model('Story');
    const result = await Story.deleteMany({ expiresAt: { $lte: new Date() } });
    if (result.deletedCount > 0) {
      console.log(`📖 Bot: Deleted ${result.deletedCount} expired stories`);
    }
  } catch (err) {
    console.error('Bot expireOldStories error:', err.message);
  }
};

// ── Expire old posts ───────────────────────────────
const expireOldPosts = async () => {
  try {
    const Post = mongoose.model('Post');
    await Post.updateMany(
      { expiresAt: { $lte: new Date() }, isDeleted: false, expiresAt: { $ne: null } },
      { isDeleted: true }
    );
  } catch (err) {
    console.error('Bot expireOldPosts error:', err.message);
  }
};

// ── Downgrade expired badges to free ──────────────
const expireBadges = async () => {
  try {
    const result = await User.updateMany(
      {
        badge: { $in: ['blue', 'red', 'golden'] },
        badgeExpiry: { $lte: new Date() },
        isAdminElevated: false,
      },
      { badge: 'free', isVerified: false }
    );
    if (result.modifiedCount > 0) {
      console.log(`🏅 Bot: Expired ${result.modifiedCount} badges`);
    }
  } catch (err) {
    console.error('Bot expireBadges error:', err.message);
  }
};

// ── Reset daily message/like counters at midnight ─
const resetDailyCounters = async () => {
  try {
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    await User.updateMany(
      { lastDailyReset: { $lt: midnight } },
      { dailyMessageCount: 0, dailyLikeCount: 0, lastDailyReset: new Date() }
    );
  } catch (err) {
    console.error('Bot resetDailyCounters error:', err.message);
  }
};

// ── Detect mass deletion after being reported ─────
// Call this when a user deletes messages after a report
const checkMassDeletion = async (userId) => {
  try {
    const Report = mongoose.model('Report');
    const hasReport = await Report.findOne({
      reportedUserId: userId,
      status: 'pending',
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hrs
    });

    if (!hasReport) return;

    const recentDeletions = await Message.countDocuments({
      senderId: userId,
      isDeleted: true,
      deletedAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last 1 hour
    });

    if (recentDeletions >= 10) {
      console.log(`🚨 Bot Alert: User ${userId} is mass-deleting messages after being reported! Admin notified.`);
      // TODO: Send notification to admin (email/push)
      // In production: emit socket event to admin panel or send email
    }
  } catch (err) {
    console.error('Bot checkMassDeletion error:', err.message);
  }
};

// ── Auto-suspend after 3rd strike ─────────────────
const processStrike = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    user.strikes += 1;

    if (user.strikes === 1) {
      console.log(`⚠️ Bot: Strike 1 for ${user.username} — Warning issued`);
      // TODO: Send warning notification to user
    } else if (user.strikes === 2) {
      // Temporary suspension — 7 days
      user.status = 'suspended';
      user.suspendedUntil = new Date(Date.now() + 7 * 86400000);
      console.log(`🔴 Bot: Strike 2 for ${user.username} — Suspended 7 days`);
    } else if (user.strikes >= 3) {
      // Auto-suspend pending admin review
      user.status = 'suspended';
      user.suspendedUntil = new Date(Date.now() + 30 * 86400000);
      console.log(`🚨 Bot: Strike 3 for ${user.username} — Auto-suspended, admin review required`);
      // TODO: Alert admin for review
    }

    await user.save();
  } catch (err) {
    console.error('Bot processStrike error:', err.message);
  }
};

// ── Start bot on interval (runs every hour) ────────
const startBot = () => {
  console.log('🤖 FantasyNG Bot started');
  runBotTasks(); // Run immediately on start
  setInterval(runBotTasks, 60 *
