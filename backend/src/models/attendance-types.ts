/**
 * Type Definitions for Enhanced Attendance System V2
 */

export interface WorkSchedule {
    id: number
    name: string
    start_time: string // '07:00:00'
    end_time: string // '17:00:00'
    standard_hours: number
    early_arrival_allowed: boolean
    early_arrival_start: string
    overtime_grace_minutes: number
    overtime_rate_multiplier: number
    is_active: boolean
    is_default: boolean
}

export interface DailyWorkSummary {
    id?: number
    worker_id: number
    work_date: string // 'YYYY-MM-DD'
    schedule_id: number

    // Actual times from fingerprint
    actual_entry_time: Date | null
    actual_exit_time: Date | null

    // Payable times after rules
    payable_entry_time: Date | null
    payable_exit_time: Date | null

    // Status flags
    attendance_status: AttendanceStatus
    is_late: boolean
    late_minutes: number
    late_deduction_amount: number
    is_early_departure: boolean
    early_departure_minutes: number
    early_departure_deduction: number
    is_early_arrival: boolean

    // Break tracking
    total_break_minutes: number
    paid_break_minutes: number
    unpaid_break_minutes: number
    break_count: number

    // Hours calculation
    regular_hours_gross: number
    regular_hours_net: number
    overtime_hours: number
    total_payable_hours: number

    // Financial
    hourly_rate: number
    regular_pay: number
    overtime_pay: number
    gross_pay: number
    total_deductions: number
    net_pay: number

    // Anomalies
    has_anomalies: boolean
    anomaly_count: number
    requires_supervisor_review: boolean

    // Approval
    calculation_status: CalculationStatus
    approved_by?: number
    approved_at?: Date
    approved_for_payroll: boolean

    created_at?: Date
    updated_at?: Date
}

export interface LateArrival {
    id?: number
    worker_id: number
    work_date: string
    summary_id?: number
    scheduled_time: string
    actual_time: string
    late_minutes: number
    hourly_rate: number
    deduction_amount: number
    deduction_applied: boolean
    warning_issued: boolean
    late_count_this_month: number
    waived: boolean
    waived_by?: number
    waiver_reason?: string
    created_at?: Date
}

export interface WorkerBreak {
    id?: number
    worker_id: number
    work_date: string
    break_type_id?: number
    start_time: Date
    end_time?: Date
    duration_minutes?: number
    is_authorized: boolean
    is_paid: boolean
    authorized_by?: number
    status: BreakStatus
    created_at?: Date
}

export interface OvertimeAuthorization {
    id?: number
    worker_id: number
    work_date: string
    authorized_by: number
    reason: string
    approved_start_time: string
    approved_end_time: string
    approved_hours: number
    status: OvertimeStatus
    actual_start_time?: string
    actual_end_time?: string
    actual_hours?: number
    payable_hours?: number
    verified: boolean
    verified_by?: number
    verified_at?: Date
    created_at?: Date
}

export interface AttendanceEvent {
    id: number
    worker_id: number
    event_type: EventType
    timestamp: Date
    is_manual_entry?: boolean
    created_by?: string
    created_at: Date
}

export interface AttendanceCalculationInput {
    worker_id: number
    work_date: string
    hourly_rate: number
    events: AttendanceEvent[]
    breaks: WorkerBreak[]
    overtime_auth?: OvertimeAuthorization
    schedule: WorkSchedule
}

export interface AttendanceCalculationResult {
    summary: DailyWorkSummary
    late_arrival?: LateArrival
    anomalies: string[]
    warnings: string[]
}

// Enums
export type AttendanceStatus =
    | 'PRESENT'
    | 'ABSENT'
    | 'LATE'
    | 'EARLY_DEPARTURE'
    | 'INCOMPLETE'

export type CalculationStatus =
    | 'PENDING'
    | 'CALCULATED'
    | 'REVIEWED'
    | 'APPROVED'
    | 'LOCKED'

export type EventType =
    | 'ENTRY'
    | 'EXIT'
    | 'LEAVE_SITE'
    | 'RETURN_TO_SITE'

export type BreakStatus =
    | 'INCOMPLETE'
    | 'COMPLETED'
    | 'FLAGGED'

export type OvertimeStatus =
    | 'PENDING'
    | 'APPROVED'
    | 'IN_PROGRESS'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REJECTED'

export interface BreakType {
    id: number
    name: string
    is_paid: boolean
    min_duration_minutes: number
    max_duration_minutes?: number
    requires_approval: boolean
}
