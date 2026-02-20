import express from 'express';
import { pool, toApiRow, toApiRows } from '../db.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

async function addAudit(payoutId, action, user, metadata = {}) {
  await pool.query(
    `INSERT INTO payout_audits (payout_id, action, performed_by, performed_by_email, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [payoutId, action, user.id, user.email, JSON.stringify(metadata)]
  );
}

function payoutWithVendor(row) {
  if (!row) return null;
  const p = {
    _id: String(row.id),
    vendor_id: {
      _id: String(row.vendor_id),
      name: row.vendor_name,
      upi_id: row.vendor_upi_id,
      bank_account: row.vendor_bank_account,
      ifsc: row.vendor_ifsc,
    },
    amount: parseFloat(row.amount),
    mode: row.mode,
    note: row.note || '',
    status: row.status,
    decision_reason: row.decision_reason || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  return p;
}

function auditRow(a) {
  return {
    _id: String(a.id),
    action: a.action,
    performed_by_email: a.performed_by_email,
    createdAt: a.created_at,
    metadata: a.metadata || {},
  };
}

router.get('/', requireRole('OPS', 'FINANCE'), async (req, res) => {
  try {
    const { status, vendor_id } = req.query;
    let query = `
      SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
             v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
      FROM payouts p
      JOIN vendors v ON p.vendor_id = v.id
      WHERE 1=1
    `;
    const params = [];
    let n = 1;
    if (status) {
      query += ` AND p.status = $${n}`;
      params.push(status);
      n += 1;
    }
    if (vendor_id) {
      query += ` AND p.vendor_id = $${n}`;
      params.push(vendor_id);
      n += 1;
    }
    query += ` ORDER BY p.updated_at DESC`;
    const result = await pool.query(query, params);
    const data = result.rows.map(payoutWithVendor);
    res.json({ data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch payouts' });
  }
});

router.get('/:id', requireRole('OPS', 'FINANCE'), async (req, res) => {
  try {
    const id = req.params.id;
    const payoutResult = await pool.query(
      `SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
              v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
       FROM payouts p
       JOIN vendors v ON p.vendor_id = v.id
       WHERE p.id = $1`,
      [id]
    );
    const payout = payoutResult.rows[0];
    if (!payout) {
      return res.status(404).json({ error: 'Not found', message: 'Payout not found' });
    }
    const auditResult = await pool.query(
      'SELECT id, action, performed_by_email, created_at, metadata FROM payout_audits WHERE payout_id = $1 ORDER BY created_at ASC',
      [id]
    );
    const payload = payoutWithVendor(payout);
    payload.audit = auditResult.rows.map(auditRow);
    res.json({ data: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to fetch payout' });
  }
});

router.post('/', requireRole('OPS'), async (req, res) => {
  try {
    const { vendor_id, amount, mode, note } = req.body;
    if (!vendor_id) {
      return res.status(400).json({ error: 'Validation error', message: 'vendor_id is required' });
    }
    const numAmount = Number(amount);
    if (typeof numAmount !== 'number' || numAmount <= 0 || isNaN(numAmount)) {
      return res.status(400).json({ error: 'Validation error', message: 'amount must be greater than 0' });
    }
    if (!['UPI', 'IMPS', 'NEFT'].includes(mode)) {
      return res.status(400).json({ error: 'Validation error', message: 'mode must be UPI, IMPS, or NEFT' });
    }
    const vendorResult = await pool.query('SELECT id FROM vendors WHERE id = $1', [vendor_id]);
    if (vendorResult.rows.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'Vendor not found' });
    }
    const insertResult = await pool.query(
      `INSERT INTO payouts (vendor_id, amount, mode, note, status)
       VALUES ($1, $2, $3, $4, 'Draft')
       RETURNING id, vendor_id, amount, mode, note, status, decision_reason, created_at, updated_at`,
      [vendor_id, numAmount, mode, note?.trim() || '']
    );
    const payout = insertResult.rows[0];
    await addAudit(payout.id, 'CREATED', req.user);
    const fullResult = await pool.query(
      `SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
              v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
       FROM payouts p JOIN vendors v ON p.vendor_id = v.id WHERE p.id = $1`,
      [payout.id]
    );
    res.status(201).json({ data: payoutWithVendor(fullResult.rows[0]) });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Validation error', message: 'Vendor not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to create payout' });
  }
});

router.post('/:id/submit', requireRole('OPS'), async (req, res) => {
  try {
    const id = req.params.id;
    const getResult = await pool.query('SELECT id, status FROM payouts WHERE id = $1', [id]);
    const payout = getResult.rows[0];
    if (!payout) return res.status(404).json({ error: 'Not found', message: 'Payout not found' });
    if (payout.status !== 'Draft') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Only Draft payouts can be submitted',
      });
    }
    await pool.query("UPDATE payouts SET status = 'Submitted', updated_at = NOW() WHERE id = $1", [id]);
    await addAudit(id, 'SUBMITTED', req.user);
    const fullResult = await pool.query(
      `SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
              v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
       FROM payouts p JOIN vendors v ON p.vendor_id = v.id WHERE p.id = $1`,
      [id]
    );
    res.json({ data: payoutWithVendor(fullResult.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to submit payout' });
  }
});

router.post('/:id/approve', requireRole('FINANCE'), async (req, res) => {
  try {
    const id = req.params.id;
    const getResult = await pool.query('SELECT id, status FROM payouts WHERE id = $1', [id]);
    const payout = getResult.rows[0];
    if (!payout) return res.status(404).json({ error: 'Not found', message: 'Payout not found' });
    if (payout.status !== 'Submitted') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Only Submitted payouts can be approved',
      });
    }
    await pool.query("UPDATE payouts SET status = 'Approved', updated_at = NOW() WHERE id = $1", [id]);
    await addAudit(id, 'APPROVED', req.user);
    const fullResult = await pool.query(
      `SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
              v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
       FROM payouts p JOIN vendors v ON p.vendor_id = v.id WHERE p.id = $1`,
      [id]
    );
    res.json({ data: payoutWithVendor(fullResult.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to approve payout' });
  }
});

router.post('/:id/reject', requireRole('FINANCE'), async (req, res) => {
  try {
    const { decision_reason } = req.body;
    if (!decision_reason || typeof decision_reason !== 'string' || !decision_reason.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'decision_reason is required when rejecting',
      });
    }
    const id = req.params.id;
    const getResult = await pool.query('SELECT id, status FROM payouts WHERE id = $1', [id]);
    const payout = getResult.rows[0];
    if (!payout) return res.status(404).json({ error: 'Not found', message: 'Payout not found' });
    if (payout.status !== 'Submitted') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Only Submitted payouts can be rejected',
      });
    }
    const reason = decision_reason.trim();
    await pool.query(
      "UPDATE payouts SET status = 'Rejected', decision_reason = $1, updated_at = NOW() WHERE id = $2",
      [reason, id]
    );
    await addAudit(id, 'REJECTED', req.user, { decision_reason: reason });
    const fullResult = await pool.query(
      `SELECT p.id, p.vendor_id, p.amount, p.mode, p.note, p.status, p.decision_reason, p.created_at, p.updated_at,
              v.name AS vendor_name, v.upi_id AS vendor_upi_id, v.bank_account AS vendor_bank_account, v.ifsc AS vendor_ifsc
       FROM payouts p JOIN vendors v ON p.vendor_id = v.id WHERE p.id = $1`,
      [id]
    );
    res.json({ data: payoutWithVendor(fullResult.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error', message: 'Failed to reject payout' });
  }
});

export default router;
