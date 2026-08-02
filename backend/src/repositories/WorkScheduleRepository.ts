import { Pool } from 'pg'
import { BaseRepository } from './BaseRepository'
import { WorkSchedule } from '../models/attendance-types'

export class WorkScheduleRepository extends BaseRepository<WorkSchedule> {
    constructor() {
        super('work_schedule')
    }

    /**
     * Get default work schedule
     */
    async getDefault(): Promise<WorkSchedule> {
        const query = `
            SELECT * FROM work_schedule
            WHERE is_default = true AND is_active = true
            LIMIT 1
        `
        const result = await this.pool.query(query)

        if (result.rows.length === 0) {
            throw new Error('No default work schedule configured')
        }

        return result.rows[0]
    }

    /**
     * Get schedule by ID
     */
    async findById(id: number): Promise<WorkSchedule | null> {
        const query = `SELECT * FROM work_schedule WHERE id = $1`
        const result = await this.pool.query(query, [id])
        return result.rows[0] || null
    }

    /**
     * Get all active schedules
     */
    async findAllActive(): Promise<WorkSchedule[]> {
        const query = `
            SELECT * FROM work_schedule
            WHERE is_active = true
            ORDER BY is_default DESC, name
        `
        const result = await this.pool.query(query)
        return result.rows
    }
}
