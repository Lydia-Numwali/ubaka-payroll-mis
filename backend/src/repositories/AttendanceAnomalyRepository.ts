import { BaseRepository } from './BaseRepository'
import { AttendanceAnomaly, AnomalyType } from '../models/types'

export class AttendanceAnomalyRepository extends BaseRepository<AttendanceAnomaly> {
  constructor() {
    super('attendance_anomaly')
  }

  async findByDate(date: Date): Promise<AttendanceAnomaly[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE detection_date = DATE($1)
      ORDER BY created_at DESC
    `
    const result = await this.pool.query(query, [date])
    return result.rows
  }

  async findUnresolved(): Promise<AttendanceAnomaly[]> {
    const query = `
      SELECT aa.*, w.full_name, w.worker_number
      FROM ${this.tableName} aa
      INNER JOIN worker w ON aa.worker_id = w.id
      WHERE aa.is_resolved = false
      ORDER BY aa.detection_date DESC, aa.created_at DESC
    `
    const result = await this.pool.query(query)
    return result.rows
  }

  async findByWorkerAndDateRange(
    workerId: number,
    startDate: Date,
    endDate: Date
  ): Promise<AttendanceAnomaly[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE worker_id = $1
      AND detection_date >= DATE($2)
      AND detection_date <= DATE($3)
      ORDER BY detection_date DESC
    `
    const result = await this.pool.query(query, [workerId, startDate, endDate])
    return result.rows
  }

  async findByType(anomalyType: AnomalyType, resolved?: boolean): Promise<AttendanceAnomaly[]> {
    let query = `
      SELECT aa.*, w.full_name, w.worker_number
      FROM ${this.tableName} aa
      INNER JOIN worker w ON aa.worker_id = w.id
      WHERE aa.anomaly_type = $1
    `
    const values: any[] = [anomalyType]

    if (resolved !== undefined) {
      query += ` AND aa.is_resolved = $2`
      values.push(resolved)
    }

    query += ` ORDER BY aa.detection_date DESC`

    const result = await this.pool.query(query, values)
    return result.rows
  }

  async resolve(anomalyId: number, resolvedBy: string): Promise<AttendanceAnomaly> {
    const query = `
      UPDATE ${this.tableName}
      SET is_resolved = true,
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = $2
      WHERE id = $1
      RETURNING *
    `
    const result = await this.pool.query(query, [anomalyId, resolvedBy])
    return result.rows[0]
  }

  async createAnomaly(
    workerId: number,
    anomalyType: AnomalyType,
    detectionDate: Date,
    description: string
  ): Promise<AttendanceAnomaly> {
    const query = `
      INSERT INTO ${this.tableName} (worker_id, anomaly_type, detection_date, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `
    const result = await this.pool.query(query, [workerId, anomalyType, detectionDate, description])
    return result.rows[0]
  }

  async getAnomalyStats(startDate: Date, endDate: Date): Promise<any> {
    const query = `
      SELECT
        anomaly_type,
        COUNT(*) as count,
        COUNT(CASE WHEN is_resolved = true THEN 1 END) as resolved_count,
        COUNT(CASE WHEN is_resolved = false THEN 1 END) as unresolved_count
      FROM ${this.tableName}
      WHERE detection_date >= DATE($1)
      AND detection_date <= DATE($2)
      GROUP BY anomaly_type
    `
    const result = await this.pool.query(query, [startDate, endDate])
    return result.rows
  }
}
