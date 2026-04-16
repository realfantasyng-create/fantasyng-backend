// =====================================================
// routes/post.routes.js
// =====================================================
const express = require('express');
const router = express.Router();
const { createPost, getFeed, getTrending, likePost, deletePost } = require('../controllers/post.controller');
const { protect } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

router.get('/trending', getTrending);                            // Public — non-members can see
router.get('/feed', protect, getFeed);                           // Members only
router.post('/', protect, upload.single('media'), createPost);
router.post('/:id/like', protect, likePost);
router.delete('/:id', protect, deletePost);

module.exports = router;
