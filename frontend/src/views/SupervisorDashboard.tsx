import React, { useState, useEffect } from 'react';
import attendanceCalculationService, {
    DailyWorkSummary,
    DailyReport
} from '../services/attendanceCalculationService';
import '../styles/SupervisorDashboard.css';

const SupervisorDashboard: React.FC = () => {
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
    const [pendingReview, setPendingReview] = useState<DailyWorkSummary[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [selectedSummary, setSelectedSummary] = useState<DailyWorkSummary | null>(null);
    const [showWaiveModal, setShowWaiveModal] = useState<boolean>(false);
    const [waiveReason, setWaiveReason] = useState<string>('');
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadDailyReport();
        loadPendingReview();
    }, [selectedDate]);

    const loadDailyReport = async () => {
        setLoading(true);
        try {
            const report = await attendanceCalculationService.getDailyReport(selectedDate);
            setDailyReport(report);
        } catch (error: any) {
            console.error('Error loading daily report:', error);
            showMessage('error', 'Failed to load daily report');
        } finally {
            setLoading(false);
        }
    };

    const loadPendingReview = async () => {
        try {
            const summaries = await attendanceCalculationService.getPendingReview();
            setPendingReview(summaries);
        } catch (error: any) {
            console.error('Error loading pending reviews:', error);
        }
    };

    const handleBatchCalculate = async () => {
        setLoading(true);
        try {
            const result = await attendanceCalculationService.calculateBatch(selectedDate);
            showMessage(
                'success',
                `Batch calculation complete: ${result.success}/${result.total} workers processed`
            );
            await loadDailyReport();
            await loadPendingReview();
        } catch (error: any) {
            showMessage('error', 'Failed to run batch calculation');
        } finally {
            setLoading(false);
        }
    };

    const handleApproveSummary = async (summary: DailyWorkSummary) => {
        try {
            await attendanceCalculationService.approveSummary(summary.id!, 'Supervisor');
            showMessage('success', `Approved attendance for worker ${summary.worker_id}`);
            await loadPendingReview();
            await loadDailyReport();
        } catch (error: any) {
            showMessage('error', 'Failed to approve summary');
        }
    };

    const handleWaiveLate = (summary: DailyWorkSummary) => {
        setSelectedSummary(summary);
        setShowWaiveModal(true);
    };

    const submitWaiver = async () => {
        if (!selectedSummary || !waiveReason.trim()) {
            showMessage('error', 'Please provide a reason for waiving the late deduction');
            return;
        }

        try {
            // Find the late arrival record for this summary
            const lateRecord = dailyReport?.late_arrivals.find(
                la => la.worker_id === selectedSummary.worker_id && la.work_date === selectedSummary.work_date
            );

            if (lateRecord) {
                await attendanceCalculationService.waiveLateDeduction(lateRecord.id!, {
                    waived_by: 'Supervisor',
                    waiver_reason: waiveReason
                });
                showMessage('success', 'Late deduction waived successfully');
                setShowWaiveModal(false);
                setWaiveReason('');
                await loadDailyReport();
                await loadPendingReview();
            }
        } catch (error: any) {
            showMessage('error', 'Failed to waive late deduction');
        }
    };

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
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

    return (
        <div className="supervisor-dashboard">
            <div className="dashboard-header">
                <h1>Supervisor Dashboard</h1>
                <div className="header-controls">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="date-input"
                    />
                    <button
                        onClick={handleBatchCalculate}
                        className="btn btn-primary"
                        disabled={loading}
                    >
                        {loading ? 'Calculating...' : 'Batch Calculate All Workers'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`message message-${message.type}`}>
                    {message.text}
                </div>
            )}

            {/* Daily Statistics */}
            {dailyReport && (
                <div className="statistics-grid">
                    <div className="stat-card">
                        <div className="stat-label">Total Workers</div>
                        <div className="stat-value">{dailyReport.statistics.total_workers}</div>
                    </div>
                    <div className="stat-card stat-success">
                        <div className="stat-label">Present</div>
                        <div className="stat-value">{dailyReport.statistics.present}</div>
                    </div>
                    <div className="stat-card stat-danger">
                        <div className="stat-label">Late Arrivals</div>
                        <div className="stat-value">{dailyReport.statistics.late}</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-label">Total Hours</div>
                        <div className="stat-value">{formatHours(dailyReport.statistics.total_hours)}</div>
                    </div>
                    <div className="stat-card stat-warning">
                        <div className="stat-label">Total Deductions</div>
                        <div className="stat-value">{formatCurrency(dailyReport.statistics.total_deductions)}</div>
                    </div>
                    <div className="stat-card stat-warning">
                        <div className="stat-label">Requires Review</div>
                        <div className="stat-value">{dailyReport.statistics.requires_review}</div>
                    </div>
                </div>
            )}

            {/* Pending Review Section */}
            {pendingReview.length > 0 && (
                <div className="pending-review-section">
                    <h2>⚠️ Pending Review ({pendingReview.length})</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Worker ID</th>
                                    <th>Date</th>
                                    <th>Entry</th>
                                    <th>Exit</th>
                                    <th>Late</th>
                                    <th>Hours</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Anomaly</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingReview.map((summary) => (
                                    <tr key={summary.id} className="review-row">
                                        <td>{summary.worker_id}</td>
                                        <td>{summary.work_date}</td>
                                        <td>{formatTime(summary.actual_entry_time)}</td>
                                        <td>{formatTime(summary.actual_exit_time)}</td>
                                        <td>
                                            {summary.is_late ? (
                                                <span className="badge badge-danger">
                                                    {summary.late_minutes} min
                                                </span>
                                            ) : (
                                                <span className="badge badge-success">On Time</span>
                                            )}
                                        </td>
                                        <td>{formatHours(summary.regular_hours_net)}</td>
                                        <td className="text-danger">
                                            {formatCurrency(summary.total_deductions)}
                                        </td>
                                        <td>{formatCurrency(summary.net_pay)}</td>
                                        <td>
                                            {summary.has_anomaly && (
                                                <span className="badge badge-warning" title={summary.anomaly_description}>
                                                    ⚠️ {summary.anomaly_description}
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    onClick={() => handleApproveSummary(summary)}
                                                    className="btn btn-sm btn-success"
                                                    title="Approve for payroll"
                                                >
                                                    ✓ Approve
                                                </button>
                                                {summary.is_late && (
                                                    <button
                                                        onClick={() => handleWaiveLate(summary)}
                                                        className="btn btn-sm btn-warning"
                                                        title="Waive late deduction"
                                                    >
                                                        Waive
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Daily Report Table */}
            {dailyReport && dailyReport.summaries.length > 0 && (
                <div className="daily-report-section">
                    <h2>Daily Report - {selectedDate}</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Worker ID</th>
                                    <th>Status</th>
                                    <th>Entry</th>
                                    <th>Exit</th>
                                    <th>Late</th>
                                    <th>Hours (Net)</th>
                                    <th>Regular Pay</th>
                                    <th>Deductions</th>
                                    <th>Net Pay</th>
                                    <th>Approved</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyReport.summaries.map((summary) => (
                                    <tr key={summary.id}>
                                        <td>{summary.worker_id}</td>
                                        <td>
                                            <span className={`badge ${getStatusBadge(summary.attendance_status)}`}>
                                                {summary.attendance_status}
                                            </span>
                                        </td>
                                        <td>{formatTime(summary.actual_entry_time)}</td>
                                        <td>{formatTime(summary.actual_exit_time)}</td>
                                        <td>
                                            {summary.is_late ? (
                                                <span className="text-danger">{summary.late_minutes} min</span>
                                            ) : (
                                                <span className="text-success">-</span>
                                            )}
                                        </td>
                                        <td>{formatHours(summary.regular_hours_net)}</td>
                                        <td>{formatCurrency(summary.regular_pay)}</td>
                                        <td className="text-danger">{formatCurrency(summary.total_deductions)}</td>
                                        <td className="text-success">{formatCurrency(summary.net_pay)}</td>
                                        <td>
                                            {summary.approved_at ? (
                                                <span className="badge badge-success">✓</span>
                                            ) : (
                                                <span className="badge badge-secondary">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Late Arrivals Section */}
            {dailyReport && dailyReport.late_arrivals.length > 0 && (
                <div className="late-arrivals-section">
                    <h2>🚨 Late Arrivals - {selectedDate}</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Worker ID</th>
                                    <th>Scheduled</th>
                                    <th>Actual</th>
                                    <th>Late (min)</th>
                                    <th>Deduction</th>
                                    <th>Late Count (Month)</th>
                                    <th>Waived</th>
                                    <th>Disciplinary Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailyReport.late_arrivals.map((late) => (
                                    <tr key={late.id}>
                                        <td>{late.worker_id}</td>
                                        <td>{late.scheduled_time}</td>
                                        <td>{late.actual_time}</td>
                                        <td className="text-danger">{late.late_minutes}</td>
                                        <td className="text-danger">{formatCurrency(late.deduction_amount)}</td>
                                        <td>
                                            <span className={late.late_count_this_month >= 3 ? 'badge badge-danger' : ''}>
                                                {late.late_count_this_month}
                                            </span>
                                        </td>
                                        <td>
                                            {late.is_waived ? (
                                                <span className="badge badge-success" title={late.waiver_reason}>
                                                    ✓ Waived
                                                </span>
                                            ) : (
                                                <span className="badge badge-secondary">-</span>
                                            )}
                                        </td>
                                        <td>
                                            {late.disciplinary_action && (
                                                <span className="badge badge-warning">{late.disciplinary_action}</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Waive Modal */}
            {showWaiveModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <h3>Waive Late Deduction</h3>
                        <p>Worker ID: {selectedSummary?.worker_id}</p>
                        <p>Date: {selectedSummary?.work_date}</p>
                        <p>Late Minutes: {selectedSummary?.late_minutes}</p>
                        <p>Deduction: {formatCurrency(selectedSummary?.late_deduction_amount || 0)}</p>

                        <div className="form-group">
                            <label>Reason for Waiver (required):</label>
                            <textarea
                                value={waiveReason}
                                onChange={(e) => setWaiveReason(e.target.value)}
                                placeholder="Enter reason (e.g., traffic accident, family emergency, supervisor approved delay)"
                                rows={4}
                                className="form-control"
                            />
                        </div>

                        <div className="modal-actions">
                            <button
                                onClick={submitWaiver}
                                className="btn btn-primary"
                                disabled={!waiveReason.trim()}
                            >
                                Confirm Waiver
                            </button>
                            <button
                                onClick={() => {
                                    setShowWaiveModal(false);
                                    setWaiveReason('');
                                }}
                                className="btn btn-secondary"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {loading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Loading...</p>
                </div>
            )}
        </div>
    );
};

export default SupervisorDashboard;
