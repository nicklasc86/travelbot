// server/pineconeTest.js

// 1) Load your .env
require('dotenv').config({
    path: require('path').resolve(__dirname, '../.env')
  });
  
  const { Pinecone } = require('@pinecone-database/pinecone');

  async function runPineconeSmokeTest() {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    console.log('✅ Pinecone client created');
  
    const index = pinecone.Index(process.env.PINECONE_INDEX);
    const stats = await index.describeIndexStats();
    console.log('✅ describeIndexStats:', stats);
  
    
    //Upserting
    
    function generateRandomVector(dim, min = 1.0, max = 2.0) {
        const range = max - min;
        return Array.from({ length: dim }, () => Math.random() * range + min);
      }
      
      // … somewhere in your async function, before the upsert:
      
      const vectorId = 'vec1';
      const namespace = 'ns1';
      const values = generateRandomVector(1536, 1.0, 2.0);
      

    //console.log('⏳ upsert payload:', JSON.stringify(payload, null, 2));
    await index.namespace(namespace).upsert([
        {
           id: vectorId, 
           values: values,
           metadata: { genre: 'test' }
        }
    ]);

    console.log('✅ upserted test vector');

    //Querying
    const response = await index.namespace('ns1').query({
        topK: 2,
        vector: values,
        includeValues: true,
        includeMetadata: true,
        filter: { genre: { '$eq': 'test' }}
      });
      
    console.log('✅ response:', JSON.stringify(response, null, 2));
  
    console.log('🎉 Pinecone smoke test passed!');
  }
  
  runPineconeSmokeTest().catch(err => {
    console.error('❌ Pinecone smoke test failed:', err);
    process.exit(1);
  });