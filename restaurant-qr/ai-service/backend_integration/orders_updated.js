/**
 * UPDATED orders.js — Add these changes to your existing backend/src/routes/orders.js
 *
 * Changes:
 * 1. When order is placed → call AI to predict prep time
 * 2. New route: POST /api/orders/:id/feedback  — save customer review
 * 3. New route: GET  /api/ai/report            — weekly sentiment report
 * 4. New route: GET  /api/orders/:id/recommend — recommendations for a cart
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');
const ai = require('../utils/ai'); // ← ADD THIS LINE

const router = express.Router();

const generateOrderNumber = () => `ORD-${Date.now().toString().slice(-6)}`;

// ── POST /api/orders — Place order WITH AI prep time ──────────────────────
router.post('/', [
  body('tableId').isInt({ min: 1 }),
  body('items').isArray({ min: 1 }),
  body('items.*.menuItemId').isInt(),
  body('items.*.quantity').isInt({ min: 1 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { tableId, items, notes } = req.body;

    const tableRes = await client.query(
      'SELECT * FROM tables WHERE id = $1 AND is_active = true', [tableId]
    );
    if (!tableRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Table not found' });
    }
    const table = tableRes.rows[0];

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const menuRes = await client.query(
        `SELECT mi.*, c.name as category_name
         FROM menu_items mi
         LEFT JOIN categories c ON c.id = mi.category_id
         WHERE mi.id = $1 AND mi.is_available = true`,
        [item.menuItemId]
      );
      if (!menuRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not available` });
      }
      const menuItem = menuRes.rows[0];
      const subtotal = parseFloat(menuItem.price) * item.quantity;
      totalAmount += subtotal;
      validatedItems.push({
        menuItem,
        quantity: item.quantity,
        subtotal,
        instructions: item.specialInstructions || null,
      });
    }

    // ── AI: Predict prep time ─────────────────────────────────────────
    const aiItems = validatedItems.map(vi => ({
      menu_item_id: vi.menuItem.id,
      quantity: vi.quantity,
      prep_time_minutes: vi.menuItem.prep_time_minutes,
      category_name: vi.menuItem.category_name || '',
    }));

    // Get current queue size
    const queueRes = await client.query(
      `SELECT COUNT(*) as queue FROM orders WHERE status IN ('pending','confirmed','cooking')`
    );
    const queueSize = parseInt(queueRes.rows[0].queue);

    // Call AI service (non-blocking — if it fails we use fallback)
    const aiPrediction = await ai.predictPrepTime(aiItems, queueSize);
    const estimatedTime = aiPrediction.predicted_minutes;
    // ─────────────────────────────────────────────────────────────────

    const orderRes = await client.query(
      `INSERT INTO orders (order_number, table_id, total_amount, notes, estimated_time_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [generateOrderNumber(), tableId, totalAmount, notes || null, estimatedTime]
    );
    const order = orderRes.rows[0];

    for (const vi of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal, special_instructions)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, vi.menuItem.id, vi.quantity, vi.menuItem.price, vi.subtotal, vi.instructions]
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, note)
       VALUES ($1, NULL, 'pending', 'Order placed by customer')`,
      [order.id]
    );

    await client.query('COMMIT');

    const fullOrder = {
      id: order.id,
      orderNumber: order.order_number,
      tableId: order.table_id,
      tableNumber: table.table_number,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      estimatedTimeMinutes: order.estimated_time_minutes,
      notes: order.notes,
      placedAt: order.placed_at,
      aiPrediction: {                          // ← NEW: send AI info to frontend
        method: aiPrediction.method,
        confidence: aiPrediction.confidence,
        queueSize,
      },
      items: validatedItems.map(vi => ({
        menuItemId: vi.menuItem.id,
        name: vi.menuItem.name,
        emoji: vi.menuItem.emoji,
        quantity: vi.quantity,
        unitPrice: parseFloat(vi.menuItem.price),
        subtotal: vi.subtotal,
      })),
    };

    const io = req.app.get('io');
    io.to('kitchen').emit('new_order', { order: fullOrder });

    res.status(201).json({ order: fullOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});


// ── GET /api/orders/recommend — Get recommendations for cart items ─────────
router.get('/recommend', async (req, res, next) => {
  try {
    const { itemIds, tableId } = req.query;
    if (!itemIds) return res.json({ recommendations: [] });

    const ids = String(itemIds).split(',').map(Number).filter(Boolean);
    const recommendations = await ai.getRecommendations(ids, tableId ? parseInt(tableId) : null);
    res.json({ recommendations });
  } catch (err) {
    next(err);
  }
});


// ── POST /api/orders/:id/feedback — Submit customer review ────────────────
router.post('/:id/feedback', [
  body('reviewText').notEmpty().trim(),
  body('rating').isInt({ min: 1, max: 5 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { reviewText, rating, itemRatings } = req.body;

    // Get order info
    const orderRes = await db.query(
      'SELECT * FROM orders WHERE id = $1', [req.params.id]
    );
    if (!orderRes.rows.length) return res.status(404).json({ error: 'Order not found' });
    const order = orderRes.rows[0];

    const result = await ai.submitFeedback(
      reviewText, rating, order.id, order.table_id, itemRatings || {}
    );

    res.json({
      success: true,
      sentiment: result?.analysis?.sentiment,
      message: 'Thank you for your feedback!',
    });
  } catch (err) {
    next(err);
  }
});


// ── GET /api/ai/report — Weekly sentiment report (kitchen admin) ───────────
router.get('/ai/report', authenticate, async (req, res, next) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const report = await ai.getWeeklyReport(days);
    res.json(report || { message: 'No data yet' });
  } catch (err) {
    next(err);
  }
});


module.exports = router;
