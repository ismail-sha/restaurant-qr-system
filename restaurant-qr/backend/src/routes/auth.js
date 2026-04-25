const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, password } = req.body;

    const result = await db.query(
      'SELECT * FROM staff WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const staff = result.rows[0];
    const isMatch = await bcrypt.compare(password, staff.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: staff.id, email: staff.email, role: staff.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({
      token,
      staff: {
        id: staff.id,
        name: staff.name,
        email: staff.email,
        role: staff.role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req, res) => {
  res.json({ staff: req.staff });
});

module.exports = router;
