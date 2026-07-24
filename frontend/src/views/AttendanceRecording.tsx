import React, { useState, useEffect } from 'react'
import {
  Fingerprint,
  Search,
  LogIn,
  LogOut,
  MapPinOff,
  MapPin,
  UserRound,
  X,
} from 'lucide-react'
import { attendanceService, EventType, AttendanceEvent } from '../services/attendanceService'
import { workerService, Worker } from '../services/workerService'
import fingerprintService from '../services/fingerprintService'
import { useToast } from '../components/Toast'

const AttendanceRecording: React.FC = () => {
  const toast = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [selectedWorker, setSelectedWorker] = useState<Worker | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredWorkers, setFilteredWorkers] = useState<Worker[]>([])
  const [nextEventTypes, setNextEventTypes] = useState<EventType[]>([])
  const [recentEvents, setRecentEvents] = useState<AttendanceEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadWorkers()
  }, [])

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredWorkers([])
    } else {
      const filtered = workers.filter(
        worker =>
          worker.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.worker_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.nid.includes(searchTerm)
      )
      setFilteredWorkers(filtered.slice(0, 5))
    }
  }, [searchTerm, workers])

  useEffect(() => {
    if (selectedWorker) {
      loadNextEventTypes()
      loadRecentEvents()
    }
  }, [selectedWorker])

  const loadWorkers = async () => {
    try {
      const data = await workerService.getAllWorkers(false)
      setWorkers(data)
    } catch {
      toast.error('Failed to load workers')
    }
  }

  const loadNextEventTypes = async () => {
    if (!selectedWorker) return
    try {
      const data = await attendanceService.getNextEventType(selectedWorker.id)
      setNextEventTypes(data.nextEventTypes)
    } catch (err) {
      console.error('Failed to load next event types:', err)
    }
  }

  const loadRecentEvents = async () => {
    if (!selectedWorker) return
    try {
      const data = await attendanceService.getEventsForDate(selectedWorker.id, new Date())
      setRecentEvents(data)
    } catch (err) {
      console.error('Failed to load recent events:', err)
    }
  }

  const handleWorkerSelect = (worker: Worker) => {
    setSelectedWorker(worker)
    setSearchTerm('')
    setFilteredWorkers([])
  }

  const handleFingerprintScan = async () => {
    try {
      setScanning(true)

      const result = await fingerprintService.identify()
      const matched = result?.worker

      if (matched) {
        handleWorkerSelect(result.worker as unknown as Worker)
        toast.success(
          `Identified ${matched.full_name} (${Math.round((result.confidence || 0) * 100)}% match)`
        )
      } else {
        toast.error('Fingerprint not recognized. Search manually instead.')
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Fingerprint not recognized'
      if (msg.toLowerCase().includes('not recognized') || err?.response?.status === 404) {
        toast.error('Fingerprint not recognized. Search manually instead.')
      } else {
        toast.error(`Scanner error: ${msg}`)
      }
    } finally {
      setScanning(false)
    }
  }

  const handleRecordEvent = async (eventType: EventType) => {
    if (!selectedWorker) {
      toast.error('Select a worker first')
      return
    }

    try {
      setLoading(true)

      await attendanceService.recordEvent(selectedWorker.id, eventType, new Date(), false)
      toast.success(`${getEventTypeLabel(eventType)} recorded for ${selectedWorker.full_name}`)

      await loadNextEventTypes()
      await loadRecentEvents()

      setTimeout(() => {
        setSelectedWorker(null)
      }, 2000)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record event')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })

  const getEventTypeLabel = (eventType: EventType): string => {
    const labels: Record<EventType, string> = {
      ENTRY: 'Entry',
      EXIT: 'Exit',
      LEAVE_SITE: 'Leave site',
      RETURN_TO_SITE: 'Return to site',
    }
    return labels[eventType]
  }

  return (
    <div className="attendance-recording">
      <div className="recording-layout">
        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Identify worker</h2>
          </div>
          <div className="panel__body">
            <div className="scan-hero">
              <div className={`scan-hero__ring${scanning ? ' scan-hero__ring--busy' : ''}`}>
                <Fingerprint size={36} strokeWidth={2} />
              </div>
              <h3>{scanning ? 'Waiting for finger…' : 'Fingerprint scan'}</h3>
              <p>Place the worker’s finger on the Live20R sensor to identify them.</p>
              <button
                className="btn btn-primary"
                onClick={handleFingerprintScan}
                disabled={loading || scanning}
              >
                <Fingerprint size={18} />
                {scanning ? 'Scanning…' : 'Scan fingerprint'}
              </button>
            </div>

            <div className="divider-or">OR</div>

            <div className="form-group">
              <label>Search worker</label>
              <div className="search-bar" style={{ maxWidth: 'none', width: '100%' }}>
                <Search className="search-bar__icon" size={18} />
                <input
                  type="search"
                  placeholder="Name, worker #, or NID…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {filteredWorkers.length > 0 && (
                <div className="search-results">
                  {filteredWorkers.map(worker => (
                    <div
                      key={worker.id}
                      className="search-result-item"
                      onClick={() => handleWorkerSelect(worker)}
                    >
                      <div className="worker-info">
                        <span className="worker-name">{worker.full_name}</span>
                        <span className="worker-number">#{worker.worker_number}</span>
                      </div>
                      <span className="worker-classification">{worker.classification}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedWorker && (
              <div className="selected-worker-card">
                <div>
                  <h4>{selectedWorker.full_name}</h4>
                  <p>#{selectedWorker.worker_number} · {selectedWorker.classification}</p>
                  <p>NID {selectedWorker.nid}</p>
                </div>
                <button
                  className="btn-icon"
                  title="Clear selection"
                  onClick={() => setSelectedWorker(null)}
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Record event</h2>
          </div>
          <div className="panel__body">
            {!selectedWorker ? (
              <div className="no-worker-message">
                <UserRound size={28} style={{ margin: '0 auto 0.75rem', opacity: 0.45 }} />
                <p>Select a worker to enable attendance actions</p>
              </div>
            ) : (
              <>
                <p className="field-hint" style={{ marginBottom: '0.35rem' }}>
                  Available actions
                </p>
                <div className="event-type-pills">
                  {nextEventTypes.length === 0 ? (
                    <span className="event-type-badge">Loading…</span>
                  ) : (
                    nextEventTypes.map(type => (
                      <span key={type} className="event-type-badge">
                        {getEventTypeLabel(type)}
                      </span>
                    ))
                  )}
                </div>

                <div className="event-grid">
                  <button
                    className="btn-event btn-entry"
                    onClick={() => handleRecordEvent('ENTRY')}
                    disabled={loading || !nextEventTypes.includes('ENTRY')}
                  >
                    <span className="btn-event__icon">
                      <LogIn size={18} />
                    </span>
                    Entry
                  </button>
                  <button
                    className="btn-event btn-exit"
                    onClick={() => handleRecordEvent('EXIT')}
                    disabled={loading || !nextEventTypes.includes('EXIT')}
                  >
                    <span className="btn-event__icon">
                      <LogOut size={18} />
                    </span>
                    Exit
                  </button>
                  <button
                    className="btn-event btn-leave"
                    onClick={() => handleRecordEvent('LEAVE_SITE')}
                    disabled={loading || !nextEventTypes.includes('LEAVE_SITE')}
                  >
                    <span className="btn-event__icon">
                      <MapPinOff size={18} />
                    </span>
                    Leave site
                  </button>
                  <button
                    className="btn-event btn-return"
                    onClick={() => handleRecordEvent('RETURN_TO_SITE')}
                    disabled={loading || !nextEventTypes.includes('RETURN_TO_SITE')}
                  >
                    <span className="btn-event__icon">
                      <MapPin size={18} />
                    </span>
                    Return to site
                  </button>
                </div>

                {recentEvents.length > 0 && (
                  <div className="events-timeline">
                    <h4>Today’s events — {selectedWorker.full_name}</h4>
                    {recentEvents.map(event => (
                      <div key={event.id} className="event-item">
                        <span className="event-item__dot" />
                        <span className="event-item__type">
                          {getEventTypeLabel(event.event_type)}
                        </span>
                        <span className="event-item__time">{formatTime(event.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AttendanceRecording
