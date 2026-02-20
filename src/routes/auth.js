import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Validation error', message: 'Email and password are required' });
    }
    const emailNorm = email.trim().toLowerCase();
    const result = await pool.query(
      'SELECT id, email, password, role FROM users WHERE email = $1',
      [emailNorm]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password' });
    }
    const token = jwt.sign(
      { userId: String(user.id), role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: String(user.id), email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Login failed' });
  }
});

export default router;
