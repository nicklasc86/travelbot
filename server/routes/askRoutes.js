// server/routes/askRoutes.js
const express = require('express');
const openaiService = require('../services/openaiService');
const pineconeService = require('../services/pineconeService');

const router = express.Router();

// POST /ask
router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    // 1) Extract location metadata
    const qmeta = await openaiService.extractLocationMetadata(query);

    // 2) Embed query
    const qVector = await openaiService.embedText(query);

    // 3) Build filter
    const filter = {};
    if (qmeta.city    && qmeta.city    !== 'Unknown') filter.city    = qmeta.city;
    if (qmeta.country && qmeta.country !== 'Unknown') filter.country = qmeta.country;

    // 4) Query Pinecone
    const matches = await pineconeService.queryTips(qVector, filter, 3);

    // 5) Build prompt snippets
    const snippets = matches.map((m, i) =>
      `${i+1}. (${m.metadata.city}, ${m.metadata.country}) ${m.metadata.text}`
    ).join('\n');

    // 6) Chat completion
    const chat = await openaiService.chatCompletion([
      { role: 'system',  content: 'You are a helpful travel assistant.' },
      { role: 'user',    content: `User asked: "${query}"\nHere are relevant tips:\n${snippets}\nAnswer using only these tips.` }
    ]);

    res.json({ answer: chat.choices[0].message.content.trim(), retrieved: matches });
  } catch (err) {
    console.error('ASK ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
