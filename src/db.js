import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:1210@localhost:5432/mydb';

export const pool = new Pool({
  connectionString,
});

export async function connectDB() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('PostgreSQL connected');
  } finally {
    client.release();
  }
}

/** Create tables if they do not exist. Safe to run on every startup. */
export async function runSchema() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('OPS', 'FINANCE')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        upi_id VARCHAR(255) DEFAULT '',
        bank_account VARCHAR(255) DEFAULT '',
        ifsc VARCHAR(100) DEFAULT '',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payouts (
        id SERIAL PRIMARY KEY,
        vendor_id INTEGER NOT NULL REFERENCES vendors(id),
        amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
        mode VARCHAR(20) NOT NULL CHECK (mode IN ('UPI', 'IMPS', 'NEFT')),
        note VARCHAR(500) DEFAULT '',
        status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Submitted', 'Approved', 'Rejected')),
        decision_reason VARCHAR(500) DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS payout_audits (
        id SERIAL PRIMARY KEY,
        payout_id INTEGER NOT NULL REFERENCES payouts(id),
        action VARCHAR(20) NOT NULL CHECK (action IN ('CREATED', 'SUBMITTED', 'APPROVED', 'REJECTED')),
        performed_by INTEGER NOT NULL REFERENCES users(id),
        performed_by_email VARCHAR(255) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}

/** Map DB row to API shape (id -> _id, snake_case -> camelCase for frontend) */
export function toApiRow(row) {
  if (!row) return null;
  const { id, created_at, updated_at, ...rest } = row;
  const out = { _id: String(id), ...rest };
  if (created_at !== undefined) out.createdAt = created_at;
  if (updated_at !== undefined) out.updatedAt = updated_at;
  return out;
}

export function toApiRows(rows) {
  return rows.map(toApiRow);
}
