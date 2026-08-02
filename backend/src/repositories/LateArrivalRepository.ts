import { Pool, PoolClient } from 'pg'
import { BaseRepository } from './BaseRepository'
import { LateArrival } from '../models/attendance-types'

export class LateArrivalRepository extends BaseRepository<LateArrival> {
    constructor() {
        super('late_arrival')
    }

    /**
     * Create late arrival record
     */
    async create(lateArrival: LateArrival, client?: PoolClient): Promise<LateArrival> {
        const query = `
            INSERT INTO late_arrival (
                worker_id, work_date, summary_id,
                scheduled_time, actual_time, late_minutes,
                hourly_rate, deduction_amount, deduction_applied,
                warning_issued, late_count_this_month
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (worker_id, work_date)
            DO UPDATE SET
                late_minutes = EXCLUDED.late_minutes,
                deduction_amount = EXCLUDED.deduction_amount,
                late_count_this_month = EXCLUDED.late_count_this_month
            RETURNING *
        `

        const values = [
            lateArrival.worker_id,
            lateArrival.work_date,
            lateArrival.summary_id,
            lateArrival.scheduled_time,
            lateArrival.actual_time,
            lateArrival.late_minutes,
            lateArrival.hourly_rate,
            lateArrival.deduction_amount,
            lateArrival.deduction_applied,
            lateArrival.warning_issued,
            lateArrival.late_count_this_month,
        ]

        const result = client
            ? await client.query(query, values)
            : await this.pool.query(query, values)

        return result.rows[0]
    }

    /**
     * Get late count for worker in current month
     */
    async getLateCountThisMonth(workerId: number): Promise<number> {
        const query = `
            SELECT COUNT(*) as count
            FROM late_arrival
            WHERE worker_id = $1
            AND work_date >= DATE_TRUNC('month', CURRENT_DATE)
            AND waived = false
        `
        const result = await this.pool.query(query, [workerId])
        return parseInt(result.rows[0].count, 10)
    }

    /**
     * Get late arrivals for worker in date range
     */
    async findByWorkerAndDateRange(
        workerId: number,
        startDate: string,
        endDate: string
    ): Promise<LateArrival[]> {
        const query = `
            SELECT * FROM late_arrival
            WHERE worker_id = $1
            AND work_date >= $2
            AND work_date <= $3
            ORDER BY work_date DESC
        `
        const result = await this.pool.query(query, [workerId, startDate, endDate])
        return result.rows
    }

    /**
     * Get all late arrivals for a specific date
     */
    async findByDate(date: string): Promise<LateArrival[]> {
        const query = `
            SELECT la.*, w.worker_number, w.full_name, w.classification
            FROM late_arrival la
            JOIN worker w ON la.worker_id = w.id
            WHERE la.work_date = $1
            ORDER BY la.late_minutes DESC
        `
        const result = await this.pool.query(query, [date])
        return result.rows
    }

    /**
     * Get all late arrivals in a date range
     */
    async findByDateRange(startDate: string, endDate: string): Promise<LateArrival[]> {
        const query = `
            SELECT la.*, w.worker_number, w.full_name, w.classification
            FROM late_arrival la
            JOIN worker w ON la.worker_id = w.id
            WHERE la.work_date >= $1 AND la.work_date <= $2
            ORDER BY la.work_date DESC, la.late_minutes DESC
        `
        const result = await this.pool.query(query, [startDate, endDate])
        return result.rows
    }

    /**
     * Waive late deduction
     */
    async waive(
        lateArrivalId: number,
        waivedBy: number,
        reason: string,
        client?: PoolClient
    ): Promise<void> {
        const query = `
            UPDATE late_arrival
            SET 
                waived = true,
                waived_by = $2,
                waiver_reason = $3,
                deduction_applied = false
            WHERE id = $1
        `
        if (client) {
            await client.query(query, [lateArrivalId, waivedBy, reason])
        } else {
            await this.pool.query(query, [lateArrivalId, waivedBy, reason])
        }
    }
}
