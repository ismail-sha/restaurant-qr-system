/**
 * ai.js — Node.js helper to call the Python AI microservice
 * Add this file to: backend/src/utils/ai.js
 */

const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const aiClient = axios.create({
  baseURL: AI_URL,
  timeout: 8000,
});

/**
 * Get menu recommendations based on cart items.
 * @param {number[]} cartItemIds - Array of menu_item IDs in cart
 * @param {number} tableId
 * @returns {Promise<Array>} recommendations
 */
async function getRecommendations(cartItemIds, tableId = null) {
  try {
    const res = await aiClient.post('/ai/recommend', {
      cart_item_ids: cartItemIds,
      table_id: tableId,
      top_n: 4,
    });
    return res.data.recommendations || [];
  } catch (err) {
    console.error('AI recommendations error:', err.message);
    return []; // graceful fallback — app still works without AI
  }
}

/**
 * Predict prep time for an order.
 * @param {Array} items - [{menu_item_id, quantity, prep_time_minutes, category_name}]
 * @param {number} queueSize - how many orders are currently active
 * @returns {Promise<Object>} {predicted_minutes, confidence, method, breakdown}
 */
async function predictPrepTime(items, queueSize = null) {
  try {
    const res = await aiClient.post('/ai/predict-prep-time', {
      items,
      queue_size: queueSize,
    });
    return res.data;
  } catch (err) {
    console.error('AI prep time error:', err.message);
    // Fallback: use max prep time from items
    const maxPrep = items.reduce((m, i) => Math.max(m, i.prep_time_minutes || 15), 0);
    return { predicted_minutes: maxPrep + 5, confidence: 'low', method: 'fallback' };
  }
}

/**
 * Analyze sentiment of a text review.
 * @param {string} text
 * @returns {Promise<Object>} {sentiment, sentiment_score, categories, summary}
 */
async function analyzeSentiment(text) {
  try {
    const res = await aiClient.post('/ai/feedback/analyze', { text });
    return res.data;
  } catch (err) {
    console.error('AI sentiment error:', err.message);
    return { sentiment: 'neutral', sentiment_score: 0, categories: {} };
  }
}

/**
 * Save customer feedback with AI analysis.
 */
async function submitFeedback(reviewText, rating, orderId, tableId, itemRatings = {}) {
  try {
    const res = await aiClient.post('/ai/feedback/submit', {
      review_text: reviewText,
      rating,
      order_id: orderId,
      table_id: tableId,
      item_ratings: itemRatings,
    });
    return res.data;
  } catch (err) {
    console.error('AI feedback error:', err.message);
    return null;
  }
}

/**
 * Get weekly sentiment report (for kitchen admin view).
 */
async function getWeeklyReport(days = 7) {
  try {
    const res = await aiClient.get(`/ai/feedback/report?days=${days}`);
    return res.data;
  } catch (err) {
    console.error('AI report error:', err.message);
    return null;
  }
}

module.exports = {
  getRecommendations,
  predictPrepTime,
  analyzeSentiment,
  submitFeedback,
  getWeeklyReport,
};
