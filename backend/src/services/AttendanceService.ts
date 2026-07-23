import { AttendanceEventRepository } from '../repositories/AttendanceEventRepository'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { AttendanceEvent, EventType, HoursWorkedResult } from '../models/types'

export class AttendanceService {
    private attendanceRepository: AttendanceEventRepository
    private workerRepository: WorkerRepository

    constructor() {
        this.attendanceRepository = new AttendanceEventRepository()
        this.workerRepository = new WorkerRepository()
    }

    async recordAttendanceEvent(
        workerId: number,
        eventType: EventType,
        timestamp: Date = new Date(),
        isManualEntry: boolean = false,
        createdBy?: string
    ): Promise<AttendanceEvent> {
        // Verify worker exists and is active
        const worker = await this.workerRepository.findById(workerId)
        if (!worker) {
            throw new Error(`Worker with ID ${workerId} not found`)
        }
        if (!worker.is_active) {
            throw new Error('Cannot record attendance for inactive worker')
        }

        // Get today's events for this worker
        const todayEvents = await this.attendanceRepository.findByWorkerAndDate(workerId, timestamp)

        // Validate event type based on current state
        const validNextEvents = this.determineNextEventType(todayEvents)
        if (!validNextEvents.includes(eventType)) {
            throw new Error(
                `Invalid event type '${eventType}'. Expected one of: ${validNextEvents.join(', ')}`
            )
        }

        // Record the event
        return await this.attendanceRepository.recordEvent(
            workerId,
            eventType,
            timestamp,
            isManualEntry,
            createdBy
        )
    }

    determineNextEventType(events: AttendanceEvent[]): EventType[] {
        if (events.length === 0) {
            return ['ENTRY'] // First event must be entry
        }

        const lastEvent = events[events.length - 1]

        switch (lastEvent.event_type) {
            case 'ENTRY':
                return ['LEAVE_SITE', 'EXIT']
            case 'LEAVE_SITE':
                return ['RETURN_TO_SITE']
            case 'RETURN_TO_SITE':
                return ['LEAVE_SITE', 'EXIT']
            case 'EXIT':
                return [] // No more events allowed after exit
            default:
                throw new Error(`Unknown event type: ${lastEvent.event_type}`)
        }
    }

    async getWorkerEventsForDate(workerId: number, date: Date): Promise<AttendanceEvent[]> {
        return await this.attendanceRepository.findByWorkerAndDate(workerId, date)
    }

    async calculateHoursWorked(workerId: number, date: Date): Promise<HoursWorkedResult> {
        const events = await this.attendanceRepository.findByWorkerAndDate(workerId, date)

        if (events.length === 0) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
            }
        }

        // Sort events chronologically
        const sortedEvents = events.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        // Find entry and exit
        const entryEvent = sortedEvents.find(e => e.event_type === 'ENTRY')
        const exitEvent = sortedEvents.find(e => e.event_type === 'EXIT')

        if (!entryEvent || !exitEvent) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
                entryTime: entryEvent?.timestamp,
            }
        }

        // Calculate total session duration
        const sessionDuration =
            new Date(exitEvent.timestamp).getTime() - new Date(entryEvent.timestamp).getTime()

        // Calculate break periods
        let totalBreakDuration = 0
        const leaveEvents = sortedEvents.filter(e => e.event_type === 'LEAVE_SITE')
        const returnEvents = sortedEvents.filter(e => e.event_type === 'RETURN_TO_SITE')

        for (let i = 0; i < Math.min(leaveEvents.length, returnEvents.length); i++) {
            const breakDuration =
                new Date(returnEvents[i].timestamp).getTime() - new Date(leaveEvents[i].timestamp).getTime()
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
            breakDuration: totalBreakDuration,
        }
    }

    async getDailySummary(date: Date): Promise<any[]> {
        return await this.attendanceRepository.getDailyAttendanceSummary(date)
    }

    async getWorkerAttendanceHistory(workerId: number, days: number = 30): Promise<any[]> {
        const events = await this.attendanceRepository.getWorkerAttendanceHistory(workerId, days)

        // Group events by date
        const eventsByDate: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const dateKey = new Date(event.timestamp).toISOString().split('T')[0]
            if (!eventsByDate[dateKey]) {
                eventsByDate[dateKey] = []
            }
            eventsByDate[dateKey].push(event)
        })

        // Calculate hours for each date
        const history = []
        for (const [dateStr, dateEvents] of Object.entries(eventsByDate)) {
            const date = new Date(dateStr)
            const hoursResult = await this.calculateHoursWorked(workerId, date)

            history.push({
                date: dateStr,
                events: dateEvents.length,
                hoursWorked: hoursResult.hoursWorked,
                status: hoursResult.status,
                entryTime: hoursResult.entryTime,
                exitTime: hoursResult.exitTime,
            })
        }

        return history.sort((a, b) => b.date.localeCompare(a.date))
    }

    async searchAttendanceRecords(criteria: {
        workerId?: number
        startDate?: Date
        endDate?: Date
        classification?: string
    }): Promise<any[]> {
        const { startDate, endDate } = criteria

        if (!startDate || !endDate) {
            throw new Error('Start date and end date are required')
        }

        const events = await this.attendanceRepository.findByDateRange(startDate, endDate)

        // Group by worker and date
        const grouped: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const key = `${event.worker_id}_${new Date(event.timestamp).toISOString().split('T')[0]}`
            if (!grouped[key]) {
                grouped[key] = []
            }
            grouped[key].push(event)
        })

        // Build records
        const records = []
        for (const [key, eventGroup] of Object.entries(grouped)) {
            const [workerIdStr, dateStr] = key.split('_')
            const workerId = parseInt(workerIdStr)
            const worker = await this.workerRepository.findById(workerId)

            if (worker) {
                const date = new Date(dateStr)
                const hoursResult = await this.calculateHoursWorked(workerId, date)

                records.push({
                    workerId: worker.id,
                    workerNumber: worker.worker_number,
                    workerName: worker.full_name,
                    classification: worker.classification,
                    date: dateStr,
                    hoursWorked: hoursResult.hoursWorked,
                    status: hoursResult.status,
                    entryTime: hoursResult.entryTime,
                    exitTime: hoursResult.exitTime,
                })
            }
        }

        // Apply filters
        let filtered = records
        if (criteria.workerId) {
            filtered = filtered.filter(r => r.workerId === criteria.workerId)
        }
        if (criteria.classification) {
            filtered = filtered.filter(r => r.classification === criteria.classification)
        }

        return filtered.sort((a, b) => b.date.localeCompare(a.date))
    }
}
