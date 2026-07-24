import { AttendanceEventRepository } from '../repositories/AttendanceEventRepository'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { DailyWageRepository } from '../repositories/DailyWageRepository'
import { AttendanceEvent, EventType, HoursWorkedResult } from '../models/types'
import { logger } from '../utils/Logger'

export class AttendanceService {
    private attendanceRepository: AttendanceEventRepository
    private workerRepository: WorkerRepository
    private dailyWageRepository: DailyWageRepository

    constructor() {
        this.attendanceRepository = new AttendanceEventRepository()
        this.workerRepository = new WorkerRepository()
        this.dailyWageRepository = new DailyWageRepository()
    }

    async recordAttendanceEvent(
        workerId: number,
        eventType: EventType,
        timestamp: Date = new Date(),
        isManualEntry: boolean = false,
        createdBy?: string
    ): Promise<AttendanceEvent> {
        const worker = await this.workerRepository.findById(workerId)
        if (!worker) {
            throw new Error(`Worker with ID ${workerId} not found`)
        }
        if (!worker.is_active) {
            throw new Error('Cannot record attendance for inactive worker')
        }

        const todayEvents = await this.attendanceRepository.findByWorkerAndDate(workerId, timestamp)

        const validNextEvents = this.determineNextEventType(todayEvents)
        if (!validNextEvents.includes(eventType)) {
            throw new Error(
                `Invalid event type '${eventType}'. Expected one of: ${validNextEvents.join(', ')}`
            )
        }

        const event = await this.attendanceRepository.recordEvent(
            workerId,
            eventType,
            timestamp,
            isManualEntry,
            createdBy
        )

        // Keep hours / breaks / wage up to date after entry, breaks, or exit
        if (
            eventType === 'ENTRY' ||
            eventType === 'EXIT' ||
            eventType === 'LEAVE_SITE' ||
            eventType === 'RETURN_TO_SITE'
        ) {
            await this.upsertDailyWageProgress(
                workerId,
                timestamp,
                Number(worker.hourly_rate),
                eventType === 'EXIT'
            )
        }

        return event
    }

    /**
     * Persist (or refresh) daily hours & wage.
     * - While still on site: provisional hours (entry → now, minus breaks) and wage
     * - On EXIT: finalized COMPLETE record
     */
    async upsertDailyWageProgress(
        workerId: number,
        date: Date,
        hourlyRate: number,
        finalized: boolean = false
    ): Promise<void> {
        // For in-progress days use wall-clock "now"; EXIT uses the exit event as session end
        const hoursResult = await this.calculateHoursWorked(workerId, date, {
            asOf: finalized ? date : new Date(),
        })
        if (hoursResult.hoursWorked === null) {
            logger.warn('Cannot update daily wage — no entry yet', { workerId })
            return
        }

        const hoursWorked = hoursResult.hoursWorked
        const wageAmount = Math.round(hoursWorked * hourlyRate * 100) / 100

        await this.dailyWageRepository.upsert({
            workerId,
            workDate: date,
            hoursWorked,
            hourlyRate,
            wageAmount,
            entryTime: hoursResult.entryTime,
            exitTime: hoursResult.exitTime,
            breakDurationMs: hoursResult.breakDuration ?? 0,
        })

        logger.info(finalized ? 'Daily wage finalized' : 'Daily wage progress updated', {
            workerId,
            hoursWorked,
            hourlyRate,
            wageAmount,
            breakCount: hoursResult.breakCount,
            status: hoursResult.status,
        })
    }

    /** @deprecated use upsertDailyWageProgress — kept for callers */
    async finalizeDailyWage(
        workerId: number,
        date: Date,
        hourlyRate: number
    ): Promise<void> {
        await this.upsertDailyWageProgress(workerId, date, hourlyRate, true)
    }

    determineNextEventType(events: AttendanceEvent[]): EventType[] {
        if (events.length === 0) {
            return ['ENTRY']
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
                return []
            default:
                throw new Error(`Unknown event type: ${lastEvent.event_type}`)
        }
    }

    async getWorkerEventsForDate(workerId: number, date: Date): Promise<AttendanceEvent[]> {
        return await this.attendanceRepository.findByWorkerAndDate(workerId, date)
    }

    async calculateHoursWorked(
        workerId: number,
        date: Date,
        options: { asOf?: Date } = {}
    ): Promise<HoursWorkedResult> {
        const events = await this.attendanceRepository.findByWorkerAndDate(workerId, date)

        if (events.length === 0) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
                breakCount: 0,
                breakDuration: 0,
            }
        }

        const sortedEvents = events.sort(
            (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        )

        const entryEvent = sortedEvents.find(e => e.event_type === 'ENTRY')
        const exitEvent = sortedEvents.find(e => e.event_type === 'EXIT')

        if (!entryEvent) {
            return {
                hoursWorked: null,
                status: 'INCOMPLETE',
                breakCount: 0,
                breakDuration: 0,
            }
        }

        const asOf = options.asOf ?? new Date()
        const entryTs = new Date(entryEvent.timestamp)
        const lastEventTs = new Date(sortedEvents[sortedEvents.length - 1].timestamp)

        // Past incomplete days: stop at last event, not wall-clock now
        const workDay = new Date(date)
        const sameCalendarDay =
            asOf.getFullYear() === workDay.getFullYear() &&
            asOf.getMonth() === workDay.getMonth() &&
            asOf.getDate() === workDay.getDate()

        const sessionEnd = exitEvent
            ? new Date(exitEvent.timestamp)
            : sameCalendarDay
              ? asOf
              : lastEventTs
        const sessionDuration = sessionEnd.getTime() - entryTs.getTime()

        // Pair LEAVE_SITE → RETURN_TO_SITE chronologically; open leave counts until sessionEnd
        let totalBreakDuration = 0
        let breakCount = 0
        let openLeave: Date | null = null

        for (const event of sortedEvents) {
            const ts = new Date(event.timestamp)
            if (event.event_type === 'LEAVE_SITE') {
                openLeave = ts
                breakCount += 1
            } else if (event.event_type === 'RETURN_TO_SITE' && openLeave) {
                totalBreakDuration += ts.getTime() - openLeave.getTime()
                openLeave = null
            }
        }
        if (openLeave) {
            totalBreakDuration += sessionEnd.getTime() - openLeave.getTime()
        }

        const netDuration = Math.max(0, sessionDuration - totalBreakDuration)
        const hoursWorked = Math.round((netDuration / (1000 * 60 * 60)) * 60) / 60

        return {
            hoursWorked,
            status: exitEvent ? 'COMPLETE' : 'IN_PROGRESS',
            entryTime: entryEvent.timestamp,
            exitTime: exitEvent?.timestamp,
            breakDuration: totalBreakDuration,
            breakCount,
        }
    }

    async getDailySummary(date: Date): Promise<any[]> {
        const rows = await this.attendanceRepository.getDailyAttendanceSummary(date)

        // Refresh hours / wage / breaks for every worker present today
        for (const row of rows) {
            try {
                const hoursResult = await this.calculateHoursWorked(row.worker_id, date)
                if (hoursResult.hoursWorked != null) {
                    await this.upsertDailyWageProgress(
                        row.worker_id,
                        date,
                        Number(row.hourly_rate),
                        hoursResult.status === 'COMPLETE'
                    )
                    const wage = await this.dailyWageRepository.findByWorkerAndDate(
                        row.worker_id,
                        date
                    )
                    if (wage) {
                        row.hours_worked = wage.hours_worked
                        row.daily_wage = wage.wage_amount
                        row.break_minutes = Math.round(
                            Number(wage.break_duration_ms || 0) / 60000
                        )
                    }
                }
                // Prefer live break count from events
                if (hoursResult.breakCount != null) {
                    row.break_count = hoursResult.breakCount
                }
                row.hours_status = hoursResult.status
            } catch (err) {
                logger.warn('Failed to refresh daily summary row', {
                    workerId: row.worker_id,
                    error: (err as Error).message,
                })
            }
        }

        return rows.map(row => ({
            ...row,
            hours_worked: row.hours_worked != null ? Number(row.hours_worked) : null,
            daily_wage: row.daily_wage != null ? Number(row.daily_wage) : null,
            hourly_rate: Number(row.hourly_rate),
            break_count: Number(row.break_count || 0),
            break_minutes:
                row.break_minutes != null
                    ? Number(row.break_minutes)
                    : null,
            hours_status: row.hours_status || (row.exit_time ? 'COMPLETE' : 'IN_PROGRESS'),
        }))
    }

    async getWorkerAttendanceHistory(workerId: number, days: number = 30): Promise<any[]> {
        const events = await this.attendanceRepository.getWorkerAttendanceHistory(workerId, days)

        const eventsByDate: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const dateKey = new Date(event.timestamp).toISOString().split('T')[0]
            if (!eventsByDate[dateKey]) {
                eventsByDate[dateKey] = []
            }
            eventsByDate[dateKey].push(event)
        })

        const history = []
        for (const [dateStr, dateEvents] of Object.entries(eventsByDate)) {
            const date = new Date(dateStr)
            const hoursResult = await this.calculateHoursWorked(workerId, date)
            const wage = await this.dailyWageRepository.findByWorkerAndDate(workerId, date)

            history.push({
                date: dateStr,
                events: dateEvents.length,
                hoursWorked: hoursResult.hoursWorked,
                dailyWage: wage ? Number(wage.wage_amount) : null,
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

        const grouped: { [key: string]: AttendanceEvent[] } = {}

        events.forEach(event => {
            const key = `${event.worker_id}_${new Date(event.timestamp).toISOString().split('T')[0]}`
            if (!grouped[key]) {
                grouped[key] = []
            }
            grouped[key].push(event)
        })

        const records = []
        for (const [key] of Object.entries(grouped)) {
            const [workerIdStr, dateStr] = key.split('_')
            const workerId = parseInt(workerIdStr)
            const worker = await this.workerRepository.findById(workerId)

            if (worker) {
                const date = new Date(dateStr)
                const hoursResult = await this.calculateHoursWorked(workerId, date)
                const wage = await this.dailyWageRepository.findByWorkerAndDate(workerId, date)

                records.push({
                    workerId: worker.id,
                    workerNumber: worker.worker_number,
                    workerName: worker.full_name,
                    classification: worker.classification,
                    date: dateStr,
                    hoursWorked: hoursResult.hoursWorked,
                    dailyWage: wage ? Number(wage.wage_amount) : null,
                    status: hoursResult.status,
                    entryTime: hoursResult.entryTime,
                    exitTime: hoursResult.exitTime,
                })
            }
        }

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
