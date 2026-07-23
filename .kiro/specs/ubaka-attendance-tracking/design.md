# Design Document

## Introduction

This document presents the technical design for the Ubaka Attendance Tracking System, a desktop application for managing worker attendance at construction sites (chantiers) using fingerprint biometric verification. The design addresses all requirements specified in the requirements document and provides a blueprint for implementation.

## System Overview

The Ubaka Attendance Tracking System is a desktop application built with offline-first architecture to support construction site environments with limited connectivity. The system integrates with fingerprint scanner hardware for biometric authentication and includes an automated email reporting system for Owner notifications.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Desktop Application                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  UI Layer    │  │ Business     │  │  Data Access │      │
│  │  (Electron/  │→ │  Logic       │→ │  Layer       │      │
│  │   WPF/Qt)    │  │  Layer       │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Fingerprint │  │  Scheduling  │  │  Local       │      │
│  │  Scanner SDK │  │  Service     │  │  Database    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                           ↓                                  │
│                   ┌──────────────┐                          │
│                   │  Email       │                          │
│                   │  Service     │                          │
│                   └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Desktop Framework

**Recommended Option: Electron + React**
- **Electron**: Cross-platform desktop framework (Windows, macOS, Linux)
- **React**: UI framework for building responsive interfaces
- **TypeScript**: Type-safe development
- **Rationale**: Modern stack, good hardware integration support, active community, cross-platform compatibility

**Alternative Options**:
- **WPF (Windows Presentation Foundation)**: Windows-only, native .NET integration
- **Qt**: C++-based, highly performant, excellent hardware support
- **Tauri**: Lightweight alternative to Electron with Rust backend

### Database
**PostgreSQL**
- Powerful open-source relational database
- ACID-compliant transactions
- Excellent data integrity and reliability
- Support for advanced features (JSON, full-text search)
- Rationale: Scalable, robust, industry-standard for production applications
- **Connection**: pg (node-postgres) library for Node.js
- **Offline Strategy**: Local PostgreSQL instance on desktop, connection pooling

### Fingerprint Scanner Integration
**SDK Options**:
- **Digital Persona SDK**: Industry-standard fingerprint SDK
- **ZKTeco SDK**: Common in attendance systems
- **Neurotechnology MegaMatcher SDK**: High-accuracy matching
- **Rationale**: Choose based on actual hardware model at deployment

### Email Service
**Nodemailer** (for Node.js/Electron)

- SMTP-based email sending
- Support for queued email delivery
- HTML email formatting support

### Task Scheduling
**node-cron** or **node-schedule**
- Scheduled report generation
- Automated backup creation
- Anomaly detection runs

### Charting Library
**Chart.js** or **Recharts**
- For generating analytics charts in email reports
- Export charts as images for email embedding

## Data Model

### Entity Relationship Diagram

```
┌──────────────────┐
│     Worker       │
├──────────────────┤
│ id (PK)          │
│ nid              │──┐
│ worker_number    │  │
│ classification   │  │
│ full_name        │  │
│ phone_number     │  │
│ email_address    │  │
│ hourly_rate      │  │
│ fingerprint_data │  │
│ is_active        │  │
│ created_at       │  │
│ updated_at       │  │
└──────────────────┘  │
                      │
                      │
                      ↓
┌──────────────────────────────┐
│    AttendanceEvent           │
├──────────────────────────────┤
│ id (PK)                      │
│ worker_id (FK)               │
│ event_type                   │
│ timestamp                    │
│ is_manual_entry              │
│ created_by                   │
│ created_at                   │
└──────────────────────────────┘
          │
          │
          ↓
┌──────────────────────────────┐
│    AttendanceAnomaly         │
├──────────────────────────────┤
│ id (PK)                      │
│ worker_id (FK)               │
│ anomaly_type                 │
│ detection_date               │
│ description                  │
│ is_resolved                  │
│ resolved_at                  │
│ resolved_by                  │
│ created_at                   │
└──────────────────────────────┘

┌──────────────────────────────┐
│    SiteConfiguration         │
├──────────────────────────────┤
│ id (PK)                      │
│ site_name                    │
│ site_location                │
│ opening_time                 │
│ closing_time                 │
│ created_at                   │
│ updated_at                   │
└──────────────────────────────┘

┌──────────────────────────────┐
│    OwnerEmail                │
├──────────────────────────────┤
│ id (PK)                      │
│ email_address                │
│ is_active                    │
│ created_at                   │
└──────────────────────────────┘


┌──────────────────────────────┐
│    EmailQueue                │
├──────────────────────────────┤
│ id (PK)                      │
│ recipient_email              │
│ subject                      │
│ html_body                    │
│ email_type                   │
│ scheduled_at                 │
│ sent_at                      │
│ status                       │
│ error_message                │
│ retry_count                  │
│ created_at                   │
└──────────────────────────────┘

┌──────────────────────────────┐
│    SystemBackup              │
├──────────────────────────────┤
│ id (PK)                      │
│ backup_file_path             │
│ backup_size_bytes            │
│ created_at                   │
└──────────────────────────────┘
```

### Database Schema

#### Worker Table
```sql
CREATE TABLE worker (
    id SERIAL PRIMARY KEY,
    nid VARCHAR(50) NOT NULL UNIQUE,
    worker_number VARCHAR(50) NOT NULL UNIQUE,
    classification VARCHAR(100) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    email_address VARCHAR(255),
    hourly_rate DECIMAL(10, 2) NOT NULL,
    fingerprint_data BYTEA NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_worker_nid ON worker(nid);
CREATE UNIQUE INDEX idx_worker_number ON worker(worker_number);
CREATE INDEX idx_worker_classification ON worker(classification);
CREATE INDEX idx_worker_active ON worker(is_active);
```


#### AttendanceEvent Table
```sql
CREATE TYPE event_type_enum AS ENUM ('ENTRY', 'EXIT', 'LEAVE_SITE', 'RETURN_TO_SITE');

CREATE TABLE attendance_event (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    event_type event_type_enum NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    is_manual_entry BOOLEAN DEFAULT FALSE,
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE
);

CREATE INDEX idx_attendance_worker ON attendance_event(worker_id);
CREATE INDEX idx_attendance_timestamp ON attendance_event(timestamp);
CREATE INDEX idx_attendance_worker_date ON attendance_event(worker_id, DATE(timestamp));
```

#### AttendanceAnomaly Table
```sql
CREATE TYPE anomaly_type_enum AS ENUM ('MISSING_EXIT', 'MISSING_RETURN', 'EXCESSIVE_BREAK', 'DUPLICATE_ENTRY');

CREATE TABLE attendance_anomaly (
    id SERIAL PRIMARY KEY,
    worker_id INTEGER NOT NULL,
    anomaly_type anomaly_type_enum NOT NULL,
    detection_date DATE NOT NULL,
    description TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP,
    resolved_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (worker_id) REFERENCES worker(id) ON DELETE CASCADE
);

CREATE INDEX idx_anomaly_worker ON attendance_anomaly(worker_id);
CREATE INDEX idx_anomaly_date ON attendance_anomaly(detection_date);
CREATE INDEX idx_anomaly_resolved ON attendance_anomaly(is_resolved);
```


#### SiteConfiguration Table
```sql
CREATE TABLE site_configuration (
    id SERIAL PRIMARY KEY CHECK(id = 1),
    site_name VARCHAR(255) NOT NULL,
    site_location TEXT,
    opening_time TIME NOT NULL,
    closing_time TIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### OwnerEmail Table
```sql
CREATE TABLE owner_email (
    id SERIAL PRIMARY KEY,
    email_address VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_owner_email ON owner_email(email_address);
```

#### EmailQueue Table
```sql
CREATE TYPE email_type_enum AS ENUM ('DAILY_SUMMARY', 'ANALYTICS', 'EXCEPTION_ALERT');
CREATE TYPE email_status_enum AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE email_queue (
    id SERIAL PRIMARY KEY,
    recipient_email VARCHAR(255) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    html_body TEXT NOT NULL,
    email_type email_type_enum NOT NULL,
    scheduled_at TIMESTAMP NOT NULL,
    sent_at TIMESTAMP,
    status email_status_enum DEFAULT 'PENDING',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_scheduled ON email_queue(scheduled_at);
```


#### SystemBackup Table
```sql
CREATE TABLE system_backup (
    id SERIAL PRIMARY KEY,
    backup_file_path VARCHAR(500) NOT NULL,
    backup_size_bytes BIGINT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Component Design

### 1. User Interface Layer

#### UI Components

**MainWindow**
- Navigation menu (Dashboard, Workers, Attendance, Reports, Settings)
- Status bar (connectivity status, current time, scanner status)
- Content area for rendering active view

**DashboardView**
- Today's attendance summary (workers present, total hours)
- Recent attendance events list
- Unresolved anomalies count with quick access link
- Quick actions (Register Worker, Record Attendance)

**WorkerRegistrationView**
- Form inputs (NID, Worker Number, Name, Classification, Contact, Hourly Rate)
- Fingerprint capture button with live feedback
- Validation error display
- Save and Cancel buttons

**AttendanceRecordingView**
- Live fingerprint scanner status indicator
- Worker identification display after successful scan
- Event type selection (Entry, Leave Site, Return to Site, Exit)
- Recent events log (last 20 events)
- Manual event entry button (for anomaly correction)


**WorkerManagementView**
- Searchable/filterable worker list table
- Worker detail panel (view/edit mode)
- Attendance history table (last 30 days)
- Deactivate worker button
- Export to CSV button

**AnomalyReviewView**
- Filterable anomaly list (by type, date, resolution status)
- Anomaly detail panel with context (worker info, related events)
- Correction actions (Add Event, Delete Event, Mark Resolved)
- Batch resolution actions

**SettingsView**
- Site Configuration section (name, location, hours)
- Owner Email Management section (add/remove emails)
- Email Report Schedule configuration
- Scanner Configuration section
- Database backup/restore section

**ReportsPreviewView**
- Report type selector (Daily Summary, Analytics)
- Date range selector
- Report preview (HTML rendering)
- Manual send button

### 2. Business Logic Layer

#### Service Classes

**WorkerService**
```typescript
class WorkerService {
  registerWorker(data: WorkerRegistrationData): Promise<Worker>
  updateWorker(id: number, data: Partial<WorkerData>): Promise<Worker>
  deactivateWorker(id: number): Promise<void>
  getWorkerById(id: number): Promise<Worker | null>
  getAllWorkers(includeInactive: boolean): Promise<Worker[]>
  searchWorkers(criteria: SearchCriteria): Promise<Worker[]>
  validateUniqueNID(nid: string): Promise<boolean>
  validateUniqueWorkerNumber(number: string): Promise<boolean>
}
```


**FingerprintService**
```typescript
class FingerprintService {
  initializeScanner(): Promise<void>
  captureFingerprint(): Promise<FingerprintTemplate>
  verifyFingerprint(): Promise<Worker | null>
  validateTemplateQuality(template: FingerprintTemplate): boolean
  checkScannerConnection(): Promise<boolean>
  getScannerStatus(): ScannerStatus
}
```

**AttendanceService**
```typescript
class AttendanceService {
  recordAttendanceEvent(workerId: number, eventType: EventType): Promise<AttendanceEvent>
  getWorkerEventsForDate(workerId: number, date: Date): Promise<AttendanceEvent[]>
  calculateHoursWorked(workerId: number, date: Date): Promise<HoursWorkedResult>
  getAttendanceRecords(criteria: SearchCriteria): Promise<AttendanceRecord[]>
  exportAttendanceToCSV(records: AttendanceRecord[], filePath: string): Promise<void>
  determineNextEventType(workerId: number): Promise<EventType[]>
}
```

**AnomalyService**
```typescript
class AnomalyService {
  detectAnomalies(date: Date): Promise<AttendanceAnomaly[]>
  getUnresolvedAnomalies(): Promise<AttendanceAnomaly[]>
  resolveAnomaly(anomalyId: number, resolution: AnomalyResolution): Promise<void>
  addManualEvent(workerId: number, eventType: EventType, timestamp: Date): Promise<void>
  deleteEvent(eventId: number): Promise<void>
}
```


**ReportService**
```typescript
class ReportService {
  generateDailySummaryReport(date: Date): Promise<DailySummaryReport>
  generateAnalyticsReport(startDate: Date, endDate: Date): Promise<AnalyticsReport>
  generateExceptionAlert(anomaly: AttendanceAnomaly): Promise<ExceptionAlert>
  renderReportAsHTML(report: Report): string
  generateChartImage(chartData: ChartData): Promise<Buffer>
}
```

**EmailService**
```typescript
class EmailService {
  queueEmail(email: EmailData): Promise<void>
  sendQueuedEmails(): Promise<SendResult[]>
  testEmailConfiguration(): Promise<boolean>
  getEmailQueueStatus(): Promise<QueueStatus>
  retryFailedEmails(): Promise<void>
}
```

**ConfigurationService**
```typescript
class ConfigurationService {
  getSiteConfiguration(): Promise<SiteConfiguration>
  updateSiteConfiguration(config: SiteConfiguration): Promise<void>
  getOwnerEmails(): Promise<string[]>
  addOwnerEmail(email: string): Promise<void>
  removeOwnerEmail(email: string): Promise<void>
  validateEmailFormat(email: string): boolean
}
```

**BackupService**
```typescript
class BackupService {
  createBackup(): Promise<BackupResult>
  restoreBackup(backupFilePath: string): Promise<void>
  getBackupHistory(): Promise<SystemBackup[]>
  deleteOldBackups(retentionDays: number): Promise<void>
}
```


**SchedulingService**
```typescript
class SchedulingService {
  scheduleTask(task: ScheduledTask): void
  cancelTask(taskId: string): void
  
  // Scheduled tasks:
  // - Daily Summary Report: 11:59 PM daily
  // - Analytics Report: 12:01 AM on 1st of month
  // - Anomaly Detection: Every hour
  // - Email Queue Processing: Every 5 minutes
  // - Backup Creation: Midnight daily
  // - Exception Alert Check: Every 30 minutes after closing time
}
```

### 3. Data Access Layer

**Repository Pattern Implementation**

```typescript
interface IRepository<T> {
  create(entity: T): Promise<T>
  update(id: number, entity: Partial<T>): Promise<T>
  delete(id: number): Promise<void>
  findById(id: number): Promise<T | null>
  findAll(): Promise<T[]>
  findWhere(criteria: QueryCriteria): Promise<T[]>
}

class WorkerRepository implements IRepository<Worker> { /* ... */ }
class AttendanceEventRepository implements IRepository<AttendanceEvent> { /* ... */ }
class AttendanceAnomalyRepository implements IRepository<AttendanceAnomaly> { /* ... */ }
class EmailQueueRepository implements IRepository<EmailQueue> { /* ... */ }
```

**Database Connection Manager**
```typescript
import { Pool, PoolClient } from 'pg'

class DatabaseManager {
  private static instance: DatabaseManager
  private pool: Pool
  
  static getInstance(): DatabaseManager
  initialize(config: DatabaseConfig): Promise<void>
  getPool(): Pool
  getClient(): Promise<PoolClient>
  executeTransaction(callback: TransactionCallback): Promise<void>
  close(): Promise<void>
}

interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  max: number  // connection pool size
  idleTimeoutMillis: number
  connectionTimeoutMillis: number
}
```


## Key Algorithms

### 1. Hours Worked Calculation Algorithm

```typescript
function calculateHoursWorked(events: AttendanceEvent[]): HoursWorkedResult {
  // Sort events chronologically
  const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp)
  
  // Find entry and exit
  const entryEvent = sortedEvents.find(e => e.event_type === 'ENTRY')
  const exitEvent = sortedEvents.find(e => e.event_type === 'EXIT')
  
  if (!entryEvent || !exitEvent) {
    return { hoursWorked: null, status: 'INCOMPLETE' }
  }
  
  // Calculate total session duration
  const sessionDuration = exitEvent.timestamp - entryEvent.timestamp
  
  // Calculate break periods
  let totalBreakDuration = 0
  const leaveEvents = sortedEvents.filter(e => e.event_type === 'LEAVE_SITE')
  const returnEvents = sortedEvents.filter(e => e.event_type === 'RETURN_TO_SITE')
  
  for (let i = 0; i < Math.min(leaveEvents.length, returnEvents.length); i++) {
    const breakDuration = returnEvents[i].timestamp - leaveEvents[i].timestamp
    totalBreakDuration += breakDuration
  }
  
  // Calculate net hours worked
  const netDuration = sessionDuration - totalBreakDuration
  const hoursWorked = netDuration / (1000 * 60 * 60) // Convert ms to hours
  
  return {
    hoursWorked: Math.round(hoursWorked * 60) / 60, // Round to nearest minute
    status: 'COMPLETE',
    entryTime: entryEvent.timestamp,
    exitTime: exitEvent.timestamp,
    breakDuration: totalBreakDuration
  }
}
```


### 2. Anomaly Detection Algorithm

```typescript
function detectAnomalies(date: Date, allEvents: AttendanceEvent[]): AttendanceAnomaly[] {
  const anomalies: AttendanceAnomaly[] = []
  
  // Group events by worker
  const eventsByWorker = groupBy(allEvents, 'worker_id')
  
  for (const [workerId, events] of Object.entries(eventsByWorker)) {
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp)
    
    // Check for missing exit
    const hasEntry = sortedEvents.some(e => e.event_type === 'ENTRY')
    const hasExit = sortedEvents.some(e => e.event_type === 'EXIT')
    if (hasEntry && !hasExit) {
      anomalies.push({
        worker_id: workerId,
        anomaly_type: 'MISSING_EXIT',
        detection_date: date,
        description: 'Worker has entry but no exit event'
      })
    }
    
    // Check for missing return
    const leaveCount = sortedEvents.filter(e => e.event_type === 'LEAVE_SITE').length
    const returnCount = sortedEvents.filter(e => e.event_type === 'RETURN_TO_SITE').length
    if (leaveCount > returnCount) {
      anomalies.push({
        worker_id: workerId,
        anomaly_type: 'MISSING_RETURN',
        detection_date: date,
        description: 'Worker left site but did not return'
      })
    }
    
    // Check for excessive break time
    const { breakDuration } = calculateHoursWorked(sortedEvents)
    if (breakDuration && breakDuration > 3 * 60 * 60 * 1000) { // 3 hours in ms
      anomalies.push({
        worker_id: workerId,
        anomaly_type: 'EXCESSIVE_BREAK',
        detection_date: date,
        description: `Total break time exceeds 3 hours: ${formatDuration(breakDuration)}`
      })
    }
    
    // Check for duplicate entries
    const entryEvents = sortedEvents.filter(e => e.event_type === 'ENTRY')
    if (entryEvents.length > 1) {
      anomalies.push({
        worker_id: workerId,
        anomaly_type: 'DUPLICATE_ENTRY',
        detection_date: date,
        description: `Multiple entry events detected: ${entryEvents.length}`
      })
    }
  }
  
  return anomalies
}
```

### 3. Next Event Type Determination

```typescript
function determineNextEventType(workerEvents: AttendanceEvent[]): EventType[] {
  if (workerEvents.length === 0) {
    return ['ENTRY'] // First event of the day must be entry
  }
  
  const lastEvent = workerEvents[workerEvents.length - 1]
  
  switch (lastEvent.event_type) {
    case 'ENTRY':
      return ['LEAVE_SITE', 'EXIT'] // Can leave temporarily or exit for the day
    case 'LEAVE_SITE':
      return ['RETURN_TO_SITE'] // Must return before any other action
    case 'RETURN_TO_SITE':
      return ['LEAVE_SITE', 'EXIT'] // Can leave again or exit
    case 'EXIT':
      return [] // No more events allowed after exit
    default:
      throw new Error(`Unknown event type: ${lastEvent.event_type}`)
  }
}
```


### 4. Fingerprint Matching Algorithm

```typescript
async function matchFingerprint(scannedTemplate: FingerprintTemplate): Promise<Worker | null> {
  const allWorkers = await workerRepository.findWhere({ is_active: 1 })
  
  let bestMatch: Worker | null = null
  let highestScore = 0
  const MATCH_THRESHOLD = 0.85 // Configurable matching threshold
  
  for (const worker of allWorkers) {
    const score = await fingerprintSDK.compareTemplates(
      scannedTemplate,
      worker.fingerprint_data
    )
    
    if (score > highestScore && score >= MATCH_THRESHOLD) {
      highestScore = score
      bestMatch = worker
    }
  }
  
  return bestMatch
}
```

## Email Report Templates

### Daily Summary Report Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Professional email styling */
  </style>
</head>
<body>
  <h1>Daily Attendance Summary - {{site_name}}</h1>
  <p><strong>Date:</strong> {{report_date}}</p>
  <p><strong>Total Workers Present:</strong> {{total_workers}}</p>
  <p><strong>Total Hours Worked:</strong> {{total_hours}}</p>
  
  <h2>Worker Attendance Details</h2>
  <table>
    <thead>
      <tr>
        <th>Worker #</th>
        <th>Name</th>
        <th>Entry Time</th>
        <th>Exit Time</th>
        <th>Break Duration</th>
        <th>Hours Worked</th>
      </tr>
    </thead>
    <tbody>
      {{#each workers}}
      <tr>
        <td>{{worker_number}}</td>
        <td>{{full_name}}</td>
        <td>{{entry_time}}</td>
        <td>{{exit_time}}</td>
        <td>{{break_duration}}</td>
        <td>{{hours_worked}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  {{#if anomalies}}
  <h2>Attendance Anomalies</h2>
  <ul>
    {{#each anomalies}}
    <li><strong>{{worker_name}}</strong>: {{description}}</li>
    {{/each}}
  </ul>
  {{/if}}
</body>
</html>
```


### Analytics Report Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Professional email styling */
  </style>
</head>
<body>
  <h1>Monthly Analytics Report - {{site_name}}</h1>
  <p><strong>Period:</strong> {{start_date}} to {{end_date}}</p>
  
  <h2>Summary Statistics</h2>
  <table>
    <tr>
      <td>Average Daily Attendance:</td>
      <td>{{avg_daily_attendance}}</td>
    </tr>
    <tr>
      <td>Total Hours Worked (All Workers):</td>
      <td>{{total_hours}}</td>
    </tr>
    <tr>
      <td>Average Hours per Worker per Day:</td>
      <td>{{avg_hours_per_day}}</td>
    </tr>
    <tr>
      <td>Total Anomalies Detected:</td>
      <td>{{total_anomalies}}</td>
    </tr>
  </table>
  
  <h2>Top Performers</h2>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Worker Name</th>
        <th>Total Hours</th>
      </tr>
    </thead>
    <tbody>
      {{#each top_workers}}
      <tr>
        <td>{{rank}}</td>
        <td>{{name}}</td>
        <td>{{hours}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  <h2>Anomalies Breakdown</h2>
  <img src="cid:anomaly_chart" alt="Anomalies by Type" />
  
  <h2>Attendance Trend</h2>
  <img src="cid:attendance_chart" alt="Daily Attendance Trend" />
</body>
</html>
```


### Exception Alert Structure

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    /* Alert styling with warning colors */
  </style>
</head>
<body>
  <h1 style="color: #d32f2f;">⚠️ Attendance Exception Alert</h1>
  <p><strong>Date:</strong> {{alert_date}}</p>
  <p><strong>Worker:</strong> {{worker_name}} ({{worker_number}})</p>
  <p><strong>Exception Type:</strong> {{anomaly_type}}</p>
  
  <h2>Description</h2>
  <p>{{description}}</p>
  
  <h2>Recent Events</h2>
  <table>
    <thead>
      <tr>
        <th>Event Type</th>
        <th>Timestamp</th>
      </tr>
    </thead>
    <tbody>
      {{#each recent_events}}
      <tr>
        <td>{{event_type}}</td>
        <td>{{timestamp}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  <p><em>This alert was generated automatically by the Ubaka Attendance Tracking System.</em></p>
</body>
</html>
```

## Offline-First Architecture

### Connectivity Management

```typescript
class ConnectivityService {
  private isOnline: boolean = false
  private listeners: ConnectivityListener[] = []
  
  constructor() {
    this.initializeConnectivityMonitor()
  }
  
  private initializeConnectivityMonitor(): void {
    // Check connectivity every 30 seconds
    setInterval(() => {
      this.checkConnectivity()
    }, 30000)
  }
  
  private async checkConnectivity(): Promise<void> {
    const previousState = this.isOnline
    
    try {
      // Attempt to reach a reliable endpoint
      await fetch('https://www.google.com', { method: 'HEAD', timeout: 5000 })
      this.isOnline = true
    } catch (error) {
      this.isOnline = false
    }
    
    if (previousState !== this.isOnline) {
      this.notifyListeners(this.isOnline)
      
      if (this.isOnline) {
        // Connectivity restored - process queued emails
        await emailService.sendQueuedEmails()
      }
    }
  }
  
  getConnectivityStatus(): boolean {
    return this.isOnline
  }
  
  addListener(listener: ConnectivityListener): void {
    this.listeners.push(listener)
  }
  
  private notifyListeners(isOnline: boolean): void {
    this.listeners.forEach(listener => listener.onConnectivityChange(isOnline))
  }
}
```


### Email Queue Processing

```typescript
class EmailQueueProcessor {
  private isProcessing: boolean = false
  
  async processQueue(): Promise<void> {
    if (this.isProcessing || !connectivityService.getConnectivityStatus()) {
      return
    }
    
    this.isProcessing = true
    
    try {
      const pendingEmails = await emailQueueRepository.findWhere({
        status: 'PENDING',
        retry_count: { $lt: 3 } // Max 3 retries
      })
      
      for (const email of pendingEmails) {
        try {
          await this.sendEmail(email)
          await emailQueueRepository.update(email.id, {
            status: 'SENT',
            sent_at: new Date()
          })
        } catch (error) {
          await emailQueueRepository.update(email.id, {
            status: 'FAILED',
            error_message: error.message,
            retry_count: email.retry_count + 1
          })
        }
      }
    } finally {
      this.isProcessing = false
    }
  }
  
  private async sendEmail(email: EmailQueue): Promise<void> {
    // SMTP sending logic using nodemailer
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.username,
        pass: config.smtp.password
      }
    })
    
    await transporter.sendMail({
      from: config.smtp.fromAddress,
      to: email.recipient_email,
      subject: email.subject,
      html: email.html_body
    })
  }
}
```


## Security Considerations

### 1. Biometric Data Protection
- Fingerprint templates stored as encrypted BLOB in database
- Use AES-256 encryption for biometric data at rest
- Never transmit raw fingerprint data externally
- Implement secure deletion when worker is permanently removed

### 2. Data Backup Security
- Encrypt backup files with password protection
- Store backups in secure location with restricted file permissions
- Implement backup retention policy (30-90 days recommended)

### 3. Email Security
- Use TLS/SSL for SMTP connections
- Store email credentials in encrypted configuration file
- Validate email addresses to prevent injection attacks
- Rate-limit email sending to prevent abuse

### 4. Database Security
- Use parameterized queries to prevent SQL injection
- Implement database file encryption
- Set appropriate file system permissions on database file
- Regular integrity checks

### 5. Application Security
- Implement role-based access control (Field Engineer role)
- Log all critical operations (worker registration, manual event entries)
- Input validation on all user inputs
- Secure storage of application configuration

## Error Handling Strategy

### Error Categories

**1. Hardware Errors**
- Fingerprint scanner disconnection
- Scanner malfunction
- Recovery: Display error message, allow manual event entry, log incident

**2. Database Errors**
- Connection failures
- Transaction failures
- Constraint violations
- Recovery: Rollback transaction, display user-friendly error, log full error

**3. Network Errors**
- Email sending failures
- SMTP connection errors
- Recovery: Queue email for retry, update UI status indicator

**4. Validation Errors**
- Invalid input data
- Duplicate entries
- Business rule violations
- Recovery: Display validation messages, prevent operation, guide user to correction


### Error Logging

```typescript
class ErrorLogger {
  logError(error: Error, context: ErrorContext): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      message: error.message,
      stack: error.stack,
      context: context,
      user: context.userId || 'system'
    }
    
    // Write to log file
    fs.appendFileSync(
      path.join(APP_DATA_DIR, 'logs', 'error.log'),
      JSON.stringify(logEntry) + '\n'
    )
    
    // For critical errors, also display to user
    if (context.severity === 'CRITICAL') {
      this.displayErrorDialog(error, context)
    }
  }
}
```

## Performance Considerations

### Database Optimization
- Create indexes on frequently queried columns (worker_id, timestamp, date)
- Use prepared statements for repeated queries
- Implement connection pooling (5-10 connections for desktop app)
- Regular VACUUM ANALYZE operations to optimize query planner
- Use EXPLAIN ANALYZE to identify slow queries
- Implement proper transaction isolation levels

### Fingerprint Matching Optimization
- Implement early termination if high-confidence match found
- Cache frequently matched workers (MRU cache)
- Parallel template comparison for large worker databases (>500 workers)
- Pre-filter by worker classification if implemented

### UI Responsiveness
- Run fingerprint operations on background thread
- Use virtual scrolling for large worker lists
- Lazy load attendance history (pagination)
- Debounce search inputs

### Report Generation Optimization
- Generate reports asynchronously
- Cache chart images for repeated report views
- Pre-aggregate analytics data monthly
- Limit email attachment sizes (<5MB recommended)


## Deployment Architecture

### Application Structure

```
ubaka-attendance-tracking/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts
│   │   ├── database/
│   │   ├── services/
│   │   └── hardware/
│   ├── renderer/             # React UI
│   │   ├── components/
│   │   ├── views/
│   │   ├── hooks/
│   │   └── utils/
│   ├── shared/               # Shared types and constants
│   │   ├── types/
│   │   ├── constants/
│   │   └── validation/
│   └── preload/              # Electron preload scripts
├── resources/                # Static resources
│   ├── icons/
│   ├── email-templates/
│   └── sdk/                  # Fingerprint scanner SDK
├── data/                     # Application data (created at runtime)
│   ├── database/
│   │   └── ubaka.db
│   ├── backups/
│   └── logs/
├── config/
│   └── app-config.json
├── package.json
└── README.md
```

### Installation Requirements

**System Requirements**:
- Operating System: Windows 10/11, macOS 10.15+, or Ubuntu 20.04+
- RAM: Minimum 4GB, Recommended 8GB
- Storage: 500MB application + 10GB for data and backups
- USB Port: For fingerprint scanner connection
- Internet: Required for email sending (not required for attendance tracking)

**Dependencies**:
- Node.js runtime (bundled with Electron)
- PostgreSQL 12+ (must be installed separately or bundled)
  - Can be installed locally on the desktop machine
  - Default database: `ubaka_attendance`
  - Recommended: Create dedicated database user
- Fingerprint scanner drivers (hardware-specific)

**PostgreSQL Setup Options**:
1. **Local Installation**: PostgreSQL installed on the same machine as the app
2. **Portable PostgreSQL**: Bundled PostgreSQL that runs alongside the application
3. **Network Installation**: Connect to PostgreSQL server on local network

### Configuration Management

```typescript
interface AppConfiguration {
  database: {
    host: string
    port: number
    database: string
    user: string
    password: string
    maxConnections: number
    backupPath: string
    backupRetentionDays: number
  }
  email: {
    smtp: {
      host: string
      port: number
      secure: boolean
      username: string
      password: string  // Encrypted
      fromAddress: string
    }
    schedules: {
      dailySummary: string  // Cron expression
      monthlyAnalytics: string
    }
  }
  fingerprint: {
    scannerType: string
    sdkPath: string
    matchThreshold: number
    captureTimeout: number
  }
  reporting: {
    chartWidth: number
    chartHeight: number
    maxEmailSize: number
  }
  security: {
    encryptionKey: string  // Generated on first run
  }
}
```


## Testing Strategy

### Unit Testing
- Test all service layer business logic
- Test calculation algorithms (hours worked, anomaly detection)
- Test data validation functions
- Test repository CRUD operations
- **Framework**: Jest or Vitest
- **Target Coverage**: >80%

### Integration Testing
- Test database operations with actual SQLite database
- Test fingerprint SDK integration (with mock hardware)
- Test email service with test SMTP server
- Test scheduling service task execution
- **Framework**: Jest with testcontainers

### End-to-End Testing
- Test complete user workflows (worker registration flow, attendance recording flow)
- Test anomaly detection and correction workflow
- Test report generation and preview
- **Framework**: Playwright or Spectron

### Hardware Testing
- Test with actual fingerprint scanner hardware
- Test scanner reconnection after disconnection
- Test concurrent scan attempts
- Test fingerprint quality validation
- **Approach**: Manual testing with test plan checklist

### Performance Testing
- Test fingerprint matching with 100, 500, 1000 workers
- Test report generation with 1 month, 6 months, 1 year of data
- Test database query performance with large datasets
- Test UI responsiveness under load
- **Tools**: Custom performance benchmarks

## Migration and Upgrade Strategy

### Initial Setup
1. Application installer creates necessary directories
2. Verify PostgreSQL installation or install portable version
3. Create database and run schema migrations
4. Generate encryption keys
5. Create default configuration file
6. Prompt for database connection details
7. Prompt for initial site configuration
8. Test database connection and create initial tables

### Data Migration (Future Versions)
```typescript
class MigrationManager {
  async migrate(fromVersion: string, toVersion: string): Promise<void> {
    const migrations = this.getMigrationPath(fromVersion, toVersion)
    
    for (const migration of migrations) {
      await this.executeTransaction(async () => {
        await migration.up()
        await this.updateSchemaVersion(migration.version)
      })
    }
  }
  
  private getMigrationPath(from: string, to: string): Migration[] {
    // Return ordered list of migrations to apply
  }
}
```


## Monitoring and Maintenance

### Application Logging

```typescript
enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

class Logger {
  log(level: LogLevel, message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    }
    
    // Write to appropriate log file
    const logFile = this.getLogFile(level)
    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n')
    
    // Also output to console in development
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level}] ${message}`, context)
    }
  }
}
```

### Health Monitoring

```typescript
class HealthMonitor {
  async checkHealth(): Promise<HealthStatus> {
    return {
      database: await this.checkDatabase(),
      scanner: await this.checkScanner(),
      connectivity: await this.checkConnectivity(),
      emailQueue: await this.checkEmailQueue(),
      diskSpace: await this.checkDiskSpace(),
      lastBackup: await this.getLastBackupTime()
    }
  }
  
  async checkDatabase(): Promise<ComponentHealth> {
    try {
      await db.execute('SELECT 1')
      return { status: 'HEALTHY', message: 'Database responsive' }
    } catch (error) {
      return { status: 'UNHEALTHY', message: error.message }
    }
  }
  
  // Similar checks for other components...
}
```

### Maintenance Tasks

**Daily**:
- Create database backup
- Clean up old log files (>30 days)
- Process email queue

**Weekly**:
- Database optimization (VACUUM)
- Clean up resolved anomalies (>90 days)
- Archive old backups

**Monthly**:
- Generate and review analytics report
- Check disk space usage
- Review error logs for patterns

## Future Enhancements (Out of Scope for Phase 1)

1. **Multi-Site Support**: Manage multiple construction sites from single application
2. **Worker Self-Service Portal**: Mobile app for workers to view their attendance
3. **Owner Web Dashboard**: Real-time web interface for owners
4. **Advanced Analytics**: Machine learning for attendance pattern prediction
5. **Integration with Payroll Systems**: Export data to accounting software
6. **Geofencing**: GPS-based site boundary verification
7. **Photo Capture**: Optional photo capture alongside fingerprint
8. **Shift Management**: Support for multiple work shifts
9. **Leave Management**: Track sick leave, vacation, approved absences
10. **Compliance Reporting**: Labor law compliance reports


## Implementation Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- Set up Electron + React project structure
- Implement database schema and connection management
- Create repository pattern implementation
- Set up logging and error handling
- Implement configuration management

### Phase 2: Worker Management (Weeks 3-4)
- Integrate fingerprint scanner SDK
- Implement worker registration UI and logic
- Implement worker management interface
- Create worker search and filtering
- Implement biometric data encryption

### Phase 3: Attendance Tracking (Weeks 5-6)
- Implement attendance event recording UI
- Create attendance event state machine
- Implement hours worked calculation
- Create attendance history views
- Implement CSV export functionality

### Phase 4: Anomaly Detection (Week 7)
- Implement anomaly detection algorithms
- Create anomaly review interface
- Implement manual event entry for corrections
- Create anomaly resolution workflow

### Phase 5: Reporting System (Weeks 8-9)
- Implement email service and queue
- Create report generation logic
- Design and implement email templates
- Implement chart generation
- Create scheduled task system

### Phase 6: Offline Support (Week 10)
- Implement connectivity monitoring
- Create email queue processor
- Implement data synchronization
- Create offline indicator UI

### Phase 7: Configuration & Settings (Week 11)
- Implement site configuration UI
- Create owner email management
- Implement backup/restore functionality
- Create settings UI

### Phase 8: Testing & Polish (Weeks 12-13)
- Comprehensive testing (unit, integration, E2E)
- Performance optimization
- UI/UX refinements
- Bug fixes
- Documentation

### Phase 9: Deployment (Week 14)
- Create installation package
- Prepare deployment documentation
- Field testing with actual hardware
- Final adjustments and release

## Conclusion

This design document provides a comprehensive blueprint for implementing the Ubaka Attendance Tracking System. The architecture emphasizes offline-first operation, reliability, and ease of use for Field Engineers while providing comprehensive reporting for Owners via email. The modular design allows for future enhancements while maintaining the core functionality specified in the requirements document.
