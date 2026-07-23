export type EventType = 'ENTRY' | 'EXIT' | 'LEAVE_SITE' | 'RETURN_TO_SITE'

export interface Worker {
    id: number
    nid: string
    worker_number: string
    classification: string
    full_name: string
    phone_number?: string
    email_address?: string
    hourly_rate: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface AttendanceEvent {
    id: number
    worker_id: number
    event_type: EventType
    timestamp: string
    is_manual_entry: boolean
    created_by?: string
    created_at: string
}

export interface HoursWorkedResult {
    hoursWorked: number | null
    status: 'COMPLETE' | 'INCOMPLETE'
    entryTime?: string
    exitTime?: string
    breakDuration?: number
}

export interface ApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
    message?: string
}
