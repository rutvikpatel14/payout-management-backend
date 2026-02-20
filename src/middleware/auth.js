import jwt from 'jsonwebtoken';
import { pool } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid token' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.userId;
    pool
      .query('SELECT id, email, role FROM users WHERE id = $1', [userId])
      .then((result) => {
        const row = result.rows[0];
        if (!row) return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        req.user = { id: String(row.id), email: row.email, role: row.role };
        next();
      })
      .catch(() => res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' }));
  } catch {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
    next();
  };
}
