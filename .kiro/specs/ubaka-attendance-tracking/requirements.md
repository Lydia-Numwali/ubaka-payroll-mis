# Requirements Document

## Introduction

The Ubaka Attendance Tracking System is a desktop application designed for construction site (chantier) worker attendance management. The system enables Field Engineers to track worker attendance using fingerprint verification and automatically calculates hours worked. Owners receive attendance reports and analytics via email without requiring direct system access. This specification covers Phase 1 functionality, focusing exclusively on attendance tracking without payment processing capabilities.

## Glossary

- **System**: The Ubaka Attendance Tracking desktop application
- **Owner**: The user role that receives email reports about attendance data but has no direct system access
- **Field_Engineer**: The user role that operates the desktop application on construction sites to manage workers and track attendance
- **Worker**: A construction site employee whose attendance is tracked by the system
- **Attendance_Event**: A recorded instance of worker interaction with the system (entry, exit, leave site, return to site)
- **Work_Session**: The time period between a Worker's entry and exit for a single day
- **Break_Period**: The time period when a Worker has left the site temporarily during their Work_Session
- **Hours_Worked**: The total time a Worker spent on site, calculated as Work_Session duration minus Break_Period durations
- **Fingerprint_Scanner**: The hardware device integrated with the System for biometric verification
- **Daily_Summary_Report**: An email report containing attendance data for all Workers for a specific day
- **Analytics_Report**: An email report containing aggregated attendance statistics and trends
- **Exception_Alert**: An email notification sent to the Owner when attendance anomalies are detected
- **Attendance_Anomaly**: An unusual attendance pattern such as missing exit, excessive break time, or duplicate entries
- **NID**: National Identification Document number used to uniquely identify Workers
- **Worker_Number**: A unique identifier assigned to each Worker within the System
- **Worker_Classification**: A categorization of Workers by role or skill level (e.g., mason, carpenter, laborer)
- **Hourly_Rate**: The monetary compensation per hour for a Worker
- **Attendance_Record**: A complete record of all Attendance_Events for a Worker on a specific day

## Requirements

### Requirement 1: Worker Registration

**User Story:** As a Field Engineer, I want to register workers with their identification and biometric data, so that I can track their attendance using fingerprint verification.

#### Acceptance Criteria

1. THE System SHALL register a Worker with NID, Worker_Number, Worker_Classification, name, contact information, Hourly_Rate, and fingerprint template
2. WHEN a Field_Engineer attempts to register a Worker with a duplicate NID, THE System SHALL reject the registration and display an error message
3. WHEN a Field_Engineer attempts to register a Worker with a duplicate Worker_Number, THE System SHALL reject the registration and display an error message
4. WHEN a Field_Engineer attempts to register a Worker with a duplicate fingerprint template, THE System SHALL reject the registration and display an error message
5. THE System SHALL validate that NID is non-empty before completing registration
6. THE System SHALL validate that Worker_Number is non-empty before completing registration
7. THE System SHALL validate that name is non-empty before completing registration
8. WHEN a fingerprint template is captured, THE System SHALL verify the template quality meets minimum standards before completing registration

### Requirement 2: Fingerprint Scanner Integration

**User Story:** As a Field Engineer, I want the system to integrate with fingerprint scanners, so that workers can be verified quickly and accurately.

#### Acceptance Criteria

1. THE System SHALL integrate with Fingerprint_Scanner hardware to capture fingerprint templates during Worker registration
2. THE System SHALL integrate with Fingerprint_Scanner hardware to verify Worker identity during Attendance_Event recording
3. WHEN a fingerprint is scanned, THE System SHALL match it against registered Worker fingerprint templates within 3 seconds
4. WHEN a scanned fingerprint matches a registered Worker, THE System SHALL return the Worker's identity
5. WHEN a scanned fingerprint does not match any registered Worker, THE System SHALL display an unrecognized fingerprint message
6. IF the Fingerprint_Scanner is disconnected, THEN THE System SHALL display a hardware connection error message

### Requirement 3: Attendance Event Recording

**User Story:** As a Field Engineer, I want to record worker attendance events using fingerprint verification, so that I can track when workers enter, leave, and return to the construction site.

#### Acceptance Criteria

1. WHEN a Worker scans their fingerprint and no Attendance_Record exists for that Worker for the current day, THE System SHALL record an entry Attendance_Event with the current timestamp
2. WHEN a Worker scans their fingerprint and an Attendance_Record exists with an entry event but no exit event, THE System SHALL prompt the Field_Engineer to select either "Leave Site" or "Exit"
3. WHEN the Field_Engineer selects "Leave Site", THE System SHALL record a leave site Attendance_Event with the current timestamp
4. WHEN a Worker scans their fingerprint and the most recent Attendance_Event is a leave site event, THE System SHALL record a return to site Attendance_Event with the current timestamp
5. WHEN the Field_Engineer selects "Exit", THE System SHALL record an exit Attendance_Event with the current timestamp
6. THE System SHALL store each Attendance_Event with Worker_Number, event type, and timestamp
7. WHEN an Attendance_Event is recorded, THE System SHALL display confirmation to the Field_Engineer including Worker name and event type

### Requirement 4: Hours Worked Calculation

**User Story:** As a Field Engineer, I want the system to automatically calculate hours worked for each worker, so that I don't have to perform manual time calculations.

#### Acceptance Criteria

1. WHEN a Worker has recorded an entry and exit Attendance_Event for a day, THE System SHALL calculate Hours_Worked as the time difference between entry and exit timestamps
2. WHEN a Worker has recorded one or more Break_Periods, THE System SHALL subtract the total Break_Period duration from the Work_Session duration to calculate Hours_Worked
3. THE System SHALL calculate each Break_Period duration as the time difference between leave site and return to site timestamps
4. WHEN multiple Break_Periods exist for a Worker on a single day, THE System SHALL sum all Break_Period durations before calculating Hours_Worked
5. THE System SHALL express Hours_Worked in hours and minutes with precision to the nearest minute
6. WHEN an exit Attendance_Event has not been recorded, THE System SHALL indicate Hours_Worked as incomplete

### Requirement 5: Attendance Anomaly Detection

**User Story:** As a Field Engineer, I want the system to detect attendance anomalies, so that I can correct errors and ensure accurate attendance records.

#### Acceptance Criteria

1. WHEN a Worker has an entry Attendance_Event but no exit Attendance_Event by end of day, THE System SHALL flag this as an Attendance_Anomaly of type "Missing Exit"
2. WHEN a Worker has a leave site Attendance_Event but no corresponding return to site Attendance_Event by end of day, THE System SHALL flag this as an Attendance_Anomaly of type "Missing Return"
3. WHEN a Worker's total Break_Period duration exceeds 3 hours in a single day, THE System SHALL flag this as an Attendance_Anomaly of type "Excessive Break Time"
4. WHEN a Worker has recorded an entry Attendance_Event and another entry Attendance_Event without an intervening exit event, THE System SHALL flag this as an Attendance_Anomaly of type "Duplicate Entry"
5. THE System SHALL display all detected Attendance_Anomalies to the Field_Engineer in a dedicated review interface

### Requirement 6: Attendance Anomaly Correction

**User Story:** As a Field Engineer, I want to correct detected attendance anomalies, so that attendance records accurately reflect what happened on site.

#### Acceptance Criteria

1. WHEN the Field_Engineer views an Attendance_Anomaly of type "Missing Exit", THE System SHALL allow the Field_Engineer to add an exit Attendance_Event with a manually specified timestamp
2. WHEN the Field_Engineer views an Attendance_Anomaly of type "Missing Return", THE System SHALL allow the Field_Engineer to add a return to site Attendance_Event with a manually specified timestamp
3. WHEN the Field_Engineer views an Attendance_Anomaly of type "Duplicate Entry", THE System SHALL allow the Field_Engineer to delete one of the duplicate entry events
4. WHEN the Field_Engineer corrects an Attendance_Anomaly, THE System SHALL recalculate Hours_Worked for the affected Worker
5. WHEN the Field_Engineer corrects an Attendance_Anomaly, THE System SHALL mark the Attendance_Anomaly as resolved
6. THE System SHALL validate that manually specified timestamps are within the current day before accepting corrections

### Requirement 7: Worker Management Interface

**User Story:** As a Field Engineer, I want to view and manage registered workers, so that I can update worker information and review their attendance history.

#### Acceptance Criteria

1. THE System SHALL display a list of all registered Workers with Worker_Number, name, and Worker_Classification
2. WHEN the Field_Engineer selects a Worker from the list, THE System SHALL display complete Worker details including NID, contact information, and Hourly_Rate
3. WHEN the Field_Engineer selects a Worker from the list, THE System SHALL display the Worker's Attendance_Records for the past 30 days
4. THE System SHALL allow the Field_Engineer to update Worker contact information, Worker_Classification, and Hourly_Rate
5. THE System SHALL allow the Field_Engineer to deactivate a Worker account
6. WHEN a Worker account is deactivated, THE System SHALL prevent new Attendance_Events from being recorded for that Worker
7. WHEN a deactivated Worker attempts to scan their fingerprint, THE System SHALL display a message indicating the Worker account is inactive

### Requirement 8: Daily Summary Report Generation

**User Story:** As an Owner, I want to receive daily attendance summary reports via email, so that I can monitor worker attendance without accessing the system directly.

#### Acceptance Criteria

1. THE System SHALL generate a Daily_Summary_Report for each construction site at 11:59 PM local time
2. THE Daily_Summary_Report SHALL include the date, construction site name, and total number of Workers who recorded attendance
3. THE Daily_Summary_Report SHALL include for each Worker: Worker_Number, name, entry time, exit time, total Break_Period duration, and Hours_Worked
4. THE Daily_Summary_Report SHALL list any unresolved Attendance_Anomalies detected for the day
5. THE Daily_Summary_Report SHALL calculate the total Hours_Worked across all Workers for the day
6. THE System SHALL send the Daily_Summary_Report to the Owner's registered email address
7. THE System SHALL format the Daily_Summary_Report as a human-readable HTML email with tabular data

### Requirement 9: Analytics Report Generation

**User Story:** As an Owner, I want to receive periodic analytics reports via email, so that I can understand attendance trends and worker productivity patterns.

#### Acceptance Criteria

1. THE System SHALL generate an Analytics_Report on the first day of each month covering the previous month
2. THE Analytics_Report SHALL include total Hours_Worked per Worker for the reporting period
3. THE Analytics_Report SHALL include average daily attendance count for the reporting period
4. THE Analytics_Report SHALL include total number of Attendance_Anomalies by type for the reporting period
5. THE Analytics_Report SHALL identify Workers with the highest and lowest total Hours_Worked for the reporting period
6. THE Analytics_Report SHALL calculate average Hours_Worked per day across all Workers for the reporting period
7. THE System SHALL send the Analytics_Report to the Owner's registered email address
8. THE System SHALL format the Analytics_Report as a human-readable HTML email with charts and tables

### Requirement 10: Exception Alert System

**User Story:** As an Owner, I want to receive immediate email alerts for attendance exceptions, so that I can address issues promptly without waiting for daily reports.

#### Acceptance Criteria

1. WHEN the System detects an Attendance_Anomaly of type "Missing Exit" and the Worker has not returned within 2 hours after the typical site closing time, THE System SHALL send an Exception_Alert to the Owner
2. WHEN the System detects an Attendance_Anomaly of type "Excessive Break Time", THE System SHALL send an Exception_Alert to the Owner immediately
3. WHEN a Worker has been absent for 3 consecutive scheduled work days without prior notification, THE System SHALL send an Exception_Alert to the Owner
4. THE Exception_Alert SHALL include the date, Worker name, Worker_Number, and description of the exception
5. THE Exception_Alert SHALL include the most recent Attendance_Events for context
6. THE System SHALL format the Exception_Alert as a human-readable HTML email

### Requirement 11: Offline Operation Capability

**User Story:** As a Field Engineer, I want the system to operate without internet connectivity, so that I can track attendance even when the construction site has limited or no network access.

#### Acceptance Criteria

1. THE System SHALL record Attendance_Events without requiring internet connectivity
2. THE System SHALL calculate Hours_Worked without requiring internet connectivity
3. THE System SHALL detect Attendance_Anomalies without requiring internet connectivity
4. THE System SHALL register new Workers without requiring internet connectivity
5. WHEN internet connectivity is unavailable, THE System SHALL queue Daily_Summary_Reports, Analytics_Reports, and Exception_Alerts for later delivery
6. WHEN internet connectivity is restored, THE System SHALL send all queued reports and alerts in chronological order within 10 minutes
7. THE System SHALL display the current connectivity status to the Field_Engineer

### Requirement 12: Owner Account Configuration

**User Story:** As a Field Engineer, I want to configure the Owner's email address in the system, so that reports and alerts are sent to the correct recipient.

#### Acceptance Criteria

1. THE System SHALL allow the Field_Engineer to configure one or more Owner email addresses
2. THE System SHALL validate that each configured email address follows standard email format before saving
3. WHEN multiple Owner email addresses are configured, THE System SHALL send reports and alerts to all configured addresses
4. THE System SHALL allow the Field_Engineer to update Owner email addresses
5. THE System SHALL allow the Field_Engineer to remove Owner email addresses

### Requirement 13: Data Persistence and Integrity

**User Story:** As a Field Engineer, I want the system to reliably store attendance data, so that data is not lost due to application crashes or power failures.

#### Acceptance Criteria

1. THE System SHALL persist all Worker registration data to local storage immediately upon successful registration
2. THE System SHALL persist each Attendance_Event to local storage within 1 second of recording
3. THE System SHALL persist all Attendance_Anomaly corrections to local storage immediately upon Field_Engineer confirmation
4. WHEN the System restarts after an unexpected shutdown, THE System SHALL restore all Worker data and Attendance_Records without data loss
5. THE System SHALL maintain data integrity by using atomic write operations for all database transactions
6. THE System SHALL create automated backups of all data daily at midnight local time

### Requirement 14: Construction Site Configuration

**User Story:** As a Field Engineer, I want to configure construction site details, so that reports include accurate site identification information.

#### Acceptance Criteria

1. THE System SHALL allow the Field_Engineer to configure construction site name
2. THE System SHALL allow the Field_Engineer to configure construction site location
3. THE System SHALL allow the Field_Engineer to configure typical site operating hours (opening time and closing time)
4. THE System SHALL include the configured construction site name in all Daily_Summary_Reports and Analytics_Reports
5. THE System SHALL use the configured site closing time to determine when to send Exception_Alerts for missing exit events
6. THE System SHALL validate that site closing time is after site opening time before saving configuration

### Requirement 15: Attendance Record Search and Export

**User Story:** As a Field Engineer, I want to search and export attendance records, so that I can provide historical data for audits or analysis.

#### Acceptance Criteria

1. THE System SHALL allow the Field_Engineer to search Attendance_Records by date range
2. THE System SHALL allow the Field_Engineer to search Attendance_Records by Worker_Number or Worker name
3. THE System SHALL allow the Field_Engineer to filter Attendance_Records by Worker_Classification
4. WHEN search criteria are applied, THE System SHALL display matching Attendance_Records with Worker name, date, entry time, exit time, and Hours_Worked
5. THE System SHALL allow the Field_Engineer to export displayed Attendance_Records to CSV format
6. THE System SHALL include column headers in the CSV export file
7. WHEN Attendance_Records are exported, THE System SHALL save the CSV file to a Field_Engineer-specified location on the local file system
