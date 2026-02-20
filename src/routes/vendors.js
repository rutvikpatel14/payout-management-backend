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

router.put('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, upi_id, bank_account, ifsc, is_active } = req.body;
    
    // Check if vendor exists
    const checkResult = await pool.query('SELECT id FROM vendors WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Vendor not found' });
    }
    
    // Validate name if provided
    if (name !== undefined) {
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Validation error', message: 'name must be a non-empty string' });
      }
    }
    
    // Build update query dynamically based on provided fields
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      params.push(name.trim());
    }
    if (upi_id !== undefined) {
      updates.push(`upi_id = $${paramIndex++}`);
      params.push(upi_id?.trim() || '');
    }
    if (bank_account !== undefined) {
      updates.push(`bank_account = $${paramIndex++}`);
      params.push(bank_account?.trim() || '');
    }
    if (ifsc !== undefined) {
      updates.push(`ifsc = $${paramIndex++}`);
      params.push(ifsc?.trim() || '');
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      params.push(is_active !== false);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'At least one field must be provided for update' });
    }
    
    // Always update updated_at timestamp
    updates.push(`updated_at = NOW()`);
    params.push(id);
    
    const query = `
      UPDATE vendors 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, name, upi_id, bank_account, ifsc, is_active, created_at, updated_at
    `;
    
    const result = await pool.query(query, params);
    const row = result.rows[0];
    res.json({ data: toApiRow(row) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to update vendor' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    
    // Check if vendor exists
    const checkResult = await pool.query('SELECT id FROM vendors WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Vendor not found' });
    }
    
    // Check if vendor has associated payouts
    const payoutCheck = await pool.query('SELECT id FROM payouts WHERE vendor_id = $1 LIMIT 1', [id]);
    if (payoutCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Validation error', 
        message: 'Cannot delete vendor with associated payouts' 
      });
    }
    
    // Delete the vendor
    await pool.query('DELETE FROM vendors WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to delete vendor' });
  }
});

export default router;
