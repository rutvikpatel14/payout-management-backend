import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, runSchema } from './db.js';

const users = [
  { email: 'ops@demo.com', password: 'ops123', role: 'OPS' },
  { email: 'finance@demo.com', password: 'fin123', role: 'FINANCE' },
];

async function seed() {
  await runSchema();
  const hashed = await Promise.all(
    users.map(async (u) => ({
      ...u,
      password: await bcrypt.hash(u.password, 10),
    }))
  );
  for (const u of hashed) {
    await pool.query(
      `INSERT INTO users (email, password, role) VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role, updated_at = NOW()`,
      [u.email.toLowerCase(), u.password, u.role]
    );
  }
  console.log('Seeded users: ops@demo.com / ops123 (OPS), finance@demo.com / fin123 (FINANCE)');

  const vendorCount = await pool.query('SELECT COUNT(*) FROM vendors');
  if (Number(vendorCount.rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO vendors (name, upi_id, bank_account, ifsc, is_active) VALUES
       ('Vendor Alpha', 'alpha@upi', '1234567890', 'HDFC0001234', true),
       ('Vendor Beta', 'beta@paytm', '', '', true)`
    );
    console.log('Seeded sample vendors.');
  }

  console.log('Seed done.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
