import React, { useEffect, useState } from 'react'
import { Users, CheckCircle2, Activity, CalendarDays, Wallet } from 'lucide-react'
import { attendanceService } from '../services/attendanceService'
import { Alert, LoadingState, EmptyState } from '../components/ui'

interface DailySummary {
  worker_id: number
  worker_number: string
  full_name: string
  classification: string
  hourly_rate: number
  entry_time: string | null
  exit_time: string | null
  break_count: number
  break_minutes: number | null
  hours_worked: number | null
  daily_wage: number | null
  hours_status?: string
}

const Dashboard: React.FC = () => {
  const [summary, setSummary] = useState<DailySummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDailySummary()
    // Refresh while workers are still on site so provisional hours/wages update
    const id = window.setInterval(() => {
      loadDailySummary({ silent: true })
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])

  const loadDailySummary = async (opts: { silent?: boolean } = {}) => {
    try {
      if (!opts.silent) {
        setLoading(true)
      }
      setError(null)
      const data = await attendanceService.getDailySummary()
      setSummary(data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load daily summary')
    } finally {
      if (!opts.silent) {
        setLoading(false)
      }
    }
  }

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—'
    return new Date(timeStr).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatHours = (hours: number | null) => {
    if (hours == null) return '—'
    return `${Number(hours).toFixed(2)}h`
  }

  const formatWage = (wage: number | null) => {
    if (wage == null) return '—'
    return `${Number(wage).toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`
  }

  const formatBreaks = (count: number, minutes: number | null) => {
    if (!count && !minutes) return '0'
    if (minutes == null || minutes === 0) return String(count)
    return `${count} (${minutes}m)`
  }

  if (loading) return <LoadingState label="Loading dashboard…" />

  const completed = summary.filter(w => w.exit_time).length
  const active = summary.filter(w => w.entry_time && !w.exit_time).length
  const totalWages = summary.reduce((sum, w) => sum + (Number(w.daily_wage) || 0), 0)

  return (
    <div className="dashboard">
      {error && (
        <Alert variant="error" message={error} actionLabel="Retry" onAction={loadDailySummary} />
      )}

      <div className="stats-grid stats-grid--4">
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Users size={18} />
            </div>
          </div>
          <div className="stat-value">{summary.length}</div>
          <div className="stat-label">Workers present</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="stat-value">{completed}</div>
          <div className="stat-label">Completed shifts</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Activity size={18} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-label">Active on site</div>
        </div>
        <div className="stat-card">
          <div className="stat-card__top">
            <div className="stat-card__icon">
              <Wallet size={18} />
            </div>
          </div>
          <div className="stat-value stat-value--sm">
            {totalWages.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
          <div className="stat-label">Total wages (RWF)</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Today’s worker attendance</h2>
          <CalendarDays size={18} color="var(--text-faint)" />
        </div>
        <div className="panel__body" style={{ padding: 0 }}>
          {summary.length === 0 ? (
            <EmptyState
              icon={<Users size={24} />}
              title="No attendance yet"
              description="Records will appear here once workers scan in for the day."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Worker #</th>
                    <th>Name</th>
                    <th>Classification</th>
                    <th>Entry</th>
                    <th>Exit</th>
                    <th>Breaks</th>
                    <th>Hours</th>
                    <th>Daily wage</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map(worker => (
                    <tr key={worker.worker_id}>
                      <td>
                        <strong>{worker.worker_number}</strong>
                      </td>
                      <td>{worker.full_name}</td>
                      <td>{worker.classification}</td>
                      <td>{formatTime(worker.entry_time)}</td>
                      <td>{formatTime(worker.exit_time)}</td>
                      <td>{formatBreaks(worker.break_count, worker.break_minutes)}</td>
                      <td>{formatHours(worker.hours_worked)}</td>
                      <td>{formatWage(worker.daily_wage)}</td>
                      <td>
                        <span
                          className={`status-badge ${worker.exit_time ? 'completed' : 'active'}`}
                        >
                          {worker.exit_time ? 'Completed' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
