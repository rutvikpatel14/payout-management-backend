import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { connectDB, runSchema } from './db.js';
import authRoutes from './routes/auth.js';
import vendorRoutes from './routes/vendors.js';
import payoutRoutes from './routes/payouts.js';

await connectDB();
await runSchema();

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.use('/auth', authRoutes);
app.use('/vendors', vendorRoutes);
app.use('/payouts', payoutRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error', message: 'Something went wrong' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
