# Payout Management Backend

A Node.js/Express backend API for managing vendor payouts with role-based access control (OPS and FINANCE roles).

## Quick Start (Under 5 Minutes)

### Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher) installed and running
- **npm** or **yarn** package manager

### Step 1: Clone and Install Dependencies (1 minute)
```bash
git clone https://github.com/rutvikpatel14/payout-management-backend.git
cd payout-management-backend
npm install
```

### Step 2: Set Up Environment Variables (1 minute)
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and update the DATABASE_URL with your PostgreSQL credentials
# Default: postgresql://postgres:1210@localhost:5432/mydb
```

### Step 3: Create Database (1 minute)
```bash
# Connect to PostgreSQL and create the database
psql -U postgres
CREATE DATABASE mydb;
\q
```

### Step 4: Seed Initial Data (1 minute)
```bash
npm run seed
```

This will create:
- **OPS User**: `ops@demo.com` / `ops123`
- **FINANCE User**: `finance@demo.com` / `fin123`
- Sample vendors (Vendor Alpha, Vendor Beta)

### Step 5: Start the Server (30 seconds)
```bash
npm start
```

The server will start on `http://localhost:4000` (or the PORT specified in `.env`).

**Total time: ~4.5 minutes**

---

## Environment Setup

### Required Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
PORT=4000
DATABASE_URL=postgresql://username:password@localhost:5432/database_name
JWT_SECRET=your-secret-key-change-in-production
```

### Environment Variable Details

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port number | `4000` | No |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:1210@localhost:5432/mydb` | Yes |
| `JWT_SECRET` | Secret key for JWT token signing | - | Yes |

### Database Connection String Format
```
postgresql://[username]:[password]@[host]:[port]/[database_name]
```

Example:
```
postgresql://postgres:mypassword@localhost:5432/payout_db
```

---

## Seed Data Instructions

### Running Seed Script

The seed script creates initial users and vendors for testing:

```bash
npm run seed
```

### Seeded Users

| Email | Password | Role |
|-------|----------|------|
| `ops@demo.com` | `ops123` | OPS |
| `finance@demo.com` | `fin123` | FINANCE |

### Seeded Vendors

- **Vendor Alpha**: UPI ID `alpha@upi`, Bank Account `1234567890`, IFSC `HDFC0001234`
- **Vendor Beta**: UPI ID `beta@paytm` (no bank details)

### Notes

- The seed script automatically creates database tables if they don't exist
- Users are upserted (updated if they already exist)
- Vendors are only inserted if the vendors table is empty
- Safe to run multiple times

---

## API Endpoints

### Authentication
- `POST /auth/login` - Login and get JWT token
- `POST /auth/register` - Register new user (if implemented)

### Vendors
- `GET /vendors` - List all vendors (requires authentication)
- `POST /vendors` - Create vendor (requires OPS role)
- `PUT /vendors/:id` - Update vendor (requires OPS role)
- `DELETE /vendors/:id` - Delete vendor (requires OPS role)

### Payouts
- `GET /payouts` - List payouts (requires authentication)
- `POST /payouts` - Create payout (requires OPS role)
- `PUT /payouts/:id` - Update payout (requires OPS role)
- `POST /payouts/:id/submit` - Submit payout for approval (requires OPS role)
- `POST /payouts/:id/approve` - Approve payout (requires FINANCE role)
- `POST /payouts/:id/reject` - Reject payout (requires FINANCE role)

---

## Development

### Run in Development Mode (with auto-reload)
```bash
npm run dev
```

### Project Structure
```
payout-management-backend/
├── src/
│   ├── index.js          # Main server file
│   ├── db.js             # Database connection and schema
│   ├── seed.js           # Seed script
│   ├── middleware/
│   │   └── auth.js       # Authentication middleware
│   └── routes/
│       ├── auth.js       # Authentication routes
│       ├── vendors.js    # Vendor routes
│       └── payouts.js    # Payout routes
├── .env.example          # Environment variables template
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

---

## Assumptions

1. **PostgreSQL is installed and running** on the local machine or accessible via the provided DATABASE_URL
2. **Database credentials** match those in the `.env` file
3. **Port 4000** (or specified PORT) is available for the server
4. **Node.js v18+** is installed (for ES modules support)
5. The database schema is created automatically on first run (via `runSchema()`)
6. JWT tokens are used for authentication (token expires based on implementation)
7. CORS is enabled for all origins (configured for development)

---

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready` or `psql -U postgres`
- Check DATABASE_URL format in `.env`
- Ensure database exists: `psql -U postgres -l`

### Port Already in Use
- Change PORT in `.env` to a different port
- Or stop the process using port 4000

### Module Not Found Errors
- Run `npm install` again
- Ensure Node.js version is v18 or higher

### Seed Script Fails
- Ensure database is created and accessible
- Check DATABASE_URL in `.env`
- Verify PostgreSQL user has CREATE TABLE permissions


