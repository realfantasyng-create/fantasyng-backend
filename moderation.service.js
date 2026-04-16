// =====================================================
// services/moderation.service.js
// OpenAI Moderation API — Chat & Content Moderation
// =====================================================
const axios = require('axios');

// ── Check message content for harmful content ─────
const moderateText = async (text) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/moderations',
      { input: text },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    const result = response.data.results[0];
    return {
      flagged: result.flagged,
      categories: result.categories,
      scores: result.category_scores,
    };
  } catch (err) {
    // If API fails, don't block the message — log and move on
    console.error('Moderation API error:', err.message);
    return { flagged: false, error: err.message };
  }
};

// ── Nigerian spam keywords list ──────────────────
const SPAM_KEYWORDS = [
  'whatsapp me', 'call me on', 'my number is', 'reach me on',
  'send money', 'wire transfer', 'bitcoin', 'forex', 'investment',
  'follow my page', 'click here', 'visit my profile', 'click link',
];

// ── Check message for spam patterns ──────────────
const checkSpam = (text) => {
  const lower = text.toLowerCase();
  const foundKeywords = SPAM_KEYWORDS.filter(kw => lower.includes(kw));
  const hasExternalLink = /https?:\/\//i.test(text);
  const hasPhoneNumber = /(\+?234|0)[789][01]\d{8}/.test(text);
  return {
    isSpam: foundKeywords.length > 0 || hasExternalLink,
    hasPhoneNumber,
    hasExternalLink,
    foundKeywords,
  };
};

module.exports = { moderateText, checkSpam };
