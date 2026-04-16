// =====================================================
// server.js — FantasyNG Backend Entry Point
// Nigeria's Premier Linkup Platform (18+)
// ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

require('dotenv').config(); // Load .env variables FIRST

const express    = require('express');
const http       = require('http');
const socketIO   = require('socket.io');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const path       = require('path');

const connectDB  = require('./db');
const { initSocket } = require('./sockets/chat.socket');
const { startBot }   = require('./utils/bot');

// ── Import all route files ────────────────────────
const authRoutes    = require('./routes/auth.routes');
const userRoutes    = require('./routes/user.routes');
const postRoutes    = require('./routes/post.routes');
const badgeRoutes   = require('./routes/badge.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes   = require('./routes/admin.routes');
const {
  chatRouter,
  reportRouter,
  eventRouter,
  storyRouter,
} = require('./routes/other.routes');

// ── Connect to MongoDB ────────────────────────────
connectDB();

// ── Create Express app ────────────────────────────
const app = express();

// ── Create HTTP server (required for Socket.io) ───
const server = http.createServer(app);

// ── Setup Socket.io ───────────────────────────────
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'https://fantasyng.netlify.app',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize Socket.io chat
initSocket(io);

// ── Security Middleware ───────────────────────────
app.use(helmet()); // Set secure HTTP headers

// CORS — allow frontend to talk to backend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://fantasyng.netlify.app',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Rate limiting — prevent brute force attacks
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                   // Max 100 requests per 15 min per IP
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limit on auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);

// ── Body Parsers ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Logger (shows requests in terminal) ──────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── Serve uploaded files ──────────────────────────
// Files uploaded by users are served from /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── API Routes ────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/posts',    postRoutes);
app.use('/api/badges',   badgeRoutes);
app.use('/api/payment',  paymentRoutes);
app.use('/api/admin',    adminRoutes);
app.use('/api/chat',     chatRouter);
app.use('/api/reports',  reportRouter);
app.use('/api/events',   eventRouter);
app.use('/api/stories',  storyRouter);

// ── Health check endpoint ─────────────────────────
// Visit: https://your-backend.com/api/health
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '🔥 FantasyNG backend is running!',
    platform: 'Nigeria\'s Premier Linkup Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── Root endpoint ─────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '⚡ FantasyNG API — Where Fantasy Becomes Reality',
    docs: 'https://fantasyng.netlify.app',
  });
});

// ── 404 Handler ───────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` });
});

// ── Global Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Server error.',
  });
});

// ── Start Server ──────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('');
  console.log('🔥 =============================================');
  console.log('🔥  FantasyNG Backend is RUNNING!');
  console.log(`🔥  Port: ${PORT}`);
  console.log(`🔥  Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log('🔥  Where Fantasy Becomes Reality');
  console.log('🔥 =============================================');
  console.log('');

  // Start the automated bot
  startBot();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = { app, server, io };
