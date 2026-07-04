# CoinVault — Updated Coin Wallet System

## Summary of Changes

### New Files
| File | Purpose |
|------|---------|
| `backend/models/Marketplace.js` | Data layer for items, codes, purchases |
| `backend/controllers/marketplaceController.js` | User + admin marketplace logic |
| `frontend/marketplace.html` | User-facing marketplace page |
| `frontend/js/marketplace.js` | Marketplace browse, buy, my-codes JS |

### Modified Files
| File | What Changed |
|------|-------------|
| `database/wallet.sql` | Added `marketplace_items`, `digital_codes`, `purchases` tables |
| `backend/models/Transaction.js` | **Bug fix**: LIMIT/OFFSET cast to integers (fixes history pagination error) |
| `backend/models/User.js` | No changes |
| `backend/controllers/walletController.js` | Removed `addCoins` user endpoint |
| `backend/controllers/adminController.js` | No changes (already correct) |
| `backend/routes/wallet.js` | Removed `/wallet/add`; added marketplace user routes |
| `backend/routes/admin.js` | Added all marketplace admin routes |
| `frontend/wallet.html` | Removed "Add Credits" button; added Marketplace link |
| `frontend/js/wallet.js` | Removed all addCoins calls; added marketplace shortcuts |
| `frontend/admin.html` | Added Marketplace tab with full item/code management |
| `frontend/js/admin.js` | Added marketplace management: create, edit, delete, codes |

---

## Features Implemented

### Bug Fix — Transaction History Pagination
- Root cause: `mysql2` prepared statements can mishandle JS `Number` types for `LIMIT`/`OFFSET`
- Fix: `Transaction.findByUser()` and `Transaction.findAll()` now interpolate integer-cast values directly into the query string instead of passing as bind params

### Coins — Admin Only
- `POST /api/wallet/add` (user self-top-up) is permanently removed
- Only `POST /api/admin/addcoins` exists — requires a valid JWT with `role: admin`
- No UI button for users to add coins; an info banner explains coins come from admins

### Marketplace System
**User flow:** Browse items → Confirm purchase → Receive unique 12-char code → View in "My Codes"

**Code format:** Exactly 12 uppercase alphanumeric characters, **last 3 always `1AS`**
- Example: `A8XZ3QR2J1AS`
- Auto-generated: 9 random chars + `1AS`
- Custom codes validated server-side with regex `/^[A-Z0-9]{9}1AS$/`

**Admin flow (admin.html → Marketplace tab):**
- Create items (name, description, price in coins)
- Enable / disable items
- Delete items
- Generate N random codes per item
- Add a specific custom code
- View all codes (available / used / who used it)

**Purchase flow (atomic DB transaction):**
1. Verify wallet balance ≥ item price
2. Deduct coins (`WHERE coins >= ?` prevents negative balance races)
3. Claim one available code with `SELECT ... FOR UPDATE`
4. Mark code as used with timestamp and user ID
5. Log debit transaction
6. Record purchase row
7. Commit — or roll back entirely on any error

---

## Installation Steps

### 1. Database

**Option A — Existing MySQL:**
```bash
mysql -u root -p < database/wallet.sql
```

**Option B — Docker:**
```bash
docker compose up -d
# Wait ~10 seconds for healthy status
docker compose ps
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env — set DB credentials and a strong JWT_SECRET:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run seed:admin   # interactive: creates your first admin account
npm start
```

### 3. Frontend

Open `frontend/login.html` directly in a browser, or serve statically:
```bash
cd frontend
npx serve .
# then visit http://localhost:3000/login.html
```

Make sure `CORS_ORIGIN` in `.env` includes the origin you serve from.

---

## Required npm Packages (no new packages added)

All existing packages cover the new features:
- `express`, `mysql2`, `bcrypt`, `jsonwebtoken`, `dotenv`, `cors`, `express-rate-limit`

Run `npm install` in `backend/` — no new entries in `package.json`.

---

## API Reference (new endpoints)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/marketplace` | User | List active marketplace items |
| POST | `/api/marketplace/buy` | User | Purchase an item; returns digital code |
| GET | `/api/marketplace/my-purchases` | User | User's purchase history + codes |
| GET | `/api/admin/marketplace` | Admin | All items (incl. inactive) |
| POST | `/api/admin/marketplace` | Admin | Create item |
| PUT | `/api/admin/marketplace/:id` | Admin | Update item |
| DELETE | `/api/admin/marketplace/:id` | Admin | Delete item |
| POST | `/api/admin/marketplace/:id/codes/generate` | Admin | Auto-generate N codes |
| POST | `/api/admin/marketplace/:id/codes/custom` | Admin | Add a custom code |
| GET | `/api/admin/marketplace/:id/codes` | Admin | List all codes for item |

---

## Database Migration

If upgrading an existing `wallet_system` database (not a fresh install), run only the new tables:

```sql
USE wallet_system;

CREATE TABLE IF NOT EXISTS marketplace_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  price INT UNSIGNED NOT NULL,
  stock INT NOT NULL DEFAULT -1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS digital_codes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id INT UNSIGNED NOT NULL,
  code CHAR(12) NOT NULL UNIQUE,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  used_by INT UNSIGNED NULL,
  purchase_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
  FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_item_unused (item_id, is_used)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  code_id BIGINT UNSIGNED NOT NULL,
  coins_spent INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES marketplace_items(id) ON DELETE CASCADE,
  FOREIGN KEY (code_id) REFERENCES digital_codes(id) ON DELETE CASCADE,
  INDEX idx_user_purchases (user_id, created_at)
) ENGINE=InnoDB;
```

---

## Troubleshooting

- **History still fails** — confirm you imported the updated `database/wallet.sql` or ran the migration above
- **"Item is out of stock"** — generate codes for the item first in Admin → Marketplace → Manage Codes
- **Admin can't see Marketplace tab** — clear browser localStorage and log in again (JWT role must be `admin`)
- **CORS errors** — add your frontend origin to `CORS_ORIGIN` in `.env`
