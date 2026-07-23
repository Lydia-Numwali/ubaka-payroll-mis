import { Pool } from 'pg'
import DatabaseManager from '../config/database'

export interface QueryCriteria {
  [key: string]: any
}

export abstract class BaseRepository<T> {
  protected pool: Pool
  protected tableName: string

  constructor(tableName: string) {
    this.pool = DatabaseManager.getInstance().getPool()
    this.tableName = tableName
  }

  async create(entity: Partial<T>): Promise<T> {
    const keys = Object.keys(entity)
    const values = Object.values(entity)
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ')
    const columns = keys.join(', ')

    const query = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await this.pool.query(query, values)
    return result.rows[0]
  }

  async findById(id: number): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`
    const result = await this.pool.query(query, [id])
    return result.rows[0] || null
  }

  async findAll(): Promise<T[]> {
    const query = `SELECT * FROM ${this.tableName}`
    const result = await this.pool.query(query)
    return result.rows
  }

  async findWhere(criteria: QueryCriteria): Promise<T[]> {
    const keys = Object.keys(criteria)
    const values = Object.values(criteria)
    const conditions = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ')

    const query = `SELECT * FROM ${this.tableName} WHERE ${conditions}`
    const result = await this.pool.query(query, values)
    return result.rows
  }

  async update(id: number, entity: Partial<T>): Promise<T> {
    const keys = Object.keys(entity)
    const values = Object.values(entity)
    const setClause = keys.map((key, index) => `${key} = $${index + 2}`).join(', ')

    const query = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE id = $1
      RETURNING *
    `

    const result = await this.pool.query(query, [id, ...values])
    return result.rows[0]
  }

  async delete(id: number): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`
    await this.pool.query(query, [id])
  }

  async count(criteria?: QueryCriteria): Promise<number> {
    let query = `SELECT COUNT(*) FROM ${this.tableName}`
    const values: any[] = []

    if (criteria) {
      const keys = Object.keys(criteria)
      const conditions = keys.map((key, index) => `${key} = $${index + 1}`).join(' AND ')
      query += ` WHERE ${conditions}`
      values.push(...Object.values(criteria))
    }

    const result = await this.pool.query(query, values)
    return parseInt(result.rows[0].count)
  }
}
