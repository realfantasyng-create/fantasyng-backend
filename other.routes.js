// =====================================================
// routes/chat.routes.js
// HTTP routes for chat history (real-time via Socket.io)
// =====================================================
const express = require('express');
const router = express.Router();
const { protect } = require('./auth.middleware');
const Message = require('./Message');
const Chat = require('./Chat');

// Get all chats for current user
router.get('/', protect, async (req, res) => {
  try {
    const chats = await Chat.find({ members: req.user._id })
      .populate('members', 'username profilePhoto badge isOnline lastSeen')
      .sort({ lastMessageAt: -1 });
    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Get messages in a chat
router.get('/:chatId/messages', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;

    // Verify user is part of this chat
    const chat = await Chat.findOne({ _id: req.params.chatId, members: req.user._id });
    if (!chat) return res.status(403).json({ success: false, message: 'Access denied.' });

    const messages = await Message.find({
      chatId: req.params.chatId,
      isDeleted: false,
    })
    .populate('senderId', 'username profilePhoto badge')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    res.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Admin: Recover deleted message (within 90 days)
router.get('/admin/recover/:messageId', protect, async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    const message = await Message.findById(req.params.messageId)
      .populate('senderId', 'username')
      .populate('receiverId', 'username');

    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });

    res.json({ success: true, message });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// =====================================================
// routes/report.routes.js
// =====================================================
const reportRouter = express.Router();
const { Report } = require('./Others');
const { checkMassDeletion, processStrike } = require('./bot');

reportRouter.post('/', protect, async (req, res) => {
  try {
    const { reportedUserId, reportType, description, isAnonymous = false, evidence = [] } = req.body;

    const report = await Report.create({
      reporterId: req.user._id,
      reportedUserId,
      isAnonymous,
      reportType,
      description,
      evidence,
    });

    // Bot: Check for mass deletion after being reported
    checkMassDeletion(reportedUserId);

    res.status(201).json({ success: true, message: 'Report submitted.', reportId: report._id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

reportRouter.get('/my-reports', protect, async (req, res) => {
  try {
    const reports = await Report.find({ reporterId: req.user._id })
      .populate('reportedUserId', 'username')
      .sort({ createdAt: -1 });
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// =====================================================
// routes/event.routes.js
// =====================================================
const eventRouter = express.Router();
const { Event } = require('./Others');

// Browse events — members only
eventRouter.get('/', protect, async (req, res) => {
  try {
    const events = await Event.find({ isPublished: true, eventDate: { $gte: new Date() } })
      .sort({ eventDate: 1 });
    res.json({ success: true, events });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// RSVP to event
eventRouter.post('/:id/rsvp', protect, async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ success: false, message: 'Event not found.' });

    if (!event.rsvpList.includes(req.user._id)) {
      event.rsvpList.push(req.user._id);
      await event.save();
    }
    res.json({ success: true, message: 'RSVP confirmed!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Admin: Create event
eventRouter.post('/', protect, async (req, res) => {
  try {
    if (req.user.role === 'member') {
      return res.status(403).json({ success: false, message: 'Admin access required.' });
    }
    const event = await Event.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, event });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// =====================================================
// routes/story.routes.js
// =====================================================
const storyRouter = express.Router();
const upload = require('./upload.middleware');

storyRouter.post('/', protect, upload.single('media'), async (req, res) => {
  try {
    const user = req.user;
    const Story = require('mongoose').model('Story');

    // Story limits by badge
    const storyLimits = { free: 1, blue: 3, red: 7, golden: Infinity, executive: Infinity };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = await Story.countDocuments({ authorId: user._id, createdAt: { $gte: today } });

    if (todayCount >= storyLimits[user.badge]) {
      return res.status(429).json({ success: false, message: 'Daily story limit reached. Upgrade your badge.' });
    }

    if (!req.file) return res.status(400).json({ success: false, message: 'Media file required.' });

    const story = await Story.create({
      authorId: user._id,
      mediaUrl: `/uploads/${req.file.filename}`,
      mediaType: req.body.mediaType || 'photo',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours always
    });

    res.status(201).json({ success: true, story });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

storyRouter.get('/', protect, async (req, res) => {
  try {
    const Story = require('mongoose').model('Story');
    const stories = await Story.find({ expiresAt: { $gte: new Date() } })
      .populate('authorId', 'username profilePhoto badge')
      .sort({ createdAt: -1 });
    res.json({ success: true, stories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = {
  chatRouter: router,
  reportRouter,
  eventRouter,
  storyRouter,
};
