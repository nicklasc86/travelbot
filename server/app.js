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

// 6) Simple location extractor
function extractLocationNaive(text) {
  const knownCities = ['bangkok', 'prague', 'paris', 'london', 'rome'];
  const lower = text.toLowerCase();
  for (const city of knownCities) {
    if (lower.includes(city)) return city[0].toUpperCase() + city.slice(1);
  }
  return 'Unknown';
}

// 7) POST /ingest - ingest a travel tip
app.post('/ingest', async (req, res) => {
  try {
    const { tip_text } = req.body;
    if (!tip_text) return res.status(400).json({ error: 'tip_text is required' });

    // a) Extract metadata
    const location = extractLocationNaive(tip_text);

    // b) Create embedding
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: tip_text
    });
    const vector = embedResp.data[0].embedding;
    console.log(vector);

    // c) Upsert into Pinecone
    const namespace = 'default';
    const id = `tip-${Date.now()}`;
    
    const records = [
        {
          id: id,
          values: vector,
          metadata: { location, text: tip_text },
        }]

    await index.namespace(namespace).upsert(records);

    res.json({ message: 'Tip ingested', id, metadata: { location } });
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

    // a) Embed the user query
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: query
    });
    const qVector = embedResp.data[0].embedding;

    // b) Query Pinecone
    const namespace = 'default';
    const topK = 3;
    const queryResp = await index.namespace(namespace).query({
      vector: qVector,
      topK,
      includeMetadata: true
    });

    // c) Build context for GPT
    const snippets = queryResp.matches
      .map((m, i) => `${i + 1}. (${m.metadata.location}) ${m.metadata.text}`)
      .join('\n');

    // d) Call OpenAI chat
    const chatResp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful travel assistant.' },
        { role: 'user', content: `User asked: "${query}"\n\nHere are relevant tips:\n${snippets}\n\nAnswer using only these tips.` }
      ],
      temperature: 0.7,
      max_tokens: 200
    });

    const answer = chatResp.choices[0].message.content.trim();
    res.json({ answer, retrieved: queryResp.matches });
  } catch (err) {
    console.error('Ask error:', err);
    res.status(500).json({ error: err.message });
  }
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
