## Smart Luggage Agent Backend (Express + MySQL)

### Local Development Setup (No Docker)

This backend connects directly to your local MySQL Workbench instance.

#### Prerequisites
- Node.js 18+
- MySQL Workbench running locally on port **3307**
- A database named `smartluggage` created in MySQL Workbench

#### Steps

1. **Install dependencies**

```bash
cd agent/backend
npm install
```

2. **Configure `.env`**

The `.env` file is pre-configured for local MySQL Workbench:
```
MYSQL_HOST=localhost
MYSQL_PORT=3307
MYSQL_USER=root
MYSQL_PASSWORD=Sereena@123
MYSQL_DATABASE=smartluggage
```
Update credentials if your MySQL setup differs.

3. **Create the database in MySQL Workbench**

Run this in MySQL Workbench if you haven't already:
```sql
CREATE DATABASE IF NOT EXISTS smartluggage;
```

4. **Run migrations** (creates tables)

```bash
npm run migrate
```

5. **Start the API**

```bash
npm run dev
```

The API will start on `http://localhost:4000` and confirm MySQL connectivity on startup.

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | — | Register agent (fullName, mobile, password) |
| POST | `/api/auth/login` | — | Login (mobile, password) → returns JWT |
| GET | `/api/me` | Bearer | Get basic user info |
| GET | `/api/kyc` | Bearer | Get KYC data + uploaded files |
| POST | `/api/kyc` | Bearer | Submit/update KYC form (multipart, all fields optional) |

### Notes
- All KYC fields are optional — partial saves are supported
- Files are stored in `uploads/` and served at `/uploads/<filename>`
- JWT tokens expire after 7 days
