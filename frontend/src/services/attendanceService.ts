import api from './api'

export type EventType = 'ENTRY' | 'EXIT' | 'LEAVE_SITE' | 'RETURN_TO_SITE'

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

export const attendanceService = {
    async recordEvent(
        workerId: number,
        eventType: EventType,
        timestamp?: Date,
        isManualEntry: boolean = false,
        createdBy?: string
    ): Promise<AttendanceEvent> {
        const response = await api.post('/attendance/events', {
            workerId,
            eventType,
            timestamp: timestamp?.toISOString(),
            isManualEntry,
            createdBy,
        })
        return response.data.data
    },

    async getEventsForDate(workerId: number, date: Date): Promise<AttendanceEvent[]> {
        const dateStr = date.toISOString().split('T')[0]
        const response = await api.get(`/attendance/events/${workerId}/${dateStr}`)
        return response.data.data
    },

    async getNextEventType(workerId: number): Promise<{
        currentEvents: number
        nextEventTypes: EventType[]
        lastEvent: AttendanceEvent | null
    }> {
        const response = await api.get(`/attendance/next-event/${workerId}`)
        return response.data.data
    },

    async calculateHours(workerId: number, date: Date): Promise<HoursWorkedResult> {
        const dateStr = date.toISOString().split('T')[0]
        const response = await api.get(`/attendance/hours/${workerId}/${dateStr}`)
        return response.data.data
    },

    async getWorkerHistory(workerId: number, days: number = 30): Promise<any[]> {
        const response = await api.get(`/attendance/history/${workerId}`, {
            params: { days },
        })
        return response.data.data
    },

    async getDailySummary(date?: Date): Promise<any[]> {
        const dateStr = date ? date.toISOString().split('T')[0] : undefined
        const response = await api.get('/attendance/summary', {
            params: { date: dateStr },
        })
        return response.data.data
    },

    async searchRecords(criteria: {
        workerId?: number
        startDate?: Date
        endDate?: Date
        classification?: string
    }): Promise<any[]> {
        const params: any = {}
        if (criteria.workerId) params.workerId = criteria.workerId
        if (criteria.startDate) params.startDate = criteria.startDate.toISOString().split('T')[0]
        if (criteria.endDate) params.endDate = criteria.endDate.toISOString().split('T')[0]
        if (criteria.classification) params.classification = criteria.classification

        const response = await api.get('/attendance/search', { params })
        return response.data.data
    },
}
