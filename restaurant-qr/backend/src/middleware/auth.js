const jwt = require('jsonwebtoken');
const db = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const result = await db.query(
      'SELECT id, name, email, role FROM staff WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (!result.rows.length) {
      return res.status(401).json({ error: 'Staff not found or inactive' });
    }

    req.staff = result.rows[0];
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(err);
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.staff?.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

module.exports = { authenticate, requireRole };
