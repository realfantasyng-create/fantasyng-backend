// =====================================================
// utils/bot.js
// FantasyNG 24/7 Automated Moderation Bot
// Runs background tasks automatically
// =====================================================
const User = require('./User');
const Message = require('./Message');
const Post = require('./Post');
const { Story } = require('./Others');
const mongoose = require('mongoose');

// — Run all bot tasks (called on server start)
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

// — Expire old messages after 90 days
const expireOldMessages = async () => {
  try {
    const cutoff = new Date(Date.now() - 90 * 86400000);
    const result = await Message.updateMany(
      { createdAt: { $lt: cutoff }, isDeleted: false },
      { isDeleted: true }
    );
    if (result.modifiedCount > 0) {
      console.log(`Bot: Expired ${result.modifiedCount} old messages`);
    }
  } catch (err) {
    console.error('Bot expireOldMessages error:', err);
  }
};

// — Expire old stories after 24 hours
const expireOldStories = async () => {
  try {
    const result = await Story.updateMany(
      { expiresAt: { $lt: new Date() }, isDeleted: false },
      { isDeleted: true }
    );
    if (result.modifiedCount > 0) {
      console.log(`Bot: Expired ${result.modifiedCount} old stories`);
    }
  } catch (err) {
    console.error('Bot expireOldStories error:', err);
  }
};

// — Expire old posts based on badge tier
const expireOldPosts = async () => {
  try {
    const result = await Post.updateMany(
      { expiresAt: { $lt: new Date() }, isDeleted: false },
      { isDeleted: true }
    );
    if (result.modifiedCount > 0) {
      console.log(`Bot: Expired ${result.modifiedCount} old posts`);
    }
  } catch (err) {
    console.error('Bot expireOldPosts error:', err);
  }
};

// — Expire badges and downgrade users
const expireBadges = async () => {
  try {
    const result = await User.updateMany(
      { badgeExpiry: { $lt: new Date() }, badge: { $ne: 'free' } },
      { badge: 'free', badgeExpiry: null }
    );
    if (result.modifiedCount > 0) {
      console.log(`Bot: Downgraded ${result.modifiedCount} expired badges`);
    }
  } catch (err) {
    console.error('Bot expireBadges error:', err);
  }
};

// — Reset daily counters for all users
const resetDailyCounters = async () => {
  try {
    await User.updateMany({}, { $set: { dailyPostCount: 0, dailyStoryCount: 0 } });
    console.log('Bot: Reset daily counters');
  } catch (err) {
    console.error('Bot resetDailyCounters error:', err);
  }
};

// — Check trust scores and apply penalties
const checkTrustScores = async () => {
  try {
    // Ban users with trustScore < 10
    const banResult = await User.updateMany(
      { trustScore: { $lt: 10 }, status: 'active' },
      { status: 'banned', banReason: 'Low trust score' }
    );
    if (banResult.modifiedCount > 0) {
      console.log(`Bot: Banned ${banResult.modifiedCount} low trust users`);
    }
  } catch (err) {
    console.error('Bot checkTrustScores error:', err);
  }
};

// — Main bot loop - runs every 60 seconds
const runBot = () => {
  console.log('🤖 FantasyNG Bot starting...');
  
  // Run immediately on start
  runBotTasks();
  checkTrustScores();
  
  // Then run every 60 seconds
  setInterval(() => {
    runBotTasks();
    checkTrustScores();
  }, 60000); // 60 seconds
};

module.exports = { runBot, runBotTasks, checkTrustScores };
