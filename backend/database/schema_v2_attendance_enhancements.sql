-- ============================================================================
-- UBAKA PAYROLL MIS - ATTENDANCE SYSTEM ENHANCEMENTS
-- Version 2.0 - Enhanced Attendance Tracking & Payroll Calculation
-- ============================================================================

-- ============================================================================
-- 1. WORK SCHEDULES CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Core schedule times
    start_time TIME NOT NULL DEFAULT '07:00:00',  -- Strict start time
    end_time TIME NOT NULL DEFAULT '17:00:00',    -- Standard end time
    standard_hours DECIMAL(4,2) NOT NULL DEFAULT 10.00, -- 10 hours per day
    
    -- Early arrival policy
    early_arrival_allowed BOOLEAN DEFAULT TRUE,
    early_arrival_start_time TIME DEFAULT '05:30:00', -- Can arrive from 5:30 AM
    early_arrival_paid BOOLEAN DEFAULT FALSE, -- Early time NOT paid
    
    -- Lateness policy (NO GRACE PERIOD - strict 7:00 AM)
    late_threshold_minutes INT DEFAULT 0, -- 0 = any minute after 7:00 AM is late
    
    -- Overtime policy
    overtime_allowed BOOLEAN DEFAULT TRUE,
    overtime_start_buffer_minutes INT DEFAULT 15, -- Grace: staying until 5:15 PM not OT
    overtime_requires_approval BOOLEAN DEFAULT TRUE,
    overtime_rate_multiplier DECIMAL(3,2) DEFAULT 1.50, -- 1.5x regular rate
    max_overtime_hours_per_day DECIMAL(4,2) DEFAULT 4.00,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT REFERENCES workers(id),
    
    CONSTRAINT unique_default_schedule UNIQUE (is_default) WHERE is_default = TRUE
);

-- Insert default schedule with strict 7:00 AM rule
INSERT INTO work_schedules (name, description, is_default, start_time, end_time, late_threshold_minutes)
VALUES ('Standard Construction Shift', 'Standard 7:00 AM - 5:00 PM shift with strict 7:00 AM start', TRUE, '07:00:00', '17:00:00', 0)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. BREAK TYPES CONFIGURATION
-- ============================================================================
CREATE TABLE IF NOT EXISTS break_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    
    -- Break characteristics
    is_paid BOOLEAN DEFAULT FALSE,
    min_duration_minutes INT DEFAULT 0,
    max_duration_minutes INT, -- NULL = no limit
    
    -- Authorization
    requires_approval BOOLEAN DEFAULT FALSE,
    auto_approve_within_limit BOOLEAN DEFAULT TRUE,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    display_order INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert standard break types
INSERT INTO break_types (name, description, is_paid, min_duration_minutes, max_duration_minutes, requires_approval) VALUES
('Lunch Break', 'Standard lunch break', FALSE, 30, 60, FALSE),
('Tea Break', 'Short tea/coffee break', TRUE, 10, 15, FALSE),
('Emergency', 'Emergency leave from site', FALSE, NULL, NULL, TRUE),
('Prayer Break', 'Prayer/religious observance', TRUE, 10, 20, FALSE),
('Unauthorized', 'Unrecorded/unauthorized absence', FALSE, NULL, NULL, TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- 3. OVERTIME AUTHORIZATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS overtime_authorizations (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    
    -- Authorization details
    authorized_by INT REFERENCES workers(id), -- Supervisor/Manager
    reason TEXT NOT NULL,
    
    -- Approved overtime window
    approved_start_time TIME NOT NULL DEFAULT '17:00:00',
    approved_end_time TIME NOT NULL,
    approved_hours DECIMAL(4,2) NOT NULL,
    
    -- Status tracking
    status VARCHAR(20) NOT NULL DEFAULT 'APPROVED', 
    -- APPROVED, IN_PROGRESS, COMPLETED, CANCELLED, REJECTED
    
    -- Actual overtime worked (filled after shift)
    actual_start_time TIME,
    actual_end_time TIME,
    actual_hours DECIMAL(4,2),
    payable_hours DECIMAL(4,2), -- MIN(actual, approved)
    
    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_by INT REFERENCES workers(id),
    verified_at TIMESTAMP,
    verification_notes TEXT,
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(worker_id, work_date),
    
    CHECK (approved_hours > 0),
    CHECK (approved_end_time > approved_start_time)
);

CREATE INDEX idx_ot_auth_worker_date ON overtime_authorizations(worker_id, work_date);
CREATE INDEX idx_ot_auth_status ON overtime_authorizations(status) WHERE status != 'CANCELLED';

-- ============================================================================
-- 4. WORKER BREAKS (Detailed Break Tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS worker_breaks (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    break_type_id INT REFERENCES break_types(id),
    
    -- Break timing
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_minutes INT,
    
    -- Authorization
    is_authorized BOOLEAN DEFAULT TRUE,
    is_paid BOOLEAN DEFAULT FALSE,
    authorized_by INT REFERENCES workers(id),
    authorization_notes TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'COMPLETED', -- INCOMPLETE, COMPLETED, FLAGGED
    
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE INDEX idx_worker_breaks_worker_date ON worker_breaks(worker_id, work_date);
CREATE INDEX idx_worker_breaks_status ON worker_breaks(status) WHERE status != 'COMPLETED';

-- ============================================================================
-- 5. DAILY WORK SUMMARY (Payroll Calculation Layer)
-- ============================================================================
CREATE TABLE IF NOT EXISTS daily_work_summary (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    schedule_id INT REFERENCES work_schedules(id),
    
    -- ========================================================================
    -- ACTUAL TIMES (From Fingerprint - Immutable Truth)
    -- ========================================================================
    actual_entry_time TIMESTAMP,        -- First fingerprint of day
    actual_exit_time TIMESTAMP,         -- Last fingerprint of day
    actual_first_break_start TIMESTAMP, -- First break departure
    actual_last_break_end TIMESTAMP,    -- Last break return
    
    -- ========================================================================
    -- PAYABLE TIMES (After Applying Business Rules)
    -- ========================================================================
    payable_entry_time TIMESTAMP,  -- MAX(actual_entry, 7:00 AM)
    payable_exit_time TIMESTAMP,   -- MIN(actual_exit, 5:00 PM) for regular hours
    
    -- ========================================================================
    -- ATTENDANCE STATUS FLAGS
    -- ========================================================================
    attendance_status VARCHAR(20) DEFAULT 'PRESENT', 
    -- PRESENT, ABSENT, LATE, EARLY_DEPARTURE, INCOMPLETE
    
    is_late BOOLEAN DEFAULT FALSE,
    late_minutes INT DEFAULT 0,
    late_deduction_amount DECIMAL(10,2) DEFAULT 0,
    
    is_early_departure BOOLEAN DEFAULT FALSE,
    early_departure_minutes INT DEFAULT 0,
    early_departure_deduction DECIMAL(10,2) DEFAULT 0,
    
    is_early_arrival BOOLEAN DEFAULT FALSE,  -- Arrived before 7:00 AM
    early_arrival_time TIME,                 -- Actual arrival time if early
    
    -- ========================================================================
    -- BREAK TRACKING
    -- ========================================================================
    total_break_minutes INT DEFAULT 0,
    paid_break_minutes INT DEFAULT 0,
    unpaid_break_minutes INT DEFAULT 0,
    unauthorized_break_minutes INT DEFAULT 0,
    break_count INT DEFAULT 0,
    
    -- ========================================================================
    -- HOURS CALCULATION
    -- ========================================================================
    -- Regular hours (7:00 AM - 5:00 PM window, minus breaks)
    regular_hours_gross DECIMAL(4,2) DEFAULT 0,      -- Before any deductions
    regular_hours_net DECIMAL(4,2) DEFAULT 0,        -- After deductions
    
    -- Overtime hours (after 5:00 PM, only if authorized)
    overtime_hours DECIMAL(4,2) DEFAULT 0,
    overtime_authorized BOOLEAN DEFAULT FALSE,
    overtime_authorization_id INT REFERENCES overtime_authorizations(id),
    
    -- Total payable
    total_payable_hours DECIMAL(4,2) DEFAULT 0,  -- regular_net + overtime
    
    -- ========================================================================
    -- FINANCIAL CALCULATIONS
    -- ========================================================================
    hourly_rate DECIMAL(10,2),
    
    regular_pay DECIMAL(10,2) DEFAULT 0,
    overtime_pay DECIMAL(10,2) DEFAULT 0,
    gross_pay DECIMAL(10,2) DEFAULT 0,         -- regular + overtime
    
    total_deductions DECIMAL(10,2) DEFAULT 0,   -- All deductions combined
    net_pay DECIMAL(10,2) DEFAULT 0,            -- gross - deductions
    
    -- ========================================================================
    -- ANOMALIES & QUALITY FLAGS
    -- ========================================================================
    has_anomalies BOOLEAN DEFAULT FALSE,
    anomaly_count INT DEFAULT 0,
    anomalies_resolved BOOLEAN DEFAULT FALSE,
    
    data_quality_score INT DEFAULT 100, -- 0-100, decreases with issues
    requires_supervisor_review BOOLEAN DEFAULT FALSE,
    
    -- ========================================================================
    -- APPROVAL WORKFLOW
    -- ========================================================================
    calculation_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, CALCULATED, REVIEWED, APPROVED, LOCKED
    
    calculated_at TIMESTAMP,
    calculated_by VARCHAR(50) DEFAULT 'SYSTEM',
    
    reviewed_by INT REFERENCES workers(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    
    approved_by INT REFERENCES workers(id),
    approved_at TIMESTAMP,
    approved_for_payroll BOOLEAN DEFAULT FALSE,
    
    -- ========================================================================
    -- AUDIT
    -- ========================================================================
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INT DEFAULT 1, -- Increments on recalculation
    
    UNIQUE(worker_id, work_date),
    
    CHECK (regular_hours_net >= 0),
    CHECK (overtime_hours >= 0),
    CHECK (total_payable_hours >= 0),
    CHECK (net_pay >= 0)
);

CREATE INDEX idx_dws_worker_date ON daily_work_summary(worker_id, work_date);
CREATE INDEX idx_dws_date ON daily_work_summary(work_date);
CREATE INDEX idx_dws_status ON daily_work_summary(calculation_status);
CREATE INDEX idx_dws_requires_review ON daily_work_summary(requires_supervisor_review) WHERE requires_supervisor_review = TRUE;
CREATE INDEX idx_dws_has_anomalies ON daily_work_summary(has_anomalies) WHERE has_anomalies = TRUE;

-- ============================================================================
-- 6. ATTENDANCE ADJUSTMENTS (Supervisor Corrections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS attendance_adjustments (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id) ON DELETE CASCADE,
    anomaly_id INT REFERENCES attendance_anomalies(id),
    
    -- Adjustment details
    adjustment_type VARCHAR(50) NOT NULL,
    -- ADD_MISSING_ENTRY, ADD_MISSING_EXIT, ADD_MISSING_BREAK, 
    -- AUTHORIZE_BREAK, MARK_AUTHORIZED_ABSENCE, OVERRIDE_LATE_STATUS,
    -- ADJUST_HOURS, APPROVE_OVERTIME, CORRECT_CALCULATION
    
    field_adjusted VARCHAR(50), -- Which field was changed
    original_value TEXT,
    adjusted_value TEXT,
    
    reason TEXT NOT NULL,
    impact_description TEXT, -- How this affects payroll
    
    -- Financial impact
    hours_adjustment DECIMAL(4,2) DEFAULT 0,
    pay_adjustment DECIMAL(10,2) DEFAULT 0,
    
    -- Authorization
    adjusted_by INT NOT NULL REFERENCES workers(id),
    adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    approved_by INT REFERENCES workers(id),
    approved_at TIMESTAMP,
    
    -- Audit trail
    recalculation_triggered BOOLEAN DEFAULT TRUE,
    previous_calculation_version INT,
    new_calculation_version INT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_adj_worker_date ON attendance_adjustments(worker_id, work_date);
CREATE INDEX idx_adj_type ON attendance_adjustments(adjustment_type);
CREATE INDEX idx_adj_adjusted_by ON attendance_adjustments(adjusted_by);

-- ============================================================================
-- 7. LATE ARRIVALS TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS late_arrivals (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id) ON DELETE CASCADE,
    
    -- Timing
    scheduled_time TIME NOT NULL DEFAULT '07:00:00',
    actual_time TIME NOT NULL,
    late_minutes INT NOT NULL,
    
    -- Financial impact
    hourly_rate DECIMAL(10,2),
    deduction_amount DECIMAL(10,2) NOT NULL,
    deduction_applied BOOLEAN DEFAULT TRUE,
    
    -- Disciplinary tracking
    severity VARCHAR(20) DEFAULT 'MINOR', -- MINOR, MODERATE, MAJOR
    warning_issued BOOLEAN DEFAULT FALSE,
    warning_level VARCHAR(20), -- VERBAL, WRITTEN, FINAL
    disciplinary_action TEXT,
    
    -- Count in period (for progressive discipline)
    late_count_this_month INT DEFAULT 1,
    late_count_this_quarter INT DEFAULT 1,
    
    -- Approval/waiver
    waived BOOLEAN DEFAULT FALSE,
    waived_by INT REFERENCES workers(id),
    waiver_reason TEXT,
    waived_at TIMESTAMP,
    
    -- Notes
    worker_explanation TEXT,
    supervisor_notes TEXT,
    noted_by INT REFERENCES workers(id),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(worker_id, work_date)
);

CREATE INDEX idx_late_worker_date ON late_arrivals(worker_id, work_date);
CREATE INDEX idx_late_severity ON late_arrivals(severity);
CREATE INDEX idx_late_month ON late_arrivals(work_date) WHERE waived = FALSE;

-- ============================================================================
-- 8. EARLY DEPARTURES TRACKING
-- ============================================================================
CREATE TABLE IF NOT EXISTS early_departures (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id) ON DELETE CASCADE,
    
    -- Timing
    scheduled_end_time TIME NOT NULL DEFAULT '17:00:00',
    actual_exit_time TIME NOT NULL,
    early_minutes INT NOT NULL,
    
    -- Authorization
    authorized BOOLEAN DEFAULT FALSE,
    authorized_by INT REFERENCES workers(id),
    authorization_reason TEXT,
    
    -- Financial impact
    hourly_rate DECIMAL(10,2),
    deduction_amount DECIMAL(10,2),
    deduction_applied BOOLEAN DEFAULT TRUE,
    
    -- Notes
    worker_reason TEXT,
    supervisor_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(worker_id, work_date)
);

CREATE INDEX idx_early_dep_worker_date ON early_departures(worker_id, work_date);
CREATE INDEX idx_early_dep_auth ON early_departures(authorized);

-- ============================================================================
-- 9. ENHANCED ATTENDANCE ANOMALIES
-- ============================================================================
-- Add new anomaly types to existing table
ALTER TABLE attendance_anomalies 
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS requires_immediate_action BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_resolvable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS financial_impact DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_to INT REFERENCES workers(id),
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS resolution_deadline TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON attendance_anomalies(severity) WHERE resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_anomalies_assigned ON attendance_anomalies(assigned_to) WHERE resolved = FALSE;

-- ============================================================================
-- 10. PAYROLL CALCULATION AUDIT LOG
-- ============================================================================
CREATE TABLE IF NOT EXISTS payroll_calculation_log (
    id SERIAL PRIMARY KEY,
    worker_id INT NOT NULL REFERENCES workers(id),
    work_date DATE NOT NULL,
    summary_id INT REFERENCES daily_work_summary(id),
    
    calculation_version INT NOT NULL,
    calculation_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    triggered_by VARCHAR(50), -- SYSTEM, SUPERVISOR_ADJUSTMENT, ANOMALY_RESOLUTION
    
    -- Calculation inputs
    inputs JSONB, -- All input values used
    
    -- Calculation results
    results JSONB, -- All calculated values
    
    -- Rules applied
    rules_applied JSONB, -- Which business rules were used
    
    -- Performance
    calculation_duration_ms INT,
    
    -- Comparison with previous
    previous_version INT,
    changes JSONB, -- What changed from previous version
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calc_log_worker_date ON payroll_calculation_log(worker_id, work_date);
CREATE INDEX idx_calc_log_summary ON payroll_calculation_log(summary_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_work_schedules_updated_at BEFORE UPDATE ON work_schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_overtime_auth_updated_at BEFORE UPDATE ON overtime_authorizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_worker_breaks_updated_at BEFORE UPDATE ON worker_breaks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_work_summary_updated_at BEFORE UPDATE ON daily_work_summary 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Daily attendance summary view
CREATE OR REPLACE VIEW v_daily_attendance_summary AS
SELECT 
    dws.work_date,
    dws.worker_id,
    w.worker_number,
    w.full_name,
    w.classification,
    dws.attendance_status,
    dws.is_late,
    dws.late_minutes,
    dws.is_early_departure,
    dws.actual_entry_time,
    dws.actual_exit_time,
    dws.total_payable_hours,
    dws.regular_hours_net,
    dws.overtime_hours,
    dws.net_pay,
    dws.has_anomalies,
    dws.requires_supervisor_review,
    dws.calculation_status
FROM daily_work_summary dws
JOIN workers w ON dws.worker_id = w.id
WHERE w.status = 'ACTIVE';

-- Worker late arrival history
CREATE OR REPLACE VIEW v_worker_late_history AS
SELECT 
    la.worker_id,
    w.worker_number,
    w.full_name,
    la.work_date,
    la.late_minutes,
    la.deduction_amount,
    la.warning_issued,
    la.warning_level,
    la.waived
FROM late_arrivals la
JOIN workers w ON la.worker_id = w.id
ORDER BY la.work_date DESC;

COMMENT ON SCHEMA public IS 'Ubaka Payroll MIS - Enhanced Attendance & Payroll System v2.0';
