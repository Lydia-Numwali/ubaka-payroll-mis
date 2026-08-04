import React, { useState } from 'react';
import reportService, {
    MonthlyReportData,
    LateArrivalTrends,
    PayrollExportData
} from '../services/reportService';
import '../styles/Reports.css';

type ReportType = 'monthly' | 'late-trends' | 'payroll';

const Reports: React.FC = () => {
    const [reportType, setReportType] = useState<ReportType>('monthly');
    const [loading, setLoading] = useState<boolean>(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Monthly Report State
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null);

    // Late Trends State
    const [lateStartDate, setLateStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [lateEndDate, setLateEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [lateTrends, setLateTrends] = useState<LateArrivalTrends | null>(null);

    // Payroll Export State
    const [payrollStartDate, setPayrollStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(1); // First day of month
        return date.toISOString().split('T')[0];
    });
    const [payrollEndDate, setPayrollEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [payrollData, setPayrollData] = useState<PayrollExportData | null>(null);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleGenerateMonthlyReport = async () => {
        setLoading(true);
        try {
            const report = await reportService.getMonthlyReport(selectedYear, selectedMonth);
            setMonthlyReport(report);
            showMessage('success', 'Monthly report generated successfully');
        } catch (error: any) {
            showMessage('error', 'Failed to generate monthly report');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateLateTrends = async () => {
        setLoading(true);
        try {
            const trends = await reportService.getLateTrends(lateStartDate, lateEndDate);
            setLateTrends(trends);
            showMessage('success', 'Late arrival trends generated successfully');
        } catch (error: any) {
            showMessage('error', 'Failed to generate late arrival trends');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayroll = async () => {
        setLoading(true);
        try {
            const data = await reportService.getPayrollExport(payrollStartDate, payrollEndDate);
            setPayrollData(data);
            showMessage('success', 'Payroll data generated successfully');
        } catch (error: any) {
            showMessage('error', 'Failed to generate payroll data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCSV = async () => {
        setLoading(true);
        try {
            await reportService.downloadPayrollCSV(payrollStartDate, payrollEndDate);
            showMessage('success', 'Payroll CSV downloaded successfully');
        } catch (error: any) {
            showMessage('error', 'Failed to download CSV');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number | string) => {
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        return `${isNaN(numAmount) ? '0.00' : numAmount.toFixed(2)} RWF`;
    };

    const formatHours = (hours: number | string) => {
        const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
        return isNaN(numHours) ? '0.00' : numHours.toFixed(2);
    };

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div className="reports">
            <div className="reports-header">
                <h1>Reports & Analytics</h1>
                <div className="report-tabs">
                    <button
                        className={`tab ${reportType === 'monthly' ? 'active' : ''}`}
                        onClick={() => setReportType('monthly')}
                    >
                        📊 Monthly Report
                    </button>
                    <button
                        className={`tab ${reportType === 'late-trends' ? 'active' : ''}`}
                        onClick={() => setReportType('late-trends')}
                    >
                        📈 Late Trends
                    </button>
                    <button
                        className={`tab ${reportType === 'payroll' ? 'active' : ''}`}
                        onClick={() => setReportType('payroll')}
                    >
                        💰 Payroll Export
                    </button>
                </div>
            </div>

            {message && (
                <div className={`message message-${message.type}`}>{message.text}</div>
            )}

            {/* Monthly Report Tab */}
            {reportType === 'monthly' && (
                <div className="report-content">
                    <div className="report-controls">
                        <div className="form-group">
                            <label>Year:</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
                                {[2024, 2025, 2026, 2027].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Month:</label>
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
                                {months.map((month, index) => (
                                    <option key={index} value={index + 1}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleGenerateMonthlyReport} className="btn btn-primary" disabled={loading}>
                            {loading ? 'Generating...' : 'Generate Report'}
                        </button>
                    </div>

                    {monthlyReport && (
                        <div className="report-results">
                            <h2>{monthlyReport.month} {monthlyReport.year} - Monthly Report</h2>

                            <div className="stats-grid">
                                <div className="stat-card">
                                    <div className="stat-label">Total Workers</div>
                                    <div className="stat-value">{monthlyReport.summary.total_workers}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Total Days</div>
                                    <div className="stat-value">{monthlyReport.summary.total_days}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Total Hours</div>
                                    <div className="stat-value">{formatHours(monthlyReport.summary.total_hours)}</div>
                                </div>
                                <div className="stat-card stat-success">
                                    <div className="stat-label">Total Pay</div>
                                    <div className="stat-value small">{formatCurrency(monthlyReport.summary.total_regular_pay)}</div>
                                </div>
                                <div className="stat-card stat-danger">
                                    <div className="stat-label">Total Deductions</div>
                                    <div className="stat-value small">{formatCurrency(monthlyReport.summary.total_deductions)}</div>
                                </div>
                                <div className="stat-card stat-primary">
                                    <div className="stat-label">Net Pay</div>
                                    <div className="stat-value small">{formatCurrency(monthlyReport.summary.total_net_pay)}</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-label">Avg Hours/Worker</div>
                                    <div className="stat-value">{formatHours(monthlyReport.summary.average_hours_per_worker)}</div>
                                </div>
                                <div className="stat-card stat-warning">
                                    <div className="stat-label">Late Rate</div>
                                    <div className="stat-value">{(typeof monthlyReport.summary.late_arrival_rate === 'string' ? parseFloat(monthlyReport.summary.late_arrival_rate) : monthlyReport.summary.late_arrival_rate).toFixed(1)}%</div>
                                </div>
                            </div>

                            <div className="table-section">
                                <h3>Worker Details</h3>
                                <div className="table-responsive">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Worker #</th>
                                                <th>Name</th>
                                                <th>Classification</th>
                                                <th>Days Present</th>
                                                <th>Days Late</th>
                                                <th>Late %</th>
                                                <th>Total Hours</th>
                                                <th>Regular Pay</th>
                                                <th>Deductions</th>
                                                <th>Net Pay</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {monthlyReport.workers.map(worker => (
                                                <tr key={worker.worker_id}>
                                                    <td>{worker.worker_number}</td>
                                                    <td>{worker.full_name}</td>
                                                    <td>{worker.classification}</td>
                                                    <td>{worker.days_present}</td>
                                                    <td className={worker.days_late > 0 ? 'text-danger' : ''}>{worker.days_late}</td>
                                                    <td className={worker.late_percentage > 10 ? 'text-danger' : ''}>{(typeof worker.late_percentage === 'string' ? parseFloat(worker.late_percentage) : worker.late_percentage).toFixed(1)}%</td>
                                                    <td>{formatHours(worker.total_hours)}</td>
                                                    <td>{formatCurrency(worker.regular_pay)}</td>
                                                    <td className="text-danger">{formatCurrency(worker.deductions)}</td>
                                                    <td className="text-success">{formatCurrency(worker.net_pay)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* Late Trends Tab */}
            {
                reportType === 'late-trends' && (
                    <div className="report-content">
                        <div className="report-controls">
                            <div className="form-group">
                                <label>From:</label>
                                <input type="date" value={lateStartDate} onChange={(e) => setLateStartDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>To:</label>
                                <input type="date" value={lateEndDate} onChange={(e) => setLateEndDate(e.target.value)} />
                            </div>
                            <button onClick={handleGenerateLateTrends} className="btn btn-primary" disabled={loading}>
                                {loading ? 'Generating...' : 'Generate Trends'}
                            </button>
                        </div>

                        {lateTrends && (
                            <div className="report-results">
                                <h2>Late Arrival Trends Analysis</h2>
                                <p className="report-subtitle">Period: {lateTrends.period.start_date} to {lateTrends.period.end_date}</p>

                                <div className="table-section">
                                    <h3>🏆 Top Offenders</h3>
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Late Count</th>
                                                    <th>Total Late Minutes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lateTrends.top_offenders.map((worker, index) => (
                                                    <tr key={worker.worker_id} className={index < 3 ? 'highlight-row' : ''}>
                                                        <td className="text-center font-bold">{index + 1}</td>
                                                        <td>{worker.worker_number}</td>
                                                        <td>{worker.full_name}</td>
                                                        <td className="text-danger font-bold">{worker.late_count}</td>
                                                        <td className="text-danger">{(typeof worker.total_late_minutes === 'string' ? parseFloat(worker.total_late_minutes) : worker.total_late_minutes).toFixed(0)} min</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <div className="table-section">
                                    <h3>📊 Worker Statistics</h3>
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Total Lates</th>
                                                    <th>Avg Late Minutes</th>
                                                    <th>Total Deductions</th>
                                                    <th>Trend</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lateTrends.worker_stats.map(worker => (
                                                    <tr key={worker.worker_id}>
                                                        <td>{worker.worker_number}</td>
                                                        <td>{worker.full_name}</td>
                                                        <td>{worker.total_lates}</td>
                                                        <td>{(typeof worker.average_late_minutes === 'string' ? parseFloat(worker.average_late_minutes) : worker.average_late_minutes).toFixed(1)} min</td>
                                                        <td className="text-danger">{formatCurrency(worker.total_deductions)}</td>
                                                        <td>
                                                            <span className={`trend-badge trend-${worker.trend}`}>
                                                                {worker.trend === 'improving' && '📈 Improving'}
                                                                {worker.trend === 'worsening' && '📉 Worsening'}
                                                                {worker.trend === 'stable' && '➡️ Stable'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {/* Payroll Export Tab */}
            {
                reportType === 'payroll' && (
                    <div className="report-content">
                        <div className="report-controls">
                            <div className="form-group">
                                <label>From:</label>
                                <input type="date" value={payrollStartDate} onChange={(e) => setPayrollStartDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>To:</label>
                                <input type="date" value={payrollEndDate} onChange={(e) => setPayrollEndDate(e.target.value)} />
                            </div>
                            <button onClick={handleGeneratePayroll} className="btn btn-primary" disabled={loading}>
                                {loading ? 'Generating...' : 'Generate Payroll'}
                            </button>
                            {payrollData && (
                                <button onClick={handleDownloadCSV} className="btn btn-success" disabled={loading}>
                                    📥 Download CSV
                                </button>
                            )}
                        </div>

                        {payrollData && (
                            <div className="report-results">
                                <h2>Payroll Export</h2>
                                <p className="report-subtitle">Period: {payrollData.period.start_date} to {payrollData.period.end_date}</p>

                                <div className="stats-grid">
                                    <div className="stat-card">
                                        <div className="stat-label">Total Workers</div>
                                        <div className="stat-value">{payrollData.totals.total_workers}</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-label">Total Hours</div>
                                        <div className="stat-value">{formatHours(payrollData.totals.total_hours)}</div>
                                    </div>
                                    <div className="stat-card stat-success">
                                        <div className="stat-label">Gross Pay</div>
                                        <div className="stat-value small">{formatCurrency(payrollData.totals.total_gross_pay)}</div>
                                    </div>
                                    <div className="stat-card stat-danger">
                                        <div className="stat-label">Deductions</div>
                                        <div className="stat-value small">{formatCurrency(payrollData.totals.total_deductions)}</div>
                                    </div>
                                    <div className="stat-card stat-primary">
                                        <div className="stat-label">Net Pay</div>
                                        <div className="stat-value small">{formatCurrency(payrollData.totals.total_net_pay)}</div>
                                    </div>
                                </div>

                                <div className="table-section">
                                    <h3>Payroll Details</h3>
                                    <div className="table-responsive">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Classification</th>
                                                    <th>Rate</th>
                                                    <th>Days</th>
                                                    <th>Hours</th>
                                                    <th>Regular Pay</th>
                                                    <th>OT Pay</th>
                                                    <th>Gross</th>
                                                    <th>Deductions</th>
                                                    <th>Net Pay</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {payrollData.workers.map((worker, index) => (
                                                    <tr key={index}>
                                                        <td>{worker.worker_number}</td>
                                                        <td>{worker.full_name}</td>
                                                        <td>{worker.classification}</td>
                                                        <td>{formatCurrency(worker.hourly_rate)}</td>
                                                        <td>{worker.days_worked}</td>
                                                        <td>{formatHours(worker.total_hours)}</td>
                                                        <td>{formatCurrency(worker.regular_pay)}</td>
                                                        <td>{worker.overtime_pay > 0 ? formatCurrency(worker.overtime_pay) : '-'}</td>
                                                        <td className="font-bold">{formatCurrency(worker.gross_pay)}</td>
                                                        <td className="text-danger">{formatCurrency(worker.total_deductions)}</td>
                                                        <td className="text-success font-bold">{formatCurrency(worker.net_pay)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="totals-row">
                                                    <td colSpan={5}><strong>TOTALS</strong></td>
                                                    <td><strong>{formatHours(payrollData.totals.total_hours)}</strong></td>
                                                    <td colSpan={2}></td>
                                                    <td><strong>{formatCurrency(payrollData.totals.total_gross_pay)}</strong></td>
                                                    <td className="text-danger"><strong>{formatCurrency(payrollData.totals.total_deductions)}</strong></td>
                                                    <td className="text-success"><strong>{formatCurrency(payrollData.totals.total_net_pay)}</strong></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }

            {
                loading && (
                    <div className="loading-overlay">
                        <div className="spinner"></div>
                        <p>Loading...</p>
                    </div>
                )
            }
        </div >
    );
};

export default Reports;
