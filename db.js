// =====================================================
// config/db.js — MongoDB Connection
// FantasyNG Backend
// ⚡ EXECUTED BY XCLUSIVE ⚡
// =====================================================

const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1); // Stop server if DB fails to connect
  }
};

module.exports = connectDB;
