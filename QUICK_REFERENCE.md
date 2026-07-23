# Quick Reference - Ubaka Attendance Tracking

## 🚀 Start Application

```bash
# Automated Start (Recommended)
./start-dev.sh

# Manual Start
cd backend && npm run dev     # Terminal 1
cd frontend && npm run dev    # Terminal 2
```

## 🔗 URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/health

## 📦 Database Commands

```bash
# Create database
createdb ubaka_attendance

# Run schema
psql -d ubaka_attendance -f backend/database/schema.sql

# Connect to database
psql -d ubaka_attendance

# Useful queries
psql -d ubaka_attendance -c "SELECT * FROM worker;"
psql -d ubaka_attendance -c "SELECT * FROM attendance_event ORDER BY timestamp DESC LIMIT 10;"
```

## 🧪 Quick Test Commands

```bash
# Register a worker
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "workerNumber": "W001",
    "fullName": "Test Worker",
    "nid": "1199780012345671",
    "fingerprintId": "FP001",
    "classification": "MASON",
    "hourlyRate": 2500
  }'

# Get all workers
curl http://localhost:5000/api/workers

# Record attendance
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{"workerId": 1, "eventType": "ENTRY"}'

# Check daily summary
curl http://localhost:5000/api/attendance/summary
```

## 📋 API Endpoints

### Workers
- `POST /api/workers` - Register worker
- `GET /api/workers` - List all workers
- `GET /api/workers/search?q={term}` - Search workers
- `GET /api/workers/:id` - Get worker details
- `PUT /api/workers/:id` - Update worker
- `DELETE /api/workers/:id` - Deactivate worker

### Attendance
- `POST /api/attendance/events` - Record event
- `GET /api/attendance/events/:workerId/:date` - Get events
- `GET /api/attendance/next-event/:workerId` - Get valid events
- `GET /api/attendance/hours/:workerId/:date` - Calculate hours
- `GET /api/attendance/history/:workerId?days={n}` - Get history
- `GET /api/attendance/summary?date={date}` - Daily summary
- `GET /api/attendance/search` - Search records

## 🛠️ Common Tasks

### Stop All Services
```bash
# Find processes
lsof -ti:5000  # Backend
lsof -ti:5173  # Frontend

# Kill processes
lsof -ti:5000 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Check Logs
```bash
# Backend logs
tail -f backend/logs/app.log
tail -f backend/logs/error.log

# Frontend (in terminal output)
cd frontend && npm run dev
```

### Reset Database
```bash
# Drop and recreate
dropdb ubaka_attendance
createdb ubaka_attendance
psql -d ubaka_attendance -f backend/database/schema.sql
```

### Install Dependencies
```bash
# Backend
cd backend && npm install

# Frontend  
cd frontend && npm install

# Both
npm install --prefix backend && npm install --prefix frontend
```

### Lint and Format
```bash
# Backend
cd backend
npm run lint

# Frontend
cd frontend
npm run lint
```

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check PostgreSQL
sudo systemctl status postgresql   # Linux
brew services list                 # macOS

# Start PostgreSQL
sudo systemctl start postgresql    # Linux
brew services start postgresql@14  # macOS

# Check database exists
psql -l | grep ubaka_attendance
```

### Frontend won't start
```bash
# Clear node_modules
rm -rf frontend/node_modules
cd frontend && npm install

# Clear Vite cache
rm -rf frontend/node_modules/.vite
```

### CORS errors
```bash
# Verify backend is running
curl http://localhost:5000/health

# Check frontend API config
cat frontend/src/services/api.ts | grep baseURL
```

## 📊 Event Types

- `ENTRY` - Worker arrives at site
- `EXIT` - Worker leaves at end of day
- `LEAVE_SITE` - Worker leaves during day (break/errand)
- `RETURN_TO_SITE` - Worker returns from break

## 🎯 Valid Event Sequences

```
START → ENTRY → {EXIT | LEAVE_SITE}
ENTRY → EXIT → [END]
ENTRY → LEAVE_SITE → RETURN_TO_SITE → {EXIT | LEAVE_SITE}
```

## 📁 Key Files

```
backend/
  src/
    server.ts              # Entry point
    config/database.ts     # DB connection
    repositories/          # Data access
    services/             # Business logic
    controllers/          # HTTP handlers
    routes/               # API routes
  database/schema.sql     # Database schema
  .env                    # Configuration

frontend/
  src/
    App.tsx               # Main app
    views/                # Page components
    services/             # API clients
    styles/index.css      # All styles
  electron/
    main.ts               # Electron main
```

## 🔐 Environment Variables

### Backend (.env)
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ubaka_attendance
DB_USER=your_user
DB_PASSWORD=your_password
PORT=5000
NODE_ENV=development
```

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:5000
```

## 📚 Documentation Files

- `README.md` - Project overview
- `QUICK_START.md` - Setup guide
- `PROJECT_STATUS.md` - Current progress
- `TESTING_GUIDE.md` - How to test
- `SESSION_SUMMARY.md` - Latest changes
- `VSCODE_SETUP.md` - VS Code config

## 💻 VS Code

```bash
# Open workspace
code ubaka-workspace.code-workspace

# Open in separate windows
code backend/
code frontend/
```

## 🎨 UI Views

1. **Dashboard** (`/`) - Today's attendance summary
2. **Workers** (`/workers`) - Worker list and search
3. **Attendance** (`/attendance`) - Record attendance events

## ⚡ Development Workflow

```bash
# 1. Start services
./start-dev.sh

# 2. Open browser
open http://localhost:5173

# 3. Make changes
# - Edit files in src/
# - Hot reload happens automatically

# 4. Test changes
# - Use UI or curl commands
# - Check browser console
# - Check terminal output

# 5. Commit changes
git add .
git commit -m "Description"
```

## 🆘 Help

- **Full documentation**: See `README.md`
- **Setup issues**: See `QUICK_START.md`
- **Testing**: See `TESTING_GUIDE.md`
- **VS Code**: See `VSCODE_SETUP.md`
- **Architecture**: See `.kiro/specs/design.md`

---

**Need more help?** Check the documentation files or review the code comments.
