// =====================================================
// controllers/post.controller.js
// Create, Feed, Trending, Like, Delete Posts
// =====================================================
const Post = require('../models/Post');
const User = require('../models/User');

// Daily post limits by badge
const POST_LIMITS = {
  free: { text: 2, photo: 1, short_video: 0, long_video: 0 },
  blue: { text: 5, photo: 3, short_video: 1, long_video: 0 },
  red:  { text: 15, photo: 10, short_video: 5, long_video: 2 },
  golden: { text: Infinity, photo: Infinity, short_video: Infinity, long_video: Infinity },
  executive: { text: Infinity, photo: Infinity, short_video: Infinity, long_video: Infinity },
};

// Post expiry by badge
const POST_EXPIRY_DAYS = { free: 2, blue: 7, red: 21, golden: null, executive: null };

// ── @POST /api/posts ──────────────────────────────
const createPost = async (req, res) => {
  try {
    const { content, mediaType = 'text' } = req.body;
    const user = req.user;

    // Check daily limit
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayCount = await Post.countDocuments({
      authorId: user._id, mediaType, createdAt: { $gte: today }
    });

    const limit = POST_LIMITS[user.badge]?.[mediaType] ?? 0;
    if (todayCount >= limit) {
      return res.status(429).json({ success: false, message: `Daily ${mediaType} post limit reached. Upgrade your badge.` });
    }

    // Calculate expiry
    const expiryDays = POST_EXPIRY_DAYS[user.badge];
    const expiresAt = expiryDays ? new Date(Date.now() + expiryDays * 86400000) : null;

    const mediaUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const post = await Post.create({
      authorId: user._id,
      content,
      mediaType,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      badgeTierAtPost: user.badge,
      expiresAt,
    });

    res.status(201).json({ success: true, message: 'Post created.', post });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/posts/feed ──────────────────────────
// Member feed sorted by badge priority (golden first)
const getFeed = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const posts = await Post.find({
      isDeleted: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
    })
    .populate('authorId', 'username profilePhoto badge trustScore')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

    // Sort by badge priority in memory
    const order = { executive: 5, golden: 4, red: 3, blue: 2, free: 1 };
    posts.sort((a, b) => (order[b.badgeTierAtPost] || 0) - (order[a.badgeTierAtPost] || 0));

    res.json({ success: true, count: posts.length, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @GET /api/posts/trending ──────────────────────
// Front page — promoted posts visible to NON-MEMBERS too
const getTrending = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const posts = await Post.find({ isPromotedToFrontPage: true, isDeleted: false })
      .populate('authorId', 'username profilePhoto badge trustScore')
      .sort({ promotedAt: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ success: true, count: posts.length, posts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @POST /api/posts/:id/like ─────────────────────
const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    const userId = req.user._id;
    const alreadyLiked = post.likes.includes(userId);

    if (alreadyLiked) {
      post.likes.pull(userId);
    } else {
      post.likes.push(userId);
    }
    await post.save();

    res.json({ success: true, liked: !alreadyLiked, likeCount: post.likes.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ── @DELETE /api/posts/:id ────────────────────────
// Soft delete — admin can still see it
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    // Only author or admin can delete
    if (post.authorId.toString() !== req.user._id.toString() && req.user.role === 'member') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    post.isDeleted = true;
    await post.save();

    res.json({ success: true, message: 'Post deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createPost, getFeed, getTrending, likePost, deletePost };
