import express from 'express';
import { pool, toApiRow, toApiRows } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('OPS', 'FINANCE'));

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, upi_id, bank_account, ifsc, is_active, created_at, updated_at FROM vendors ORDER BY created_at DESC'
    );
    res.json({ data: toApiRows(result.rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch vendors' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, upi_id, bank_account, ifsc, is_active } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Validation error', message: 'name is required' });
    }
    const result = await pool.query(
      `INSERT INTO vendors (name, upi_id, bank_account, ifsc, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, upi_id, bank_account, ifsc, is_active, created_at, updated_at`,
      [
        name.trim(),
        upi_id?.trim() || '',
        bank_account?.trim() || '',
        ifsc?.trim() || '',
        is_active !== false,
      ]
    );
    const row = result.rows[0];
    res.status(201).json({ data: toApiRow(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to create vendor' });
  }
});

export default router;
