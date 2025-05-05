// server/routes/adminRoutes.js
const express = require('express');
const reviewService = require('../services/reviewService');

const router = express.Router();

// GET /admin/review
router.get('/review', async (req, res) => {
  try {
    const queue = await reviewService.getReviewQueue();
    res.json(queue);
  } catch (err) {
    console.error('REVIEW QUEUE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/approve/:id
router.post('/approve/:id', async (req, res) => {
  try {
    const { city, country } = req.body;
    const result = await reviewService.approveTip({
      id:            req.params.id,
      overrideCity:  city,
      overrideCountry: country
    });
    res.json({ status: 'approved', id: result.id, metadata: { city: result.city, country: result.country } });
  } catch (err) {
    console.error('APPROVE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/reject/:id
router.post('/reject/:id', async (req, res) => {
  try {
    await reviewService.rejectTip(req.params.id);
    res.json({ status: 'rejected', id: req.params.id });
  } catch (err) {
    console.error('REJECT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
