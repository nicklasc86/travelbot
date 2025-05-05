// server/services/reviewService.js

/**
 * Encapsulates all review-queue and admin approval/rejection logic.
 */
const db = require('../models/db');
const openaiService = require('./openaiService');
const pineconeService = require('./pineconeService');

module.exports = {
  /**
   * Queue a tip flagged by moderation for manual review.
   * @param {string} id
   * @param {string} text
   * @param {object} moderation
   */
  queueFlaggedTip: async (id, text, moderation) => {
    await db.run(
      `INSERT OR IGNORE INTO review_tips
         (id, text, city, country, confidence, moderation, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, text, null, null, null, JSON.stringify(moderation), 'flagged by moderation']
    );
  },

  /**
   * Queue a tip with low metadata confidence for manual review.
   * @param {string} id
   * @param {string} text
   * @param {string} city
   * @param {string} country
   * @param {number} confidence
   */
  queueLowConfidenceTip: async (id, text, city, country, confidence) => {
    await db.run(
      `INSERT OR IGNORE INTO review_tips
         (id, text, city, country, confidence, moderation, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, text, city, country, confidence, null, 'low metadata confidence']
    );
  },

  /**
   * Retrieve all tips awaiting review.
   * @returns {Promise<Array>} List of review tip objects
   */
  getReviewQueue: async () => {
    return await db.all(
      `SELECT * FROM review_tips ORDER BY created_at DESC`
    );
  },

  /**
   * Approve a tip: re-embed, upsert to Pinecone, persist in approved table, and remove from review queue.
   * @param {object} params - { id, overrideCity, overrideCountry }
   * @returns {Promise<object>} Approved tip metadata
   */
  approveTip: async ({ id, overrideCity, overrideCountry }) => {
    const tip = await db.get(`SELECT * FROM review_tips WHERE id = ?`, [id]);
    if (!tip) throw new Error('Tip not found');

    const finalCity = overrideCity?.trim() || tip.city;
    const finalCountry = overrideCountry?.trim() || tip.country;

    // Re-embed and upsert to Pinecone
    const vector = await openaiService.embedText(tip.text);
    await pineconeService.upsertTip(id, vector, {
      city: finalCity,
      country: finalCountry,
      text: tip.text
    });

    // Persist approved tip in DB
    await db.run(
      `INSERT OR IGNORE INTO approved_tips
         (id, text, city, country, confidence)
       VALUES (?, ?, ?, ?, ?)`,
      [id, tip.text, finalCity, finalCountry, tip.confidence]
    );

    // Remove from review queue
    await db.run(`DELETE FROM review_tips WHERE id = ?`, [id]);

    return { id, city: finalCity, country: finalCountry };
  },

  /**
   * Reject a tip: remove it from the review queue.
   * @param {string} id
   * @returns {Promise<object>} { id }
   */
  rejectTip: async (id) => {
    const result = await db.run(`DELETE FROM review_tips WHERE id = ?`, [id]);
    if (result.changes === 0) throw new Error('Tip not found');
    return { id };
  }
};
