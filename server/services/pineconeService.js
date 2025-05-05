// server/services/pineconeService.js

/**
 * Encapsulates all Pinecone interactions: upserting and querying vectors.
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const config = require('../config');

 // Initialize Pinecone client
const pinecone = new Pinecone({ apiKey: config.PINECONE_API_KEY });
const index = pinecone.Index(config.PINECONE_INDEX);

module.exports = {
  /**
   * Upsert a single tip into Pinecone.
   * @param {string} id - Unique vector id
   * @param {number[]} values - Embedding vector
   * @param {object} metadata - Tip metadata
   */
  upsertTip: async (id, values, metadata) => {
    await index.upsert({
      namespace: 'default',
      vectors: [{ id, values, metadata }]
    });
  },

  /**
   * Query Pinecone with a vector and optional metadata filter.
   * @param {number[]} vector - Query embedding
   * @param {object} filter - Optional metadata filter
   * @param {number} topK - Number of top matches
   * @returns {Promise<object[]>} Array of match objects
   */
  queryTips: async (vector, filter = {}, topK = 3) => {
    const response = await index.query({
      namespace: 'default',
      vector,
      filter,
      topK,
      includeMetadata: true
    });
    return response.matches;
  }
};