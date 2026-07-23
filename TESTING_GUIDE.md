# Testing Guide - Ubaka Attendance Tracking System

This guide will help you test all the features implemented in the application.

## Prerequisites

1. **Database Setup**
   ```bash
   # Make sure PostgreSQL is running
   sudo systemctl status postgresql  # Linux
   brew services list | grep postgresql  # macOS
   
   # Create database if not already created
   createdb ubaka_attendance
   
   # Run schema
   psql -d ubaka_attendance -f backend/database/schema.sql
   ```

2. **Environment Configuration**
   ```bash
   # Backend - verify .env file exists
   cd backend
   cat .env
   
   # Should contain:
   # DB_HOST=localhost
   # DB_PORT=5432
   # DB_NAME=ubaka_attendance
   # DB_USER=your_username
   # DB_PASSWORD=your_password
   # PORT=5000
   ```

3. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

## Starting the Application

### Option 1: Automated Start (Recommended)
```bash
# From root directory
./start-dev.sh
```

### Option 2: Manual Start
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### Option 3: Test Backend API Only
```bash
cd backend
npm run dev
# Backend will run on http://localhost:5000
```

---

## Testing Backend API

### 1. Health Check
```bash
curl http://localhost:5000/health
# Expected: {"status":"ok","timestamp":"..."}
```

### 2. Worker Registration

#### Register First Worker
```bash
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "workerNumber": "W001",
    "fullName": "Jean Mugabo",
    "nid": "1199780012345671",
    "fingerprintId": "FP001",
    "classification": "MASON",
    "phoneNumber": "0788123456",
    "hourlyRate": 2500
  }'
```

#### Register More Workers
```bash
# Worker 2
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "workerNumber": "W002",
    "fullName": "Marie Uwase",
    "nid": "1199880023456782",
    "fingerprintId": "FP002",
    "classification": "CARPENTER",
    "phoneNumber": "0788234567",
    "hourlyRate": 2800
  }'

# Worker 3
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "workerNumber": "W003",
    "fullName": "Paul Niyonzima",
    "nid": "1199770034567893",
    "fingerprintId": "FP003",
    "classification": "LABORER",
    "phoneNumber": "0788345678",
    "hourlyRate": 2000
  }'
```

#### Test Duplicate Detection
```bash
# Try to register with same NID (should fail)
curl -X POST http://localhost:5000/api/workers \
  -H "Content-Type: application/json" \
  -d '{
    "workerNumber": "W004",
    "fullName": "Another Person",
    "nid": "1199780012345671",
    "fingerprintId": "FP004",
    "classification": "MASON",
    "hourlyRate": 2500
  }'
# Expected: Error about duplicate NID
```

### 3. Get All Workers
```bash
curl http://localhost:5000/api/workers
# Expected: Array of all active workers
```

### 4. Search Workers
```bash
# Search by name
curl "http://localhost:5000/api/workers/search?q=Jean"

# Search by worker number
curl "http://localhost:5000/api/workers/search?q=W001"

# Search by NID
curl "http://localhost:5000/api/workers/search?q=1199780012345671"
```

### 5. Get Worker by ID
```bash
# Replace {id} with actual worker ID from previous response
curl http://localhost:5000/api/workers/1
```

### 6. Attendance Recording

#### Record Entry Event
```bash
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "ENTRY",
    "isManualEntry": false
  }'
```

#### Check Next Valid Event
```bash
curl http://localhost:5000/api/attendance/next-event/1
# Expected: nextEventTypes should be ["EXIT", "LEAVE_SITE"]
```

#### Record Leave Site Event
```bash
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "LEAVE_SITE",
    "isManualEntry": false
  }'
```

#### Record Return to Site Event
```bash
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "RETURN_TO_SITE",
    "isManualEntry": false
  }'
```

#### Record Exit Event
```bash
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "EXIT",
    "isManualEntry": false
  }'
```

### 7. Calculate Hours Worked
```bash
# Get today's date in YYYY-MM-DD format
TODAY=$(date +%Y-%m-%d)

curl "http://localhost:5000/api/attendance/hours/1/$TODAY"
# Expected: Hours worked calculation with entry/exit times
```

### 8. Get Daily Summary
```bash
curl http://localhost:5000/api/attendance/summary
# Expected: Array of all workers who recorded attendance today
```

### 9. Get Worker History
```bash
# Last 30 days
curl http://localhost:5000/api/attendance/history/1

# Last 7 days
curl "http://localhost:5000/api/attendance/history/1?days=7"
```

---

## Testing Frontend Application

### 1. Dashboard View

**URL**: http://localhost:5173/ (or the port Vite assigns)

**What to Test**:
- ✅ Dashboard loads without errors
- ✅ Today's date is displayed correctly
- ✅ Stats cards show correct numbers:
  - Workers Present
  - Completed Shifts
  - Active Now
- ✅ Attendance table shows all workers who recorded events today
- ✅ Status badges show "Active" or "Completed" correctly
- ✅ Entry/Exit times are formatted properly

**Expected Behavior**:
- If no attendance records exist, should show "No attendance records for today yet"
- Clicking "Retry" button should reload data
- Hovering over stat cards should have subtle animation

### 2. Workers List View

**URL**: http://localhost:5173/workers

**What to Test**:
- ✅ Click "Workers" in navigation menu
- ✅ All registered workers are displayed in table
- ✅ Worker count is shown correctly
- ✅ Search functionality:
  - Type "Jean" - should filter results
  - Type "W001" - should find by worker number
  - Type partial NID - should find worker
  - Click "Clear" - should show all workers again
- ✅ Action buttons:
  - View button (👁️) - click to see it works
  - Edit button (✏️) - click to see it works
  - Deactivate button (🗑️) - should show confirmation dialog
  
**Testing Deactivation**:
1. Click deactivate button on a worker
2. Confirm the action
3. Worker should disappear from list
4. Refresh page - worker should still be gone
5. Can verify in database: `SELECT * FROM worker WHERE is_active = false;`

### 3. Attendance Recording View

**URL**: http://localhost:5173/attendance

**What to Test**:

#### A. Worker Selection via Search
1. Click "Attendance" in navigation
2. Type a worker name in search box
3. Should see dropdown with matching workers (max 5)
4. Click on a worker
5. Worker card should appear with their details
6. Search box should clear

#### B. Fingerprint Scan Simulation
1. Click "Scan Fingerprint" button
2. Should generate random fingerprint ID
3. Should show "Fingerprint not recognized" message
4. (In production, this would connect to actual scanner)

#### C. Recording Events
1. Select a worker (via search)
2. Should see "Available Actions" showing valid event types
3. Event buttons should be enabled/disabled based on worker state

**Test Full Workflow**:
```
1. Select worker "Jean Mugabo"
2. Initially: Only ENTRY button should be enabled
3. Click ENTRY button
4. Success message should appear
5. Recent events should show the ENTRY event
6. Available actions should now show: EXIT, LEAVE_SITE
7. Click LEAVE_SITE
8. Available actions should now show: RETURN_TO_SITE
9. Click RETURN_TO_SITE
10. Available actions should now show: EXIT, LEAVE_SITE
11. Click EXIT
12. Success message appears
13. Worker selection clears after 2 seconds
```

#### D. Visual Feedback
- ✅ Event buttons have different colors:
  - ENTRY: Green (🟢)
  - EXIT: Red (🔴)
  - LEAVE_SITE: Yellow (🟡)
  - RETURN_TO_SITE: Blue (🔵)
- ✅ Disabled buttons are dimmed
- ✅ Hover effects work on enabled buttons
- ✅ Success messages auto-dismiss after worker clears
- ✅ Recent events update in real-time

### 4. Navigation Testing

**What to Test**:
- ✅ Click "Dashboard" - should navigate to dashboard
- ✅ Click "Workers" - should navigate to workers list
- ✅ Click "Attendance" - should navigate to attendance recording
- ✅ Navigation preserves state when returning
- ✅ Browser back/forward buttons work correctly

### 5. Responsive Design Testing

**What to Test**:
- ✅ Resize browser window to mobile size (< 968px)
- ✅ Attendance recording view switches to single column
- ✅ Tables should scroll horizontally on small screens
- ✅ Navigation menu should still be usable
- ✅ All buttons remain clickable

---

## Common Issues and Solutions

### Backend Won't Start

**Issue**: `Error: connect ECONNREFUSED`
**Solution**: PostgreSQL is not running
```bash
sudo systemctl start postgresql  # Linux
brew services start postgresql@14  # macOS
```

**Issue**: `database "ubaka_attendance" does not exist`
**Solution**: Create the database
```bash
createdb ubaka_attendance
psql -d ubaka_attendance -f backend/database/schema.sql
```

**Issue**: `role "your_username" does not exist`
**Solution**: Update .env with correct PostgreSQL username

### Frontend Won't Start

**Issue**: `Cannot find module 'react-router-dom'`
**Solution**: Install dependencies
```bash
cd frontend
npm install
```

**Issue**: Port already in use
**Solution**: Kill the process or use different port
```bash
# Find and kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### API Calls Fail

**Issue**: `Network Error` in browser console
**Solution**: Verify backend is running on port 5000
```bash
curl http://localhost:5000/health
```

**Issue**: CORS errors
**Solution**: Backend already has CORS enabled. Clear browser cache.

### Electron App Issues

**Issue**: Window doesn't open
**Solution**: Check Electron logs
```bash
cd frontend
npm run dev
# Check terminal output for errors
```

---

## Test Data Scenarios

### Scenario 1: Normal Work Day
```bash
# Worker arrives at 7:00 AM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "ENTRY",
    "timestamp": "2026-07-21T07:00:00Z"
  }'

# Worker exits at 5:00 PM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": 1,
    "eventType": "EXIT",
    "timestamp": "2026-07-21T17:00:00Z"
  }'

# Calculate hours (should be 10 hours)
curl "http://localhost:5000/api/attendance/hours/1/2026-07-21"
```

### Scenario 2: Work Day with Lunch Break
```bash
# Entry at 7:00 AM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{"workerId": 2, "eventType": "ENTRY", "timestamp": "2026-07-21T07:00:00Z"}'

# Leave for lunch at 12:00 PM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{"workerId": 2, "eventType": "LEAVE_SITE", "timestamp": "2026-07-21T12:00:00Z"}'

# Return from lunch at 1:00 PM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{"workerId": 2, "eventType": "RETURN_TO_SITE", "timestamp": "2026-07-21T13:00:00Z"}'

# Exit at 5:00 PM
curl -X POST http://localhost:5000/api/attendance/events \
  -H "Content-Type: application/json" \
  -d '{"workerId": 2, "eventType": "EXIT", "timestamp": "2026-07-21T17:00:00Z"}'

# Calculate hours (should be 9 hours - 1 hour lunch break)
curl "http://localhost:5000/api/attendance/hours/2/2026-07-21"
```

---

## Performance Testing

### Load Testing Workers API
```bash
# Register 50 workers
for i in {4..53}; do
  curl -X POST http://localhost:5000/api/workers \
    -H "Content-Type: application/json" \
    -d "{
      \"workerNumber\": \"W$(printf '%03d' $i)\",
      \"fullName\": \"Worker $i\",
      \"nid\": \"119978001234$(printf '%04d' $i)\",
      \"fingerprintId\": \"FP$(printf '%03d' $i)\",
      \"classification\": \"LABORER\",
      \"hourlyRate\": 2000
    }"
done
```

### Load Testing Attendance API
```bash
# Record events for multiple workers
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/attendance/events \
    -H "Content-Type: application/json" \
    -d "{\"workerId\": $i, \"eventType\": \"ENTRY\"}"
done
```

---

## Success Criteria

✅ **Backend API**
- All endpoints return 200/201 status codes
- Error handling returns appropriate error messages
- Database queries execute without errors
- Validation works correctly

✅ **Frontend Application**
- All views load without console errors
- Navigation works smoothly
- Forms submit successfully
- Data displays correctly
- Loading states show appropriately
- Error messages appear when needed

✅ **Integration**
- Frontend successfully calls backend APIs
- Data flows correctly from backend to frontend
- State management works as expected
- Real-time updates work correctly

---

## Next Steps After Testing

1. **Report Bugs**: Document any issues found during testing
2. **Worker Registration Form**: Implement the missing registration UI
3. **Worker Edit/Details**: Add edit and detail views
4. **Fingerprint Integration**: Replace mock with real SDK
5. **Email System**: Configure email notifications
6. **Anomaly Detection**: Implement detection algorithms
7. **Production Build**: Create production builds for deployment

---

**Happy Testing! 🚀**

For issues or questions, refer to README.md or PROJECT_STATUS.md
