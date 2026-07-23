import { BaseRepository } from './BaseRepository'
import { EmailQueue, EmailType, EmailStatus } from '../models/types'

export class EmailQueueRepository extends BaseRepository<EmailQueue> {
  constructor() {
    super('email_queue')
  }

  async queueEmail(
    recipientEmail: string,
    subject: string,
    htmlBody: string,
    emailType: EmailType,
    scheduledAt: Date = new Date()
  ): Promise<EmailQueue> {
    const query = `
      INSERT INTO ${this.tableName} (recipient_email, subject, html_body, email_type, scheduled_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `
    const result = await this.pool.query(query, [
      recipientEmail,
      subject,
      htmlBody,
      emailType,
      scheduledAt,
    ])
    return result.rows[0]
  }

  async findPendingEmails(limit: number = 50): Promise<EmailQueue[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'PENDING'
      AND retry_count < 3
      AND scheduled_at <= CURRENT_TIMESTAMP
      ORDER BY scheduled_at ASC
      LIMIT $1
    `
    const result = await this.pool.query(query, [limit])
    return result.rows
  }

  async markAsSent(emailId: number): Promise<EmailQueue> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'SENT',
          sent_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `
    const result = await this.pool.query(query, [emailId])
    return result.rows[0]
  }

  async markAsFailed(emailId: number, errorMessage: string): Promise<EmailQueue> {
    const query = `
      UPDATE ${this.tableName}
      SET status = 'FAILED',
          error_message = $2,
          retry_count = retry_count + 1
      WHERE id = $1
      RETURNING *
    `
    const result = await this.pool.query(query, [emailId, errorMessage])
    return result.rows[0]
  }

  async findFailedEmails(): Promise<EmailQueue[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE status = 'FAILED'
      AND retry_count >= 3
      ORDER BY created_at DESC
    `
    const result = await this.pool.query(query)
    return result.rows
  }

  async getQueueStats(): Promise<any> {
    const query = `
      SELECT
        status,
        email_type,
        COUNT(*) as count,
        MIN(scheduled_at) as oldest_scheduled,
        MAX(scheduled_at) as newest_scheduled
      FROM ${this.tableName}
      WHERE status = 'PENDING'
      GROUP BY status, email_type
    `
    const result = await this.pool.query(query)
    return result.rows
  }

  async cleanOldEmails(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE status IN ('SENT', 'FAILED')
      AND created_at < NOW() - INTERVAL '${daysOld} days'
    `
    const result = await this.pool.query(query)
    return result.rowCount || 0
  }
}
