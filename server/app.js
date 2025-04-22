// server/app.js

// Phase 1: Node/Express backend with Pinecone + OpenAI integration

// 1) Load environment variables from root .env
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

// 2) Imports
const express = require('express');
const http = require('http');
const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 3) Initialize Pinecone client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX);

// 4) Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 5) Create Express app
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    delete req.headers.cookie;
    next();
  });

app.use(cors({
    origin: 'http://localhost:3000',   // React’s dev server origin
    methods: ['GET','POST','OPTIONS'], // the methods you’re using
    allowedHeaders: ['Content-Type'],  // headers you expect from the client
    credentials: false                  // set true if you need to accept/send cookies
  }));

  //Initialize admin database  
  const dbPath = path.resolve(__dirname, '../review.db');
  const db = new sqlite3.Database(dbPath, err => {
  if (err) return console.error('❌ SQLite open error:', err);
  console.log('✅ Connected to SQLite at', dbPath);
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS review_tips (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      city TEXT,
      country TEXT,
      confidence REAL,
      moderation TEXT,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, err => {
    if (err) console.error('❌ SQLite table creation error:', err);
  });

  // Configurable threshold for metadata confidence
const METADATA_CONFIDENCE_THRESHOLD = parseFloat(process.env.METADATA_CONFIDENCE_THRESHOLD) || 0.75;

// 7) POST /ingest - ingest a travel tip
app.post('/ingest', async (req, res) => {
  try {
    const { tip_text } = req.body;
    if (!tip_text) return res.status(400).json({ error: 'tip_text is required' });

    // a) Extract metadata 
    //const location = extractLocationNaive(tip_text);
    const id = `tip-${Date.now()}`;
    //Moderation
    const mod = await openai.moderations.create({ input: tip_text });
    const scores = mod.results[0].category_scores;

    const VIOLENCE_THRESHOLD = 0.3;
    const SEXUAL_THRESHOLD   = 0.3;

    if (
    scores.violence >= VIOLENCE_THRESHOLD ||
    scores['sexual']  >= SEXUAL_THRESHOLD ||
    mod.results[0].flagged
    ) {
    console.log('🔴 Moderation flagged:', scores);
    
    await db.prepare(`
        INSERT OR IGNORE INTO review_tips
          (id, text, city, country, confidence, moderation, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        tip_text,
        null,          // city unknown at moderation stage
        null,          // country unknown
        null,          // confidence unknown
        JSON.stringify(mod.results[0]),
        'flagged by moderation'
      );
    
    return res.json({
        status: 'review_needed',
        reason: 'moderation thresholds exceeded',
        moderation: mod.results[0]
    });
    }

    //Extract metadata, country, city and confidence

    const metaPrompt = [
        { role: 'system', content: 'Extract the city and country from the following travel tip and output JSON {"city":"...","country":"...","confidence":0.0} where confidence is a number 0–1 representing your certainty.' },
        { role: 'user', content: tip_text }
      ];
      const metaResp = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: metaPrompt,
        temperature: 0,
        max_tokens: 50
      });
      // Parse JSON safely
      let metadata;
      try {
        metadata = JSON.parse(metaResp.choices[0].message.content);
      } catch (parseErr) {
        console.warn('Metadata parse error:', parseErr);
        metadata = { city: 'Unknown', country: 'Unknown', confidence: 0 };
      }
  
      // Flag if below threshold
      if (metadata.confidence < METADATA_CONFIDENCE_THRESHOLD) {

        db.run(
            `INSERT OR IGNORE INTO review_tips
               (id, text, city, country, confidence, moderation, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [ id, tip_text, metadata.city, metadata.country, metadata.confidence, null, 'low metadata confidence' ],
            err => {
              if (err) console.error('❌ SQLite insert error:', err);
              else console.log(`✅ Tip ${id} queued for review`);
              res.json({
                status: 'review_needed',
                metadata,
                reason: 'low confidence'
              });
            }
          );
        
          return;  // stop further execution until inside callback
        }

    // b) Create embedding
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: tip_text
    });
    const vector = embedResp.data[0].embedding;
    console.log(vector);

    // c) Upsert into Pinecone
    const namespace = 'default';
   
    
    const records = [
        {
          id: id,
          values: vector,
          metadata: { country: metadata.country, city: metadata.city, text: tip_text },
        }]

    await index.namespace(namespace).upsert(records);

    res.json({ message: 'Tip ingested', id, metadata: { country: metadata.country, city: metadata.city } });
  } catch (err) {
    console.error('Ingest error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 8) POST /ask - answer a travel query
app.post('/ask', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    // Extract metadata from question
    const qMetaPrompt = [
        { role: 'system', content: 'Extract the city and/or country from this question and output JSON {"city":"...","country":"...","confidence":0.0}. If unknown, use "Unknown".' },
        { role: 'user', content: query }
      ];
      const qMetaResp = await openai.chat.completions.create({ model: 'gpt-3.5-turbo', messages: qMetaPrompt, temperature: 0, max_tokens: 50 });
      let qmetadata;
      try { qmetadata = JSON.parse(qMetaResp.choices[0].message.content); }
      catch (e) { console.warn('⚠️ Query metadata parse error:', e); qmetadata = { city: 'Unknown', country: 'Unknown', confidence: 0 }; }
      console.log('🔍 Query metadata:', qmetadata);

    // a) Embed the user query
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const qVector = embedResp.data[0].embedding;

     // Build filter based on extracted metadata
     const filter = {};
     if (qmetadata.city && qmetadata.city !== 'Unknown') filter.city = qmetadata.city;
     if (qmetadata.country && qmetadata.country !== 'Unknown') filter.country = qmetadata.country;
     console.log('🔎 Applying filter:', filter);

    // b) Query Pinecone
    const namespace = 'default';
    const topK = 3;
    const queryResp = await index.namespace(namespace).query({
      vector: qVector,
      topK,
      filter,
      includeMetadata: true
    });

    const snippets = queryResp.matches.map((m,i) => `${i+1}. (${m.metadata.city}, ${m.metadata.country}) ${m.metadata.text}`).join('\n');
    console.log('📋 Retrieved snippets:', queryResp.matches);

    // 7f) Call OpenAI chat for final answer
    const chatResp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful travel assistant.' },
        { role: 'user', content: `User asked: "${query}"\nHere are relevant tips:\n${snippets}\nAnswer using only these tips.` }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const answer = chatResp.choices[0].message.content.trim();
    return res.json({ answer, filter_applied: filter, retrieved: queryResp.matches });
  } catch (err) {
    console.error('❌ Ask error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /admin/review
app.get('/admin/review', (req, res) => {
    db.all(`SELECT * FROM review_tips ORDER BY created_at DESC`, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });
  
app.post('/admin/approve/:id', async (req, res) => {
    const { id } = req.params;
    const { city: overrideCity, country: overrideCountry } = req.body || {};
  
    db.get(`SELECT * FROM review_tips WHERE id = ?`, id, async (err, tip) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!tip) return res.status(404).json({ error: 'Not found' });
  
      try {
        // Determine final metadata
        const finalCity = overrideCity && overrideCity.trim() !== '' ? overrideCity : tip.city;
        const finalCountry = overrideCountry && overrideCountry.trim() !== '' ? overrideCountry : tip.country;
  
        // Re-embed the tip text
        const embedResp = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: tip.text
        });
        const vector = embedResp.data[0].embedding;
        const namespace = 'default';
  
        // 3) Upsert into Pinecone with the fresh vector
        const records = [
            {
              id: id,
              values: vector,
              metadata: { country: finalCountry, city: finalCity, text: tip.text },
            }]
    
        await index.namespace(namespace).upsert(records);
  
        // 4) Remove from review queue
        db.run(`DELETE FROM review_tips WHERE id = ?`, id, delErr => {
            if (delErr) console.error('❌ SQLite delete error:', delErr);
            res.json({ status: 'approved', id, metadata: { city: finalCity, country: finalCountry } });
          });
        } catch (upErr) {
          console.error('❌ Approve error:', upErr);
          res.status(500).json({ error: upErr.message });
        }
      });
    });
  
  // POST /admin/reject/:id
  app.post('/admin/reject/:id', (req, res) => {
    const { id } = req.params;
    db.run(`DELETE FROM review_tips WHERE id = ?`, id, function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      res.json({ status: 'rejected', id });
    });
  });
  

// 9) Start the server with a larger header limit
 const port = process.env.PORT || 5000;
 const server = http.createServer(
   { maxHeaderSize: 32768 },  // 32 KB header limit
   app                        // your Express app
 );
  server.listen(port, () => {
  console.log(`🚀 Server listening on http://localhost:${port} (maxHeaderSize=32KB)`);
});
