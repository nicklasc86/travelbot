// server/services/openaiService.js

/**
 * Encapsulates all OpenAI API interactions: moderation, embeddings, metadata extraction, and chat completions.
 */

const { OpenAI } = require('openai');
const config = require('../config/index.js');

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });

module.exports = {
  /**
   * Run moderation on a given text.
   * @param {string} text
   * @returns {Promise<object>} moderation result (first element of results)
   */
  moderate: async (text) => {
    const resp = await openai.moderations.create({ input: text });
    return resp.results[0];
  },

  /**
   * Create an embedding for the given text.
   * @param {string} text
   * @returns {Promise<number[]>} embedding vector
   */
  embedText: async (text) => {
    const resp = await openai.embeddings.create({ model: 'text-embedding-ada-002', input: text });
    return resp.data[0].embedding;
  },

  /**
   * Extract city and country from a travel tip or question using function-calling.
   * @param {string} text
   * @returns {Promise<{city:string, country:string, confidence:number}>}
   */
  extractLocationMetadata: async (text) => {
    const functions = [{
      name: 'extract_location',
      description: 'Extract city and country from a travel tip',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: 'The city mentioned in the tip or "Unknown"' },
          country: { type: 'string', description: 'The country mentioned in the tip or "Unknown"' },
          confidence: { type: 'number', description: 'Models confidence from 0 to 1' }
        },
        required: ['city', 'country', 'confidence']
      }
    }];

    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Extract the city and country from the following travel tip. Use the defined function to respond.' },
        { role: 'user', content: text }
      ],
      functions,
      function_call: 'extract_location',
      temperature: 0
    });

    const fnCall = resp.choices[0].message;
    if (fnCall.function_call && fnCall.function_call.arguments) {
      try {
        return JSON.parse(fnCall.function_call.arguments);
      } catch {
        return { city: 'Unknown', country: 'Unknown', confidence: 0 };
      }
    }

    // Fallback: parse as JSON from content
    try {
      return JSON.parse(fnCall.content);
    } catch {
      return { city: 'Unknown', country: 'Unknown', confidence: 0 };
    }
  },

  /**
   * Generic chat completion wrapper.
   * @param {Array} messages
   * @param {object} options (model, temperature, max_tokens, functions, function_call)
   * @returns {Promise<object>} chat completion response
   */
  chatCompletion: async (messages, options = {}) => {
    const params = {
      model: options.model || 'gpt-3.5-turbo',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 200,
    };
    if (options.functions) {
      params.functions = options.functions;
      params.function_call = options.function_call;
    }
    const resp = await openai.chat.completions.create(params);
    return resp;
  }
};
