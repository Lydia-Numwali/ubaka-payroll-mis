# ⏰ STRICT 7:00 AM RULE - Implementation Guide

## Rule Definition

**START TIME**: 7:00:00 AM (SHARP)  
**GRACE PERIOD**: **0 MINUTES** (NONE)  
**LATE THRESHOLD**: Any time after 7:00:00 AM

---

## How It Works

### ✅ ON TIME
```
Arrival Time: 6:55 AM - 7:00:00 AM
Status: ON TIME
Late Minutes: 0
Deduction: 0 RWF
Payable Start: 7:00 AM
```

### ❌ LATE (Even by 1 Second)
```
Arrival Time: 7:00:01 AM
Status: LATE
Late Minutes: 1 second (rounded to 1 minute)
Deduction: (1/60) × Hourly Rate
Payable Start: 7:00:01 AM
```

---

## Examples with Calculations

### Example 1: 5 Minutes Late
```
Worker: John Doe
Hourly Rate: 2,500 RWF
Arrival Time: 7:05:00 AM
Expected Arrival: 7:00:00 AM

Calculation:
-----------
Late Minutes = 5 minutes
Late Deduction = (5 / 60) × 2,500 = 208.33 RWF

Payable Hours = 10:00 hours - 5 minutes = 9 hours 55 minutes = 9.92 hours
Regular Pay = 9.92 × 2,500 = 24,800 RWF
Final Pay = 24,800 RWF (deduction already applied in hours)

Database Records:
-----------------
daily_work_summary:
  is_late = TRUE
  late_minutes = 5
  late_deduction_amount = 208.33
  payable_entry_time = 2026-08-01 07:05:00
  regular_hours_net = 9.92

late_arrival:
  scheduled_time = 07:00:00
  actual_time = 07:05:00
  late_minutes = 5
  deduction_amount = 208.33
  late_count_this_month = (incremented)
```

### Example 2: 30 Minutes Late
```
Worker: Jane Smith
Hourly Rate: 3,000 RWF
Arrival Time: 7:30:00 AM
Expected Arrival: 7:00:00 AM

Calculation:
-----------
Late Minutes = 30 minutes
Late Deduction = (30 / 60) × 3,000 = 1,500 RWF

Payable Hours = 10:00 hours - 30 minutes = 9.5 hours
Regular Pay = 9.5 × 3,000 = 28,500 RWF

Database Records:
-----------------
daily_work_summary:
  is_late = TRUE
  late_minutes = 30
  late_deduction_amount = 1,500
  regular_hours_net = 9.50

late_arrival:
  late_minutes = 30
  deduction_amount = 1,500
  warning_issued = TRUE (if applicable)
```

### Example 3: Very Late (1 Hour)
```
Worker: Bob Worker
Hourly Rate: 2,000 RWF
Arrival Time: 8:00:00 AM
Expected Arrival: 7:00:00 AM

Calculation:
-----------
Late Minutes = 60 minutes (1 hour)
Late Deduction = (60 / 60) × 2,000 = 2,000 RWF

Payable Hours = 10:00 hours - 1 hour = 9.0 hours
Regular Pay = 9.0 × 2,000 = 18,000 RWF

Flags:
------
- Requires supervisor review (very late)
- May trigger disciplinary action
```

---

## Early Arrival (Before 7:00 AM)

### Important: Early Arrival is NOT Paid

```
Arrival Time: 5:45 AM
Official Start: 7:00 AM
Payable Start: 7:00 AM (NOT 5:45 AM)

Worker arrives at 5:45 AM but is paid from 7:00 AM.
The early 1 hour 15 minutes is recorded but NOT compensated.

Database Records:
-----------------
daily_work_summary:
  actual_entry_time = 2026-08-01 05:45:00
  payable_entry_time = 2026-08-01 07:00:00
  is_early_arrival = TRUE
  is_late = FALSE
  regular_hours_net = 10.00 (full day)
```

---

## Progressive Discipline for Late Arrivals

### Tracking System

Database automatically tracks late arrival frequency:

```sql
SELECT 
    worker_id,
    full_name,
    COUNT(*) as late_count,
    SUM(late_minutes) as total_late_minutes,
    SUM(deduction_amount) as total_deductions
FROM late_arrival la
JOIN worker w ON la.worker_id = w.id
WHERE work_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND waived = FALSE
GROUP BY worker_id, full_name
ORDER BY late_count DESC;
```

### Discipline Levels

```
1-2 Lates/Month:   Verbal Warning (optional)
3-4 Lates/Month:   Written Warning
5-6 Lates/Month:   Final Warning + Suspension consideration
7+ Lates/Month:    Disciplinary Action / Termination review
```

---

## Configuration

### Current Settings (in work_schedule table)

```sql
SELECT 
    name,
    start_time,
    late_threshold_minutes,
    early_arrival_allowed,
    early_arrival_start
FROM work_schedule 
WHERE is_default = TRUE;
```

Result:
```
name: Standard Construction Shift
start_time: 07:00:00
late_threshold_minutes: 0  ← NO GRACE PERIOD
early_arrival_allowed: true
early_arrival_start: 05:30:00
```

### To Change Rules (if needed in future)

```sql
-- Add a grace period (NOT RECOMMENDED, but possible)
UPDATE work_schedule 
SET late_threshold_minutes = 15  -- 15 minute grace
WHERE is_default = TRUE;

-- Change start time
UPDATE work_schedule 
SET start_time = '06:30:00'  -- Start at 6:30 AM instead
WHERE is_default = TRUE;

-- Disable early arrival
UPDATE work_schedule 
SET early_arrival_allowed = FALSE
WHERE is_default = TRUE;
```

---

## Supervisor Waiver System

### When a Late Arrival Can Be Waived

Supervisors can waive late deductions for valid reasons:

```
Valid Reasons:
- Medical emergency
- Vehicle breakdown
- Family emergency  
- Natural disaster
- Company-caused delay (transport, etc.)

Process:
1. Worker explains reason
2. Supervisor reviews explanation
3. Supervisor approves waiver
4. Deduction removed from payroll
5. Late count still recorded (but marked as waived)
```

### Waiver Process

```sql
-- Supervisor waives late deduction
UPDATE late_arrival
SET 
    waived = TRUE,
    waived_by = <supervisor_id>,
    waiver_reason = 'Medical emergency - hospital visit',
    deduction_applied = FALSE
WHERE worker_id = <worker_id>
  AND work_date = '2026-08-01';

-- Update daily work summary to remove deduction
UPDATE daily_work_summary
SET 
    late_deduction_amount = 0,
    total_deductions = total_deductions - <deduction_amount>,
    net_pay = gross_pay
WHERE worker_id = <worker_id>
  AND work_date = '2026-08-01';
```

---

## API Endpoints (To Be Implemented)

### Check if Late
```http
GET /api/attendance/check-late/:workerId/:timestamp

Response:
{
    "is_late": true,
    "scheduled_time": "07:00:00",
    "actual_time": "07:15:00",
    "late_minutes": 15,
    "deduction_amount": 625.00,
    "hourly_rate": 2500
}
```

### Get Late Arrivals for Period
```http
GET /api/attendance/late-arrivals?start_date=2026-08-01&end_date=2026-08-31

Response:
{
    "total_lates": 156,
    "total_deductions": 45600.00,
    "by_worker": [
        {
            "worker_id": 1,
            "worker_name": "John Doe",
            "late_count": 5,
            "total_late_minutes": 45,
            "total_deductions": 1875.00
        }
    ]
}
```

### Waive Late Deduction
```http
POST /api/supervisor/waive-late/:lateArrivalId

Body:
{
    "reason": "Medical emergency - verified by doctor's note",
    "supervisor_id": 5
}

Response:
{
    "success": true,
    "message": "Late deduction waived",
    "deduction_removed": 625.00
}
```

---

## Worker View

### What Workers See

**Attendance Record:**
```
Date: 2026-08-01
Arrival: 7:15 AM ⚠️ LATE (15 minutes)
Departure: 5:00 PM
Hours Worked: 9 hours 45 minutes
Deduction: 625 RWF (Late arrival)
Net Pay: 23,875 RWF
```

**Late History:**
```
August 2026 Late Arrivals: 3
Total Late Minutes: 25
Total Deductions: 1,041.67 RWF
Status: Written Warning issued
```

---

## Reports for Management

### Daily Late Report
```
Date: 2026-08-01
Total Late Workers: 12 / 150 (8%)
Average Late Minutes: 8.5
Total Deductions: 3,500 RWF

Top Late Workers:
1. Worker #045: 25 minutes late (1,041.67 RWF)
2. Worker #078: 18 minutes late (900.00 RWF)
3. Worker #112: 12 minutes late (400.00 RWF)
```

### Monthly Late Trends
```
August 2026:
Week 1: 45 lates
Week 2: 38 lates  
Week 3: 52 lates ↑
Week 4: 41 lates

Most Common Late Time: 7:10-7:20 AM
Repeat Offenders: 15 workers (3+ lates)
```

---

## Technical Implementation

### Calculation Function (Pseudocode)

```typescript
function checkAndCalculateLate(
    workerId: number,
    entryTime: Date,
    hourlyRate: number
): LateCalculation {
    const STRICT_START_TIME = "07:00:00";
    
    // Extract time component
    const entryTimeOnly = entryTime.toTimeString().substr(0, 8);
    
    // Compare (strict - no grace period)
    if (entryTimeOnly > STRICT_START_TIME) {
        // Calculate late minutes
        const scheduledTime = parseTime("07:00:00");
        const actualTime = parseTime(entryTimeOnly);
        const lateMinutes = (actualTime - scheduledTime) / (1000 * 60);
        
        // Calculate deduction
        const deduction = (lateMinutes / 60) * hourlyRate;
        
        // Create late_arrival record
        await createLateArrival({
            worker_id: workerId,
            work_date: entryTime.toDateString(),
            scheduled_time: STRICT_START_TIME,
            actual_time: entryTimeOnly,
            late_minutes: lateMinutes,
            deduction_amount: deduction,
            hourly_rate: hourlyRate
        });
        
        return {
            is_late: true,
            late_minutes: lateMinutes,
            deduction_amount: deduction
        };
    }
    
    return {
        is_late: false,
        late_minutes: 0,
        deduction_amount: 0
    };
}
```

---

## Summary

✅ **No grace period**: Any time after 7:00:00 AM is late  
✅ **Automatic calculation**: System calculates deduction  
✅ **Progressive discipline**: Tracked automatically  
✅ **Supervisor control**: Can waive with justification  
✅ **Audit trail**: All lates recorded permanently  
✅ **Fair system**: Rules applied consistently to everyone  

**The 7:00 AM rule is STRICT and AUTOMATIC. The system enforces punctuality while allowing supervisor discretion for genuine emergencies.**

---

**Last Updated**: 2026-08-01  
**Status**: Implemented in Database Schema ✅  
**Next**: Service Implementation
