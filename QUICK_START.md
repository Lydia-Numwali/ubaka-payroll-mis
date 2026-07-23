# Ubaka Attendance Tracking - Quick Start Guide

Get up and running in 5 minutes!

## 1️⃣ Prerequisites Check

Make sure you have these installed:
```bash
node --version    # Should be v18+
npm --version     # Should be v9+
psql --version    # Should be PostgreSQL 12+
```

If missing, install:
- **Node.js**: https://nodejs.org/
- **PostgreSQL**: https://www.postgresql.org/download/

## 2️⃣ Database Setup (One-time)

```bash
# Create database
createdb ubaka_attendance

# Apply schema
psql -d ubaka_attendance -f backend/database/schema.sql
```

## 3️⃣ Install Dependencies

```bash
# Backend
cd backend
npm install
cd ..

# Frontend  
cd frontend
npm install
cd ..
```

## 4️⃣ Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` if needed (default settings work for local PostgreSQL):
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ubaka_attendance
DB_USER=postgres
DB_PASSWORD=postgres
```

## 5️⃣ Start Development

### Option A: Automatic (Recommended)
```bash
./start-dev.sh
```

### Option B: Manual
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## ✅ Verify Installation

1. **Backend API**: Open http://localhost:5000/health
   - Should see: `{"status":"ok","database":"connected"}`

2. **API Endpoints**: Open http://localhost:5000/api
   - Should see: API information

3. **Frontend**: Electron window should open automatically

## 🧪 Test the API

### Create a test worker:
```bash
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "nid": "1234567890",
    "worker_number": "W001",
    "classification": "Mason",
    "full_name": "Test Worker",
    "phone_number": "+250788123456",
    "hourly_rate": 2000,
    "fingerprint_data": "dGVzdF9maW5nZXJwcmludA=="
  }'
```

### Get all workers:
```bash
curl http://localhost:5000/api/workers
```

## 🔧 Troubleshooting

### Database connection failed
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql   # Linux
brew services list                  # macOS

# Start PostgreSQL
sudo systemctl start postgresql     # Linux
brew services start postgresql@14   # macOS
```

### Port already in use
```bash
# Check what's using port 5000
lsof -i :5000

# Kill the process
kill -9 <PID>
```

### Frontend won't start
```bash
# Clear cache and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 📚 Next Steps

- Read [README.md](./README.md) for full documentation
- Check [PROJECT_STATUS.md](./PROJECT_STATUS.md) for current progress
- Review specs in `.kiro/specs/ubaka-attendance-tracking/`

## 🎯 What Works Now

✅ Backend API server
✅ PostgreSQL database with all tables
✅ Worker registration API
✅ Worker management endpoints
✅ Health check and monitoring

## 🚧 Coming Soon

⏳ Worker registration UI
⏳ Fingerprint scanner integration
⏳ Attendance tracking
⏳ Email reporting
⏳ Analytics dashboard

---

**Questions?** Check the README or create an issue!
