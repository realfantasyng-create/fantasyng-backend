// =====================================================
// sockets/chat.socket.js
// Socket.io — Real-time Chat System
// =====================================================
const jwt = require('jsonwebtoken');
const User = require('./User');
const Message = require('./Message');
const Chat = require('./Chat');
const { checkSpam, moderateText } = require('./moderation.service');

// Track online users: { userId: socketId }
const onlineUsers = {};

const initSocket = (io) => {

  // ── Middleware: Authenticate socket connection ───
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error('Authentication required'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-passwordHash');
      if (!user) return next(new Error('User not found'));
      if (user.status === 'banned') return next(new Error('Account banned'));

      socket.user = user; // Attach user to socket
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`🟢 User connected: ${user.username} (${socket.id})`);

    // Register online
    onlineUsers[user._id.toString()] = socket.id;
    await User.findByIdAndUpdate(user._id, { isOnline: true, lastSeen: Date.now() });

    // Join personal room (for direct notifications)
    socket.join(user._id.toString());

    // Notify contacts this user is online
    io.emit('user_online', { userId: user._id });

    // ── Send a message ─────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { receiverId, content, mediaType = 'text', mediaUrl = '' } = data;

        // Check daily message limit
        const limit = user.getMessageLimit();
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const todayCount = await Message.countDocuments({
          senderId: user._id, createdAt: { $gte: today }
        });

        if (todayCount >= limit) {
          return socket.emit('error', { message: 'Daily message limit reached. Upgrade your badge.' });
        }

        // Check media permissions by badge
        const mediaLimits = {
          free: { short_video: 3, voice: 5, long_video: 0, video_call: 0 },
          blue: { short_video: Infinity, voice: 15, long_video: 2, video_call: 2 },
          red: { short_video: Infinity, voice: Infinity, long_video: Infinity, video_call: Infinity },
          golden: { short_video: Infinity, voice: Infinity, long_video: Infinity, video_call: Infinity },
          executive: { short_video: Infinity, voice: Infinity, long_video: Infinity, video_call: Infinity },
        };

        if (mediaType!== 'text' && mediaType!== 'photo') {
          const mediaCount = await Message.countDocuments({
            senderId: user._id, mediaType, createdAt: { $gte: today }
          });
          const mediaLimit = mediaLimits[user.badge]?.[mediaType]?? 0;
          if (mediaCount >= mediaLimit) {
            return socket.emit('error', { message: `Daily ${mediaType} limit reached. Upgrade your badge.` });
          }
        }

        // ── Bot: Spam check (early messages) ───────
        if (mediaType === 'text' && content) {
          const spamCheck = checkSpam(content);

          // Block phone numbers in early chat (first 10 messages between users)
          const chatHistory = await Message.countDocuments({
            $or: [
              { senderId: user._id, receiverId },
              { senderId: receiverId, receiverId: user._id }
            ]
          });

          if (chatHistory < 10 && spamCheck.hasPhoneNumber) {
            return socket.emit('error', { message: 'Phone numbers cannot be shared in early messages.' });
          }
          if (chatHistory < 5 && spamCheck.hasExternalLink) {
            return socket.emit('error', { message: 'External links are blocked in early messages.' });
          }

          // OpenAI moderation for harmful content
          const modResult = await moderateText(content);
          if (modResult.flagged) {
            return socket.emit('error', { message: 'Message blocked by moderation.' });
          }
        }

        // Find or create chat
        let chat = await Chat.findOne({ members: { $all: [user._id, receiverId] } });
        if (!chat) {
          chat = await Chat.create({ members: [user._id, receiverId] });
        }

        // Save message
        const message = await Message.create({
          chatId: chat._id,
          senderId: user._id,
          receiverId,
          content,
          mediaType,
          mediaUrl,
        });

        // Update chat last message
        await Chat.findByIdAndUpdate(chat._id, {
          lastMessage: content || `[${mediaType}]`,
          lastMessageAt: Date.now(),
        });

        // Deliver message to receiver if online
        const receiverSocketId = onlineUsers[receiverId];
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receive_message', {
            message,
            sender: {
              id: user._id,
              username: user.username,
              profilePhoto: user.profilePhoto,
              badge: user.badge,
            }
          });
        }

        // Confirm to sender
        socket.emit('message_sent', { messageId: message._id, chatId: chat._id });

      } catch (err) {
        console.error('Send message error:', err);
        socket.emit('error', { message: 'Message failed to send.' });
      }
    });

    // ── Typing indicator ───────────────────────────
    socket.on('typing', ({ receiverId }) => {
      const receiverSocket = onlineUsers[receiverId];
      if (receiverSocket) {
        io.to(receiverSocket).emit('user_typing', { userId: user._id, username: user.username });
      }
    });

    socket.on('stop_typing', ({ receiverId }) => {
      const receiverSocket = onlineUsers[receiverId];
      if (receiverSocket) {
        io.to(receiverSocket).emit('user_stop_typing', { userId: user._id });
      }
    });

    // ── Mark messages as read ──────────────────────
    socket.on('mark_read', async ({ chatId }) => {
      await Message.updateMany(
        { chatId, receiverId: user._id, isRead: false },
        { isRead: true, readAt: Date.now() }
      );
      socket.emit('messages_read', { chatId });
    });

    // ── Delete message (soft delete only) ─────────
    socket.on('delete_message', async ({ messageId }) => {
      const message = await Message.findById(messageId);
      if (!message) return;
      if (message.senderId.toString()!== user._id.toString()) return;

      message.isDeleted = true;
      message.deletedAt = new Date();
      message.deletedBy = user._id;
      await message.save();

      // Notify both users
      socket.emit('message_deleted', { messageId });
      const receiverSocket = onlineUsers[message.receiverId.toString()];
      if (receiverSocket) io.to(receiverSocket).emit('message_deleted', { messageId });
    });

    // ── Disconnect ─────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`🔴 User disconnected: ${user.username}`);
      delete onlineUsers[user._id.toString()];
      await User.findByIdAndUpdate(user._id, { isOnline: false, lastSeen: Date.now() });
      io.emit('user_offline', { userId: user._id });
    });
  });
};

// Export online users map for use in other files
const getOnlineUsers = () => onlineUsers;

module.exports = { initSocket, getOnlineUsers };
