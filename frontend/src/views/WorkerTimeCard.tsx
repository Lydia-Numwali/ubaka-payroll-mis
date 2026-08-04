import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workerService, Worker } from '../services/workerService';
import attendanceCalculationService, {
    DailyWorkSummary
} from '../services/attendanceCalculationService';
import '../styles/WorkerTimeCard.css';

const WorkerTimeCard: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [worker, setWorker] = useState<Worker | null>(null);
    const [summaries, setSummaries] = useState<DailyWorkSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [startDate, setStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30); // Last 30 days
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [totals, setTotals] = useState({
        totalDays: 0,
        presentDays: 0,
        lateDays: 0,
        totalHours: 0,
        totalPay: 0,
        totalDeductions: 0,
        netPay: 0
    });

    useEffect(() => {
        loadWorkerData();
    }, [id]);

    useEffect(() => {
        if (worker) {
            loadTimecardData();
        }
    }, [worker, startDate, endDate]);

    const loadWorkerData = async () => {
        if (!id) return;

        try {
            const workerData = await workerService.getWorkerById(parseInt(id));
            setWorker(workerData);
        } catch (error) {
            console.error('Error loading worker:', error);
        }
    };

    const loadTimecardData = async () => {
        if (!worker) return;

        setLoading(true);
        try {
            // Generate all dates in range
            const dates = generateDateRange(startDate, endDate);
            const summaryPromises = dates.map(date =>
                attendanceCalculationService.getSummary(worker.id, date)
                    .catch(() => null) // Return null for dates with no data
            );

            const results = await Promise.all(summaryPromises);
            const validSummaries = results.filter(s => s !== null) as DailyWorkSummary[];

            setSummaries(validSummaries);
            calculateTotals(validSummaries);
        } catch (error) {
            console.error('Error loading timecard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateDateRange = (start: string, end: string): string[] => {
        const dates: string[] = [];
        const startDate = new Date(start);
        const endDate = new Date(end);

        while (startDate <= endDate) {
            dates.push(startDate.toISOString().split('T')[0]);
            startDate.setDate(startDate.getDate() + 1);
        }

        return dates;
    };

    const calculateTotals = (summaries: DailyWorkSummary[]) => {
        const totals = summaries.reduce(
            (acc, summary) => {
                if (summary.attendance_status === 'present') {
                    acc.presentDays++;
                }
                if (summary.is_late) {
                    acc.lateDays++;
                }
                acc.totalHours += summary.regular_hours_net || 0;
                acc.totalPay += summary.gross_pay || 0;
                acc.totalDeductions += summary.total_deductions || 0;
                acc.netPay += summary.net_pay || 0;
                return acc;
            },
            {
                totalDays: summaries.length,
                presentDays: 0,
                lateDays: 0,
                totalHours: 0,
                totalPay: 0,
                totalDeductions: 0,
                netPay: 0
            }
        );

        setTotals(totals);
    };

    const formatTime = (timeString?: string) => {
        if (!timeString) return 'N/A';
        return new Date(timeString).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatHours = (hours: number | string) => {
        const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
        return isNaN(numHours) ? '0.00' : numHours.toFixed(2);
    };

    const formatCurrency = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `${isNaN(numAmount) ? '0.00' : numAmount.toFixed(2)} RWF`;
    };

    const getStatusBadge = (status: string) => {
        const badges = {
            present: 'badge-success',
            absent: 'badge-danger',
            incomplete: 'badge-warning',
            requires_review: 'badge-warning'
        };
        return badges[status as keyof typeof badges] || 'badge-secondary';
    };

    if (!worker) {
        return (
            <div className="worker-timecard">
                <div className="loading">Loading worker data...</div>
            </div>
        );
    }

    return (
        <div className="worker-timecard">
            <div className="timecard-header">
                <button onClick={() => navigate('/workers')} className="btn-back">
                    ← Back to Workers
                </button>
                <h1>Time Card</h1>
            </div>

            {/* Worker Info */}
            <div className="worker-info-card">
                <div className="worker-info-header">
                    <div>
                        <h2>{worker.full_name}</h2>
                        <p className="worker-meta">
                            Worker #: {worker.worker_number} | Classification: {worker.classification}
                        </p>
                        <p className="worker-meta">
                            Hourly Rate: {formatCurrency(worker.hourly_rate)}
                        </p>
                    </div>
                    <div className="status-badge">
                        {worker.is_active ? (
                            <span className="badge badge-success">Active</span>
                        ) : (
                            <span className="badge badge-danger">Inactive</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Date Range Filter */}
            <div className="date-filter">
                <label>
                    From:
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        max={endDate}
                    />
                </label>
                <label>
                    To:
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate}
                        max={new Date().toISOString().split('T')[0]}
                    />
                </label>
                <button onClick={loadTimecardData} className="btn btn-primary">
                    Refresh
                </button>
            </div>

            {/* Summary Statistics */}
            <div className="timecard-stats">
                <div className="stat-card">
                    <div className="stat-label">Total Days</div>
                    <div className="stat-value">{totals.totalDays}</div>
                </div>
                <div className="stat-card stat-success">
                    <div className="stat-label">Present</div>
                    <div className="stat-value">{totals.presentDays}</div>
                </div>
                <div className="stat-card stat-danger">
                    <div className="stat-label">Late Days</div>
                    <div className="stat-value">{totals.lateDays}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Total Hours</div>
                    <div className="stat-value">{formatHours(totals.totalHours)}</div>
                </div>
                <div className="stat-card stat-success">
                    <div className="stat-label">Gross Pay</div>
                    <div className="stat-value small-text">{formatCurrency(totals.totalPay)}</div>
                </div>
                <div className="stat-card stat-danger">
                    <div className="stat-label">Deductions</div>
                    <div className="stat-value small-text">{formatCurrency(totals.totalDeductions)}</div>
                </div>
                <div className="stat-card stat-primary">
                    <div className="stat-label">Net Pay</div>
                    <div className="stat-value small-text">{formatCurrency(totals.netPay)}</div>
                </div>
            </div>

            {/* Timecard Table */}
            {loading ? (
                <div className="loading">Loading timecard data...</div>
            ) : summaries.length === 0 ? (
                <div className="no-data">
                    <p>No attendance records found for the selected date range.</p>
                </div>
            ) : (
                <div className="timecard-table-section">
                    <h2>Attendance Records ({summaries.length} days)</h2>
                    <div className="table-responsive">
                        <table className="timecard-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Day</th>
                                    <th>Status</th>
                                    <th>Entry</th>
                                    <th>Exit</th>
                                    <th>Late</th>
                                    <th>Break (Unpaid)</th>
                                    <th>Hours</th>
                                    <th>Regular Pay</th>
                                    <th>OT Pay</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaries.map((summary) => (
                                    <tr key={summary.id} className={summary.is_late ? 'late-row' : ''}>
                                        <td>{summary.work_date}</td>
                                        <td>{new Date(summary.work_date).toLocaleDateString('en-US', { weekday: 'short' })}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(summary.attendance_status)}`}>
                                                {summary.attendance_status}
                                            </span>
                                        </td>
                                        <td>{formatTime(summary.actual_entry_time)}</td>
                                        <td>{formatTime(summary.actual_exit_time)}</td>
                                        <td>
                                            {summary.is_late ? (
                                                <span className="text-danger">
                                                    {summary.late_minutes} min
                                                </span>
                                            ) : (
                                                <span className="text-success">-</span>
                                            )}
                                        </td>
                                        <td>{summary.break_minutes_unpaid ? `${summary.break_minutes_unpaid} min` : '-'}</td>
                                        <td>{formatHours(summary.regular_hours_net)}</td>
                                        <td>{formatCurrency(summary.regular_pay)}</td>
                                        <td>{summary.overtime_pay > 0 ? formatCurrency(summary.overtime_pay) : '-'}</td>
                                        <td className="text-danger">
                                            {summary.total_deductions > 0 ? formatCurrency(summary.total_deductions) : '-'}
                                        </td>
                                        <td className="text-success font-weight-bold">
                                            {formatCurrency(summary.net_pay)}
                                        </td>
                                        <td>
                                            {summary.has_anomaly && (
                                                <span className="badge badge-warning" title={summary.anomaly_description}>
                                                    ⚠️
                                                </span>
                                            )}
                                            {summary.approved_at && (
                                                <span className="badge badge-success" title="Approved for payroll">
                                                    ✓
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="totals-row">
                                    <td colSpan={7}><strong>TOTALS</strong></td>
                                    <td><strong>{formatHours(totals.totalHours)}</strong></td>
                                    <td><strong>{formatCurrency(totals.totalPay)}</strong></td>
                                    <td>-</td>
                                    <td className="text-danger"><strong>{formatCurrency(totals.totalDeductions)}</strong></td>
                                    <td className="text-success"><strong>{formatCurrency(totals.netPay)}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Export Button */}
            {summaries.length > 0 && (
                <div className="export-section">
                    <button className="btn btn-secondary" onClick={() => alert('Export to PDF functionality coming soon!')}>
                        📄 Export to PDF
                    </button>
                    <button className="btn btn-secondary" onClick={() => alert('Export to Excel functionality coming soon!')}>
                        📊 Export to Excel
                    </button>
                </div>
            )}
        </div>
    );
};

export default WorkerTimeCard;
