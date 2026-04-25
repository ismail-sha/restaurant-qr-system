const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Generate order number
const generateOrderNumber = () => {
  const ts = Date.now().toString().slice(-6);
  return `ORD-${ts}`;
};

// ── POST /api/orders — Customer places an order ─────────────────────────────
router.post('/', [
  body('tableId').isInt({ min: 1 }),
  body('items').isArray({ min: 1 }),
  body('items.*.menuItemId').isInt(),
  body('items.*.quantity').isInt({ min: 1, max: 20 }),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { tableId, items, notes } = req.body;

    // Verify table exists
    const tableRes = await client.query(
      'SELECT * FROM tables WHERE id = $1 AND is_active = true',
      [tableId]
    );
    if (!tableRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Table not found' });
    }
    const table = tableRes.rows[0];

    // Validate and price all items
    let totalAmount = 0;
    let maxPrepTime = 0;
    const validatedItems = [];

    for (const item of items) {
      const menuRes = await client.query(
        'SELECT * FROM menu_items WHERE id = $1 AND is_available = true',
        [item.menuItemId]
      );
      if (!menuRes.rows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Menu item ${item.menuItemId} not available` });
      }
      const menuItem = menuRes.rows[0];
      const subtotal = parseFloat(menuItem.price) * item.quantity;
      totalAmount += subtotal;
      maxPrepTime = Math.max(maxPrepTime, menuItem.prep_time_minutes);
      validatedItems.push({ menuItem, quantity: item.quantity, subtotal, instructions: item.specialInstructions || null });
    }

    // Create order
    const orderRes = await client.query(
      `INSERT INTO orders (order_number, table_id, total_amount, notes, estimated_time_minutes, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [generateOrderNumber(), tableId, totalAmount, notes || null, maxPrepTime + 5]
    );
    const order = orderRes.rows[0];

    // Create order items
    for (const vi of validatedItems) {
      await client.query(
        `INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, subtotal, special_instructions)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, vi.menuItem.id, vi.quantity, vi.menuItem.price, vi.subtotal, vi.instructions]
      );
    }

    // Log status history
    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, note)
       VALUES ($1, NULL, 'pending', 'Order placed by customer')`,
      [order.id]
    );

    await client.query('COMMIT');

    // Build response
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
      items: validatedItems.map(vi => ({
        menuItemId: vi.menuItem.id,
        name: vi.menuItem.name,
        emoji: vi.menuItem.emoji,
        quantity: vi.quantity,
        unitPrice: parseFloat(vi.menuItem.price),
        subtotal: vi.subtotal,
      })),
    };

    // Emit to kitchen via Socket.IO
    const io = req.app.get('io');
    io.to('kitchen').emit('new_order', { order: fullOrder });
    io.to('kitchen').emit('kitchen_notification', {
      type: 'new_order',
      message: `New order from Table ${table.table_number}!`,
      orderId: order.id,
    });

    res.status(201).json({ order: fullOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── GET /api/orders — Kitchen: get all active orders ────────────────────────
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { status, tableId } = req.query;
    let query = `
      SELECT
        o.*,
        t.table_number,
        json_agg(json_build_object(
          'id', oi.id,
          'menuItemId', oi.menu_item_id,
          'name', mi.name,
          'emoji', mi.emoji,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'subtotal', oi.subtotal,
          'specialInstructions', oi.special_instructions
        ) ORDER BY oi.id) as items
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    } else {
      query += ` AND o.status != 'served' AND o.status != 'cancelled'`;
    }
    if (tableId) {
      params.push(tableId);
      query += ` AND o.table_id = $${params.length}`;
    }

    query += ` GROUP BY o.id, t.table_number ORDER BY o.placed_at DESC`;

    const result = await db.query(query, params);
    res.json({ orders: result.rows.map(formatOrder) });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/orders/:id — Get single order (customer or kitchen) ─────────────
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        o.*,
        t.table_number,
        json_agg(json_build_object(
          'id', oi.id,
          'menuItemId', oi.menu_item_id,
          'name', mi.name,
          'emoji', mi.emoji,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'subtotal', oi.subtotal,
          'specialInstructions', oi.special_instructions
        ) ORDER BY oi.id) as items
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.id = $1
      GROUP BY o.id, t.table_number
    `, [req.params.id]);

    if (!result.rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json({ order: formatOrder(result.rows[0]) });
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/orders/:id/status — Kitchen: update order status ─────────────
router.patch('/:id/status', authenticate, [
  body('status').isIn(['confirmed', 'cooking', 'ready', 'served', 'cancelled']),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { status, note, estimatedTimeMinutes } = req.body;

    // Get current order
    const current = await client.query(
      'SELECT o.*, t.table_number FROM orders o JOIN tables t ON t.id = o.table_id WHERE o.id = $1',
      [req.params.id]
    );
    if (!current.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Order not found' });
    }
    const oldOrder = current.rows[0];

    // Timestamp fields
    const timestampMap = {
      confirmed: 'confirmed_at',
      cooking: 'cooking_started_at',
      ready: 'ready_at',
      served: 'served_at',
      cancelled: 'cancelled_at',
    };
    const tsField = timestampMap[status];
    const estUpdate = estimatedTimeMinutes ? `, estimated_time_minutes = ${estimatedTimeMinutes}` : '';

    const updateRes = await client.query(
      `UPDATE orders SET status = $1, ${tsField} = NOW() ${estUpdate}, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );
    const updatedOrder = updateRes.rows[0];

    // History
    await client.query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.params.id, oldOrder.status, status, req.staff.id, note || null]
    );

    await client.query('COMMIT');

    const io = req.app.get('io');

    // Notify customer table
    io.to(`table_${oldOrder.table_id}`).emit('order_status_update', {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.order_number,
      status: updatedOrder.status,
      estimatedTimeMinutes: updatedOrder.estimated_time_minutes,
      updatedAt: updatedOrder.updated_at,
    });

    // Notify kitchen
    io.to('kitchen').emit('order_updated', {
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      tableNumber: oldOrder.table_number,
    });

    res.json({ order: updatedOrder });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ── GET /api/orders/table/:tableId — Customer: get orders for a table ────────
router.get('/table/:tableId', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        o.*,
        t.table_number,
        json_agg(json_build_object(
          'id', oi.id,
          'menuItemId', oi.menu_item_id,
          'name', mi.name,
          'emoji', mi.emoji,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'subtotal', oi.subtotal
        ) ORDER BY oi.id) as items
      FROM orders o
      JOIN tables t ON t.id = o.table_id
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE o.table_id = $1
        AND o.status NOT IN ('served', 'cancelled')
        AND o.placed_at > NOW() - INTERVAL '4 hours'
      GROUP BY o.id, t.table_number
      ORDER BY o.placed_at DESC
    `, [req.params.tableId]);

    res.json({ orders: result.rows.map(formatOrder) });
  } catch (err) {
    next(err);
  }
});

function formatOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    tableId: row.table_id,
    tableNumber: row.table_number,
    status: row.status,
    totalAmount: parseFloat(row.total_amount),
    estimatedTimeMinutes: row.estimated_time_minutes,
    notes: row.notes,
    placedAt: row.placed_at,
    confirmedAt: row.confirmed_at,
    cookingStartedAt: row.cooking_started_at,
    readyAt: row.ready_at,
    servedAt: row.served_at,
    items: row.items || [],
  };
}

module.exports = router;
