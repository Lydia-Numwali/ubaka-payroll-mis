import { Pool, PoolClient } from 'pg'
import { BaseRepository } from './BaseRepository'
import { DailyWorkSummary } from '../models/attendance-types'

export class DailyWorkSummaryRepository extends BaseRepository<DailyWorkSummary> {
    constructor() {
        super('daily_work_summary')
    }

    /**
     * Create or update daily work summary
     */
    async upsert(summary: DailyWorkSummary, client?: PoolClient): Promise<DailyWorkSummary> {
        const query = `
            INSERT INTO daily_work_summary (
                worker_id, work_date, schedule_id,
                actual_entry_time, actual_exit_time,
                payable_entry_time, payable_exit_time,
                attendance_status, is_late, late_minutes, late_deduction_amount,
                is_early_departure, early_departure_minutes, early_departure_deduction,
                is_early_arrival,
                total_break_minutes, paid_break_minutes, unpaid_break_minutes, break_count,
                regular_hours_gross, regular_hours_net, overtime_hours, total_payable_hours,
                hourly_rate, regular_pay, overtime_pay, gross_pay, total_deductions, net_pay,
                has_anomalies, anomaly_count, requires_supervisor_review,
                calculation_status, approved_for_payroll
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
                $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
                $30, $31, $32, $33, $34
            )
            ON CONFLICT (worker_id, work_date) 
            DO UPDATE SET
                actual_entry_time = EXCLUDED.actual_entry_time,
                actual_exit_time = EXCLUDED.actual_exit_time,
                payable_entry_time = EXCLUDED.payable_entry_time,
                payable_exit_time = EXCLUDED.payable_exit_time,
                attendance_status = EXCLUDED.attendance_status,
                is_late = EXCLUDED.is_late,
                late_minutes = EXCLUDED.late_minutes,
                late_deduction_amount = EXCLUDED.late_deduction_amount,
                is_early_departure = EXCLUDED.is_early_departure,
                early_departure_minutes = EXCLUDED.early_departure_minutes,
                early_departure_deduction = EXCLUDED.early_departure_deduction,
                is_early_arrival = EXCLUDED.is_early_arrival,
                total_break_minutes = EXCLUDED.total_break_minutes,
                paid_break_minutes = EXCLUDED.paid_break_minutes,
                unpaid_break_minutes = EXCLUDED.unpaid_break_minutes,
                break_count = EXCLUDED.break_count,
                regular_hours_gross = EXCLUDED.regular_hours_gross,
                regular_hours_net = EXCLUDED.regular_hours_net,
                overtime_hours = EXCLUDED.overtime_hours,
                total_payable_hours = EXCLUDED.total_payable_hours,
                hourly_rate = EXCLUDED.hourly_rate,
                regular_pay = EXCLUDED.regular_pay,
                overtime_pay = EXCLUDED.overtime_pay,
                gross_pay = EXCLUDED.gross_pay,
                total_deductions = EXCLUDED.total_deductions,
                net_pay = EXCLUDED.net_pay,
                has_anomalies = EXCLUDED.has_anomalies,
                anomaly_count = EXCLUDED.anomaly_count,
                requires_supervisor_review = EXCLUDED.requires_supervisor_review,
                calculation_status = EXCLUDED.calculation_status,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `

        const values = [
            summary.worker_id,
            summary.work_date,
            summary.schedule_id,
            summary.actual_entry_time,
            summary.actual_exit_time,
            summary.payable_entry_time,
            summary.payable_exit_time,
            summary.attendance_status,
            summary.is_late,
            summary.late_minutes,
            summary.late_deduction_amount,
            summary.is_early_departure,
            summary.early_departure_minutes,
            summary.early_departure_deduction,
            summary.is_early_arrival,
            summary.total_break_minutes,
            summary.paid_break_minutes,
            summary.unpaid_break_minutes,
            summary.break_count,
            summary.regular_hours_gross,
            summary.regular_hours_net,
            summary.overtime_hours,
            summary.total_payable_hours,
            summary.hourly_rate,
            summary.regular_pay,
            summary.overtime_pay,
            summary.gross_pay,
            summary.total_deductions,
            summary.net_pay,
            summary.has_anomalies,
            summary.anomaly_count,
            summary.requires_supervisor_review,
            summary.calculation_status,
            summary.approved_for_payroll,
        ]

        const result = client
            ? await client.query(query, values)
            : await this.pool.query(query, values)

        return result.rows[0]
    }

    /**
     * Find summary by worker and date
     */
    async findByWorkerAndDate(
        workerId: number,
        date: string,
        client?: PoolClient
    ): Promise<DailyWorkSummary | null> {
        const query = `
            SELECT * FROM daily_work_summary
            WHERE worker_id = $1 AND work_date = $2
        `
        const result = client
            ? await client.query(query, [workerId, date])
            : await this.pool.query(query, [workerId, date])

        return result.rows[0] || null
    }

    /**
     * Find summaries for date range
     */
    async findByWorkerAndDateRange(
        workerId: number,
        startDate: string,
        endDate: string
    ): Promise<DailyWorkSummary[]> {
        const query = `
            SELECT * FROM daily_work_summary
            WHERE worker_id = $1 
            AND work_date >= $2 
            AND work_date <= $3
            ORDER BY work_date DESC
        `
        const result = await this.pool.query(query, [workerId, startDate, endDate])
        return result.rows
    }

    /**
     * Find all summaries for a specific date
     */
    async findByDate(date: string): Promise<DailyWorkSummary[]> {
        const query = `
            SELECT dws.*, w.worker_number, w.full_name, w.classification
            FROM daily_work_summary dws
            JOIN worker w ON dws.worker_id = w.id
            WHERE dws.work_date = $1
            ORDER BY w.worker_number
        `
        const result = await this.pool.query(query, [date])
        return result.rows
    }

    /**
     * Find summaries requiring supervisor review
     */
    async findRequiringReview(): Promise<DailyWorkSummary[]> {
        const query = `
            SELECT dws.*, w.worker_number, w.full_name
            FROM daily_work_summary dws
            JOIN worker w ON dws.worker_id = w.id
            WHERE dws.requires_supervisor_review = true
            AND dws.calculation_status != 'APPROVED'
            ORDER BY dws.work_date DESC, w.worker_number
        `
        const result = await this.pool.query(query)
        return result.rows
    }

    /**
     * Approve summary for payroll
     */
    async approve(
        summaryId: number,
        approvedBy: number,
        client?: PoolClient
    ): Promise<void> {
        const query = `
            UPDATE daily_work_summary
            SET 
                calculation_status = 'APPROVED',
                approved_by = $2,
                approved_at = CURRENT_TIMESTAMP,
                approved_for_payroll = true
            WHERE id = $1
        `
        if (client) {
            await client.query(query, [summaryId, approvedBy])
        } else {
            await this.pool.query(query, [summaryId, approvedBy])
        }
    }
}
