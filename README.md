# Ubaka Attendance Tracking System

A comprehensive desktop application for managing worker attendance at construction sites (chantiers) using fingerprint biometric verification.

## Project Structure

```
ubaka-payroll-mis/
├── backend/                    # Backend API (Node.js + Express + PostgreSQL)
│   ├── src/
│   │   ├── config/            # Database and app configuration
│   │   ├── controllers/       # API route controllers
│   │   ├── models/            # TypeScript type definitions
│   │   ├── repositories/      # Data access layer
│   │   ├── services/          # Business logic layer
│   │   ├── utils/             # Helper functions
│   │   └── server.ts          # Express server entry point
│   ├── database/              # SQL schemas and migrations
│   ├── config/                # Configuration files
│   ├── logs/                  # Application logs
│   └── package.json
│
├── frontend/                   # Frontend Desktop App (Electron + React)
│   ├── electron/              # Electron main process
│   │   ├── main.ts            # Electron entry point
│   │   └── preload.ts         # IPC bridge
│   ├── src/
│   │   ├── components/        # Reusable React components
│   │   ├── views/             # Page-level components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── services/          # API client services
│   │   ├── utils/             # Helper functions
│   │   ├── types/             # TypeScript interfaces
│   │   ├── styles/            # CSS files
│   │   ├── App.tsx            # Root component
│   │   ├── main.tsx           # React entry point
│   │   └── index.html         # HTML template
│   └── package.json
│
├── resources/                  # Static resources
│   ├── icons/                 # Application icons
│   ├── email-templates/       # Email HTML templates
│   └── sdk/                   # Fingerprint scanner SDK
│
├── data/                       # Runtime data (created at runtime)
│   ├── database/              # Database backups
│   ├── backups/               # System backups
│   └── logs/                  # Application logs
│
└── .kiro/                      # Project specifications
    └── specs/
        └── ubaka-attendance-tracking/
            ├── requirements.md
            ├── design.md
            └── tasks.md
```

## Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **PostgreSQL** - Relational database
- **TypeScript** - Type safety
- **node-pg** - PostgreSQL client
- **Nodemailer** - Email sending
- **node-cron** - Task scheduling

### Frontend
- **Electron** - Desktop framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Axios** - HTTP client
- **React Router** - Navigation

## Prerequisites

Before running the application, ensure you have the following installed:

- Node.js (v18 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn package manager

## Setup Instructions

### 0. VS Code Setup (Recommended)

To avoid TypeScript path confusion in VS Code:
```bash
# Open the workspace file
code ubaka-workspace.code-workspace
```

Or from VS Code: `File > Open Workspace from File > ubaka-workspace.code-workspace`

See [VSCODE_SETUP.md](./VSCODE_SETUP.md) for troubleshooting.

### 1. Clone the Repository

```bash
git clone https://github.com/Lydia-Numwali/ubaka-payroll-mis.git
cd ubaka-payroll-mis
```

### 2. Set Up PostgreSQL Database

```bash
# Create database
createdb ubaka_attendance

# Create database user (optional)
createuser ubaka_user

# Run schema
psql -d ubaka_attendance -f backend/database/schema.sql
```

### 3. Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your database credentials and configuration
```

**Frontend:**
```bash
cd frontend
# Frontend uses backend API, no additional env needed
```

### 4. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

## Running the Application

### Development Mode

**Start Backend Server:**
```bash
cd backend
npm run dev
```
Server will run on `http://localhost:5000`

**Start Frontend Desktop App:**
```bash
cd frontend
npm run dev
```

The Electron app will launch automatically.

### Production Build (Windows all-in-one installer)

See **[PACKAGING.md](PACKAGING.md)** for the full Windows NSIS installer that bundles
Electron, the API, portable PostgreSQL, and the fingerprint service.

```bash
# On a Windows build machine (Git Bash):
./scripts/package-windows.sh
# → frontend/release/UbakaSetup-1.0.0.exe
```

**Backend only (dev/server):**
```bash
cd backend
npm run build
npm start
```

**Frontend UI only:**
```bash
cd frontend
npm run build
```

## API Endpoints

### Health Check
- `GET /health` - Check server and database status

### Workers
- `POST /api/workers` - Register new worker
- `GET /api/workers` - Get all workers
- `GET /api/workers/:id` - Get worker by ID
- `PUT /api/workers/:id` - Update worker
- `DELETE /api/workers/:id` - Deactivate worker
- `GET /api/workers/search` - Search workers

### Attendance
- `POST /api/attendance/events` - Record attendance event
- `GET /api/attendance/events/:workerId/:date` - Get events for worker on date
- `GET /api/attendance/hours/:workerId/:date` - Calculate hours worked
- `GET /api/attendance/records` - Search attendance records
- `POST /api/attendance/export` - Export to CSV

### Anomalies
- `GET /api/anomalies/detect/:date` - Detect anomalies for date
- `GET /api/anomalies/unresolved` - Get unresolved anomalies
- `POST /api/anomalies/resolve/:id` - Resolve anomaly
- `POST /api/anomalies/manual-event` - Add manual event

### Reports
- `POST /api/reports/daily-summary` - Generate daily summary
- `POST /api/reports/analytics` - Generate analytics report
- `POST /api/reports/preview` - Preview report

### Configuration
- `GET /api/config/site` - Get site configuration
- `PUT /api/config/site` - Update site configuration
- `GET /api/config/owner-emails` - Get owner emails
- `POST /api/config/owner-emails` - Add owner email
- `DELETE /api/config/owner-emails/:email` - Remove owner email

## Features

### Phase 1 (Current)
- ✅ Project structure setup
- ✅ PostgreSQL database integration
- ✅ Backend API infrastructure
- ✅ Frontend desktop app scaffolding
- ⏳ Worker registration with fingerprint
- ⏳ Attendance event recording
- ⏳ Hours calculation
- ⏳ Anomaly detection
- ⏳ Email reporting system

### Future Phases
- Payment processing integration
- Multi-site support
- Advanced analytics
- Mobile applications
- Web dashboard for owners

## Development Workflow

1. **Backend changes**: Modify files in `backend/src/`, server auto-reloads
2. **Frontend changes**: Modify files in `frontend/src/`, hot reload enabled
3. **Database changes**: Create migration in `backend/database/`
4. **Testing**: Run `npm test` in respective directories

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check credentials in `backend/.env`
- Test connection: `psql -U postgres -d ubaka_attendance`

### Port Already in Use
- Backend: Change `PORT` in `backend/.env`
- Frontend: Change port in `frontend/vite.config.ts`

### Build Errors
- Clear node_modules: `rm -rf node_modules package-lock.json && npm install`
- Clear build cache: `rm -rf dist`

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

ISC

## Support

For issues and questions, please create an issue in the GitHub repository.

---

**Ubaka Team** - Building the future of workforce management
