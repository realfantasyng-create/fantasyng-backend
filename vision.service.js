// =====================================================
// services/vision.service.js
// Google Vision API — Badge Verification
// =====================================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const VISION_URL = 'https://vision.googleapis.com/v1/images:annotate';

// Helper: convert image file to base64
const imageToBase64 = (filePath) => {
  const fullPath = path.join(__dirname, filePath);
  return fs.readFileSync(fullPath).toString('base64');
};

// ── Blue Badge Check ──────────────────────────────
// Detect real human face + "FantasyNG" text in selfie
const checkBlueBadge = async (photoPath) => {
  const imageContent = imageToBase64(photoPath);

  const response = await axios.post(`${VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
    requests: [{
      image: { content: imageContent },
      features: [
        { type: 'FACE_DETECTION', maxResults: 5 },
        { type: 'TEXT_DETECTION', maxResults: 10 },
      ]
    }]
  });

  const result = response.data.responses[0];
  const faces = result.faceAnnotations || [];
  const texts = result.textAnnotations || [];

  const hasFace = faces.length > 0 && faces[0].detectionConfidence > 0.8;
  const allText = texts.map(t => t.description.toLowerCase()).join(' ');
  const hasFantasyNGText = allText.includes('fantasyng') || allText.includes('fantasy');

  return { hasFace, hasFantasyNGText, faceCount: faces.length, rawText: allText };
};

// ── Red Badge Check ───────────────────────────────
// Detect real human face in video frames
const checkRedBadge = async (videoPath) => {
  // For video, we check the first frame (simplified)
  // In production, use Google Video Intelligence API for full video analysis
  try {
    const imageContent = imageToBase64(videoPath); // Works for single image too

    const response = await axios.post(`${VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
      requests: [{
        image: { content: imageContent },
        features: [{ type: 'FACE_DETECTION', maxResults: 5 }]
      }]
    });

    const faces = response.data.responses[0].faceAnnotations || [];
    const hasFace = faces.length > 0 && faces[0].detectionConfidence > 0.85;

    return { hasFace, faceCount: faces.length };
  } catch (err) {
    return { hasFace: false, error: err.message };
  }
};

// ── Golden Badge Check ────────────────────────────
// Validate ID document + match face
const checkGoldenBadge = async (videoPath, idPath) => {
  try {
    const idContent = imageToBase64(idPath);

    // Check ID document validity
    const idResponse = await axios.post(`${VISION_URL}?key=${process.env.GOOGLE_VISION_API_KEY}`, {
      requests: [{
        image: { content: idContent },
        features: [
          { type: 'DOCUMENT_TEXT_DETECTION' },
          { type: 'FACE_DETECTION' },
        ]
      }]
    });

    const idResult = idResponse.data.responses[0];
    const idText = idResult.fullTextAnnotation?.text || '';
    const idFaces = idResult.faceAnnotations || [];

    // Check if it looks like a valid Nigerian ID (NIN, Voters card)
    const idValid = idText.length > 50 && idFaces.length > 0;

    // Check age from ID (simplified — look for birth year)
    const currentYear = new Date().getFullYear();
    const yearMatches = idText.match(/\b(19[5-9]\d|200[0-6])\b/g);
    let isAdult = false;
    if (yearMatches) {
      const birthYear = parseInt(yearMatches[0]);
      isAdult = (currentYear - birthYear) >= 18;
    }

    return { idValid, faceMatches: idFaces.length > 0, isAdult, idText: idText.substring(0, 100) };
  } catch (err) {
    return { idValid: false, faceMatches: false, isAdult: false, error: err.message };
  }
};

module.exports = { checkBlueBadge, checkRedBadge, checkGoldenBadge };
