const express = require('express');
const QRCode = require('qrcode');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/tables — Get all tables (kitchen view)
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*,
        COUNT(o.id) FILTER (WHERE o.status NOT IN ('served','cancelled')) as active_orders
      FROM tables t
      LEFT JOIN orders o ON o.table_id = t.id
      GROUP BY t.id
      ORDER BY t.table_number
    `);
    res.json({ tables: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/tables/:id — Get single table
router.get('/:id', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Table not found' });
    res.json({ table: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// GET /api/tables/:id/qr — Generate QR code for a table
router.get('/:id/qr', authenticate, async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM tables WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Table not found' });

    const table = result.rows[0];
    const url = `${process.env.QR_BASE_URL}/table/${table.id}`;

    const qrOptions = {
      type: 'svg',
      width: 300,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    };

    const qrSvg = await QRCode.toString(url, { ...qrOptions, type: 'svg' });
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300, margin: 2 });

    // Save QR to table record
    await db.query('UPDATE tables SET qr_code = $1 WHERE id = $2', [url, table.id]);

    if (req.query.format === 'png') {
      const imgBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      res.set('Content-Type', 'image/png');
      return res.send(imgBuffer);
    }

    res.json({
      table: { id: table.id, tableNumber: table.table_number },
      url,
      qrSvg,
      qrDataUrl,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/tables — Admin: create a table
router.post('/', authenticate, requireRole(['admin']), async (req, res, next) => {
  try {
    const { table_number, name, capacity } = req.body;
    const result = await db.query(
      'INSERT INTO tables (table_number, name, capacity) VALUES ($1,$2,$3) RETURNING *',
      [table_number, name || `Table ${table_number}`, capacity || 4]
    );
    res.status(201).json({ table: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
