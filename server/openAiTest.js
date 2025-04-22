require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
  });
  
  // 2) Import the OpenAI client
  const { OpenAI } = require('openai');
  
  async function runOpenAITest() {
    // 3) Instantiate client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI client created');
  
    // --- Test Embeddings endpoint ---
    console.log('⏳ Testing embeddings.create...');
    const textSample = 'Hello, world!';
    const embedResp = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: textSample
    });
    const embedding = embedResp.data[0].embedding;
    console.log(`✅ embeddings.create succeeded (length=${embedding.length})`);
  
    // --- Test ChatCompletion endpoint ---
    console.log('⏳ Testing chat.completions.create...');
    const chatResp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a friendly test assistant.' },
        { role: 'user',   content: 'What is 2+2?' }
      ],
      max_tokens: 10
    });
    const answer = chatResp.choices[0].message.content.trim();
    console.log(`✅ chat.completions.create succeeded: "${answer}"`);
  
    console.log('🎉 OpenAI smoke test passed!');
  }
  
  runOpenAITest().catch(err => {
    console.error('❌ OpenAI smoke test failed:', err);
    process.exit(1);
  });