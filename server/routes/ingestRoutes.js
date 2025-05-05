// server/routes/ingestRoutes.js
const express = require('express');
const openaiService = require('../services/openaiService');
const pineconeService = require('../services/pineconeService');
const reviewService = require('../services/reviewService');
const db = require('../models/db');

const router = express.Router();

// POST /ingest
router.post('/', async (req, res) => {
  try {
    const { tip_text } = req.body;
    if (!tip_text) return res.status(400).json({ error: 'tip_text is required' });

    const id = `tip-${Date.now()}`;

    // 1) Moderation
    const mod = await openaiService.moderate(tip_text);
    const scores = mod.category_scores;
    if (mod.flagged || scores.violence >= 0.3 || scores['sexual'] >= 0.3) {
      await reviewService.queueFlaggedTip(id, tip_text, mod);
      return res.json({ status: 'review_needed', reason: 'flagged by moderation' });
    }

    // 2) Metadata extraction
    const metadata = await openaiService.extractLocationMetadata(tip_text);
    if (metadata.confidence < parseFloat(process.env.METADATA_CONFIDENCE_THRESHOLD) || 0.75) {
      await reviewService.queueLowConfidenceTip(
        id,
        tip_text,
        metadata.city,
        metadata.country,
        metadata.confidence
      );
      return res.json({ status: 'review_needed', reason: 'low metadata confidence' });
    }

    // 3) Embedding & upsert
    const vector = await openaiService.embedText(tip_text);
    await pineconeService.upsertTip(id, vector, {
      city: metadata.city,
      country: metadata.country,
      text: tip_text
    });

    // 4) Persist approved tip
    await db.run(
      `INSERT OR IGNORE INTO approved_tips (id, text, city, country, confidence) VALUES (?,?,?,?,?)`,
      [id, tip_text, metadata.city, metadata.country, metadata.confidence]
    );

    res.json({ status: 'approved', id, metadata: { city: metadata.city, country: metadata.country } });
  } catch (err) {
    console.error('INGEST ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
