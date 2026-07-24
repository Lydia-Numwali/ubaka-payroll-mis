import { BaseRepository } from './BaseRepository'
import { DailyWage } from '../models/types'

export interface UpsertDailyWageInput {
  workerId: number
  workDate: Date
  hoursWorked: number
  hourlyRate: number
  wageAmount: number
  entryTime?: Date
  exitTime?: Date
  breakDurationMs?: number
}

export class DailyWageRepository extends BaseRepository<DailyWage> {
  constructor() {
    super('daily_wage')
  }

  async upsert(input: UpsertDailyWageInput): Promise<DailyWage> {
    const query = `
      INSERT INTO daily_wage (
        worker_id, work_date, hours_worked, hourly_rate, wage_amount,
        entry_time, exit_time, break_duration_ms
      )
      VALUES ($1, DATE($2), $3, $4, $5, $6, $7, $8)
      ON CONFLICT (worker_id, work_date)
      DO UPDATE SET
        hours_worked = EXCLUDED.hours_worked,
        hourly_rate = EXCLUDED.hourly_rate,
        wage_amount = EXCLUDED.wage_amount,
        entry_time = EXCLUDED.entry_time,
        exit_time = EXCLUDED.exit_time,
        break_duration_ms = EXCLUDED.break_duration_ms,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `

    const result = await this.pool.query(query, [
      input.workerId,
      input.workDate,
      input.hoursWorked,
      input.hourlyRate,
      input.wageAmount,
      input.entryTime ?? null,
      input.exitTime ?? null,
      input.breakDurationMs ?? 0,
    ])
    return result.rows[0]
  }

  async findByWorkerAndDate(workerId: number, date: Date): Promise<DailyWage | null> {
    const query = `
      SELECT * FROM daily_wage
      WHERE worker_id = $1 AND work_date = DATE($2)
    `
    const result = await this.pool.query(query, [workerId, date])
    return result.rows[0] || null
  }
}
