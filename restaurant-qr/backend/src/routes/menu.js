const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/menu — Public: get full menu grouped by category
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        c.id as category_id,
        c.name as category_name,
        c.sort_order as category_order,
        mi.id,
        mi.name,
        mi.description,
        mi.price,
        mi.emoji,
        mi.prep_time_minutes,
        mi.is_available,
        mi.is_vegetarian,
        mi.is_vegan,
        mi.spice_level,
        mi.allergens,
        mi.sort_order
      FROM categories c
      LEFT JOIN menu_items mi ON mi.category_id = c.id
      WHERE c.is_active = true
      ORDER BY c.sort_order, mi.sort_order, mi.name
    `);

    // Group by category
    const categorized = {};
    result.rows.forEach(row => {
      if (!categorized[row.category_id]) {
        categorized[row.category_id] = {
          id: row.category_id,
          name: row.category_name,
          sort_order: row.category_order,
          items: [],
        };
      }
      if (row.id) {
        categorized[row.category_id].items.push({
          id: row.id,
          name: row.name,
          description: row.description,
          price: parseFloat(row.price),
          emoji: row.emoji,
          prepTimeMinutes: row.prep_time_minutes,
          isAvailable: row.is_available,
          isVegetarian: row.is_vegetarian,
          isVegan: row.is_vegan,
          spiceLevel: row.spice_level,
          allergens: row.allergens || [],
        });
      }
    });

    res.json({ categories: Object.values(categorized) });
  } catch (err) {
    next(err);
  }
});

// GET /api/menu/:id — Public: get single item
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT mi.*, c.name as category_name
       FROM menu_items mi
       LEFT JOIN categories c ON c.id = mi.category_id
       WHERE mi.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/menu/:id/availability — Kitchen: toggle availability
router.patch('/:id/availability', authenticate, async (req, res, next) => {
  try {
    const { is_available } = req.body;
    const result = await db.query(
      `UPDATE menu_items SET is_available = $1, updated_at = NOW()
       WHERE id = $2 RETURNING *`,
      [is_available, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });

    // Notify all connected customers
    const io = req.app.get('io');
    io.emit('menu_updated', {
      itemId: result.rows[0].id,
      isAvailable: is_available,
    });

    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// POST /api/menu — Admin: add menu item
router.post('/', authenticate, requireRole(['admin']), [
  body('name').notEmpty().trim(),
  body('price').isFloat({ min: 0 }),
  body('category_id').isInt(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { category_id, name, description, price, emoji, prep_time_minutes, is_vegetarian, is_vegan, spice_level } = req.body;
    const result = await db.query(
      `INSERT INTO menu_items (category_id, name, description, price, emoji, prep_time_minutes, is_vegetarian, is_vegan, spice_level)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [category_id, name, description, price, emoji || '🍽️', prep_time_minutes || 15, is_vegetarian || false, is_vegan || false, spice_level || 0]
    );
    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// PUT /api/menu/:id — Admin: update menu item
router.put('/:id', authenticate, requireRole(['admin']), async (req, res, next) => {
  try {
    const { name, description, price, emoji, prep_time_minutes, is_vegetarian, is_vegan, spice_level, category_id } = req.body;
    const result = await db.query(
      `UPDATE menu_items SET
        name=$1, description=$2, price=$3, emoji=$4, prep_time_minutes=$5,
        is_vegetarian=$6, is_vegan=$7, spice_level=$8, category_id=$9, updated_at=NOW()
       WHERE id=$10 RETURNING *`,
      [name, description, price, emoji, prep_time_minutes, is_vegetarian, is_vegan, spice_level, category_id, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Item not found' });
    res.json({ item: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
