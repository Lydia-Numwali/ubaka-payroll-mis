import React, { useState } from 'react';
import { FileBarChart, Download, TrendingUp, TrendingDown, DollarSign, Users, Calendar, Clock, AlertTriangle, Award } from 'lucide-react';
import reportService, {
    MonthlyReportData,
    LateArrivalTrends,
    PayrollExportData
} from '../services/reportService';
import { LoadingState } from '../components/ui';
import { useToast } from '../components/Toast';

type ReportType = 'monthly' | 'late-trends' | 'payroll';

const Reports: React.FC = () => {
    const toast = useToast();
    const [reportType, setReportType] = useState<ReportType>('monthly');
    const [loading, setLoading] = useState<boolean>(false);

    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [monthlyReport, setMonthlyReport] = useState<MonthlyReportData | null>(null);

    const [lateStartDate, setLateStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date.toISOString().split('T')[0];
    });
    const [lateEndDate, setLateEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [lateTrends, setLateTrends] = useState<LateArrivalTrends | null>(null);

    const [payrollStartDate, setPayrollStartDate] = useState<string>(() => {
        const date = new Date();
        date.setDate(1);
        return date.toISOString().split('T')[0];
    });
    const [payrollEndDate, setPayrollEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [payrollData, setPayrollData] = useState<PayrollExportData | null>(null);

    const handleGenerateMonthlyReport = async () => {
        setLoading(true);
        try {
            const report = await reportService.getMonthlyReport(selectedYear, selectedMonth);
            setMonthlyReport(report);
            toast.success('Monthly report generated successfully');
        } catch (error: any) {
            toast.error('Failed to generate monthly report');
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateLateTrends = async () => {
        setLoading(true);
        try {
            const trends = await reportService.getLateTrends(lateStartDate, lateEndDate);
            setLateTrends(trends);
            toast.success('Late arrival trends generated successfully');
        } catch (error: any) {
            toast.error('Failed to generate late arrival trends');
        } finally {
            setLoading(false);
        }
    };

    const handleGeneratePayroll = async () => {
        setLoading(true);
        try {
            const data = await reportService.getPayrollExport(payrollStartDate, payrollEndDate);
            setPayrollData(data);
            toast.success('Payroll data generated successfully');
        } catch (error: any) {
            toast.error('Failed to generate payroll data');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadCSV = async () => {
        setLoading(true);
        try {
            await reportService.downloadPayrollCSV(payrollStartDate, payrollEndDate);
            toast.success('Payroll CSV downloaded successfully');
        } catch (error: any) {
            toast.error('Failed to download CSV');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number | string | null | undefined) => {
        if (amount === null || amount === undefined) return '0 RWF';
        const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
        const formatted = isNaN(numAmount) ? 0 : numAmount;
        return `${formatted.toLocaleString('en-US', { maximumFractionDigits: 0 })} RWF`;
    };

    const formatHours = (hours: number | string | null | undefined) => {
        if (hours === null || hours === undefined) return '0.00';
        const numHours = typeof hours === 'string' ? parseFloat(hours) : hours;
        return isNaN(numHours) ? '0.00' : numHours.toFixed(2);
    };

    const formatDateRange = (startDate: string, endDate: string) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
        return `${start.toLocaleDateString('en-US', options)} — ${end.toLocaleDateString('en-US', options)}`;
    };

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return (
        <div>
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                padding: '0.5rem',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: '1.25rem'
            }}>
                <button
                    className={reportType === 'monthly' ? 'btn btn-primary' : 'btn btn-secondary'}
                    onClick={() => setReportType('monthly')}
                    style={{ flex: 1 }}
                >
                    <FileBarChart size={18} />
                    Monthly Report
                </button>
                <button
                    className={reportType === 'late-trends' ? 'btn btn-primary' : 'btn btn-secondary'}
                    onClick={() => setReportType('late-trends')}
                    style={{ flex: 1 }}
                >
                    <TrendingUp size={18} />
                    Late Trends
                </button>
                <button
                    className={reportType === 'payroll' ? 'btn btn-primary' : 'btn btn-secondary'}
                    onClick={() => setReportType('payroll')}
                    style={{ flex: 1 }}
                >
                    <DollarSign size={18} />
                    Payroll Export
                </button>
            </div>

            {reportType === 'monthly' && (
                <div>
                    <div className="toolbar toolbar--compact" style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                            <label>Year</label>
                            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} style={{ width: '110px', minWidth: '110px' }}>
                                {[2024, 2025, 2026, 2027].map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                            <label>Month</label>
                            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} style={{ width: '110px', minWidth: '110px' }}>
                                {months.map((month, index) => (
                                    <option key={index} value={index + 1}>{month}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={handleGenerateMonthlyReport} className="btn btn-primary" disabled={loading} style={{ height: '42px', marginLeft: '0.625rem' }}>
                            {loading ? 'Generating…' : 'Generate Report'}
                        </button>
                    </div>

                    {monthlyReport && (
                        <>
                            <div className="stats-grid stats-grid--4">
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon">
                                            <Users size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{monthlyReport.summary.total_workers}</div>
                                    <div className="stat-label">Total workers</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon">
                                            <Calendar size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{monthlyReport.summary.total_days}</div>
                                    <div className="stat-label">Working days</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon">
                                            <Clock size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value stat-value--sm">{formatHours(monthlyReport.summary.total_hours)}</div>
                                    <div className="stat-label">Total hours</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon">
                                            <DollarSign size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value stat-value--sm">
                                        {formatCurrency(monthlyReport.summary.total_net_pay)}
                                    </div>
                                    <div className="stat-label">Net payroll</div>
                                </div>
                            </div>

                            <div className="stats-grid stats-grid--4" style={{ marginBottom: '1.25rem' }}>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                                            <TrendingUp size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value stat-value--sm">{formatCurrency(monthlyReport.summary.total_regular_pay)}</div>
                                    <div className="stat-label">Regular pay</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#fff1f2', color: 'var(--rose)', borderColor: '#fecdd3' }}>
                                            <TrendingDown size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value stat-value--sm">{formatCurrency(monthlyReport.summary.total_deductions)}</div>
                                    <div className="stat-label">Total deductions</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#ffedd5', color: '#9a3412', borderColor: '#fed7aa' }}>
                                            <AlertTriangle size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{(typeof monthlyReport.summary.late_arrival_rate === 'string' ? parseFloat(monthlyReport.summary.late_arrival_rate) : monthlyReport.summary.late_arrival_rate).toFixed(1)}%</div>
                                    <div className="stat-label">Late arrival rate</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#e0f2fe', color: '#075985', borderColor: '#bae6fd' }}>
                                            <Award size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value stat-value--sm">{formatHours(monthlyReport.summary.average_hours_per_worker)}</div>
                                    <div className="stat-label">Avg hours/worker</div>
                                </div>
                            </div>

                            <div className="panel">
                                <div className="panel__head">
                                    <h2 className="panel__title">
                                        {monthlyReport.month} {monthlyReport.year} — Worker breakdown
                                    </h2>
                                </div>
                                <div className="panel__body" style={{ padding: 0 }}>
                                    <div className="table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Classification</th>
                                                    <th>Days present</th>
                                                    <th>Days late</th>
                                                    <th>Total hours</th>
                                                    <th>Regular pay</th>
                                                    <th>Deductions</th>
                                                    <th>Net pay</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {monthlyReport.workers.map(worker => (
                                                    <tr key={worker.worker_id}>
                                                        <td><strong>{worker.worker_number}</strong></td>
                                                        <td>{worker.full_name}</td>
                                                        <td>{worker.classification}</td>
                                                        <td>{worker.days_present}</td>
                                                        <td style={{ color: worker.days_late > 0 ? 'var(--rose)' : undefined }}>
                                                            {worker.days_late}
                                                        </td>
                                                        <td>{formatHours(worker.total_hours)}h</td>
                                                        <td>{formatCurrency(worker.regular_pay)}</td>
                                                        <td style={{ color: 'var(--rose)' }}>{formatCurrency(worker.deductions)}</td>
                                                        <td style={{ fontWeight: 700 }}>{formatCurrency(worker.net_pay)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {reportType === 'late-trends' && (
                <div>
                    <div className="toolbar toolbar--compact" style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}>
                        <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                            <label>Start date</label>
                            <input type="date" value={lateStartDate} onChange={(e) => setLateStartDate(e.target.value)} style={{ width: '110px', minWidth: '110px' }} />
                        </div>
                        <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                            <label>End date</label>
                            <input type="date" value={lateEndDate} onChange={(e) => setLateEndDate(e.target.value)} style={{ width: '110px', minWidth: '110px' }} />
                        </div>
                        <button onClick={handleGenerateLateTrends} className="btn btn-primary" disabled={loading} style={{ height: '42px', marginLeft: '0.625rem' }}>
                            {loading ? 'Generating…' : 'Generate Trends'}
                        </button>
                    </div>

                    {lateTrends && (
                        <>
                            {/* Summary Stats */}
                            <div className="stats-grid stats-grid--4" style={{ marginBottom: '1.25rem' }}>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#fff1f2', color: 'var(--rose)', borderColor: '#fecdd3' }}>
                                            <AlertTriangle size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">{lateTrends.top_offenders.length}</div>
                                    <div className="stat-label">Workers with lates</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#ffedd5', color: '#9a3412', borderColor: '#fed7aa' }}>
                                            <Clock size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">
                                        {lateTrends.top_offenders.reduce((sum, w) => sum + w.late_count, 0)}
                                    </div>
                                    <div className="stat-label">Total late incidents</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#e0f2fe', color: '#075985', borderColor: '#bae6fd' }}>
                                            <TrendingUp size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">
                                        {lateTrends.worker_stats.filter(w => w.trend === 'improving').length}
                                    </div>
                                    <div className="stat-label">Improving workers</div>
                                </div>
                                <div className="stat-card">
                                    <div className="stat-card__top">
                                        <div className="stat-card__icon" style={{ background: '#fff1f2', color: 'var(--rose)', borderColor: '#fecdd3' }}>
                                            <TrendingDown size={18} />
                                        </div>
                                    </div>
                                    <div className="stat-value">
                                        {lateTrends.worker_stats.filter(w => w.trend === 'worsening').length}
                                    </div>
                                    <div className="stat-label">Worsening workers</div>
                                </div>
                            </div>

                            <div className="panel">
                                <div className="panel__head" style={{ background: '#fff1f2', borderColor: '#fecdd3' }}>
                                    <h2 className="panel__title">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <AlertTriangle size={18} />
                                            Top offenders
                                        </div>
                                    </h2>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                        {formatDateRange(lateStartDate, lateEndDate)}
                                    </div>
                                </div>
                                <div className="panel__body" style={{ padding: 0 }}>
                                    <div className="table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Rank</th>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Late count</th>
                                                    <th>Total late minutes</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lateTrends.top_offenders.map((worker, index) => (
                                                    <tr key={worker.worker_id}>
                                                        <td><strong>{index + 1}</strong></td>
                                                        <td>{worker.worker_number}</td>
                                                        <td>{worker.full_name}</td>
                                                        <td style={{ color: 'var(--rose)', fontWeight: 700 }}>{worker.late_count}</td>
                                                        <td style={{ color: 'var(--rose)' }}>
                                                            {(typeof worker.total_late_minutes === 'string' ? parseFloat(worker.total_late_minutes) : worker.total_late_minutes).toFixed(0)} min
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div className="panel">
                                <div className="panel__head">
                                    <h2 className="panel__title">Worker statistics</h2>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                        {formatDateRange(lateStartDate, lateEndDate)}
                                    </div>
                                </div>
                                <div className="panel__body" style={{ padding: 0 }}>
                                    <div className="table-wrap">
                                        <table className="data-table">
                                            <thead>
                                                <tr>
                                                    <th>Worker #</th>
                                                    <th>Name</th>
                                                    <th>Total lates</th>
                                                    <th>Avg late minutes</th>
                                                    <th>Total deductions</th>
                                                    <th>Trend</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {lateTrends.worker_stats.map(worker => (
                                                    <tr key={worker.worker_id}>
                                                        <td><strong>{worker.worker_number}</strong></td>
                                                        <td>{worker.full_name}</td>
                                                        <td>{worker.total_lates}</td>
                                                        <td>
                                                            {(typeof worker.average_late_minutes === 'string' ? parseFloat(worker.average_late_minutes) : worker.average_late_minutes).toFixed(1)} min
                                                        </td>
                                                        <td style={{ color: 'var(--rose)' }}>{formatCurrency(worker.total_deductions)}</td>
                                                        <td>
                                                            <span className={`status-badge ${worker.trend === 'improving' ? 'active' :
                                                                worker.trend === 'worsening' ? 'incomplete' :
                                                                    'inactive'
                                                                }`}>
                                                                {worker.trend}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )
            }

            {
                reportType === 'payroll' && (
                    <div>
                        <div className="toolbar toolbar--compact" style={{ justifyContent: 'flex-start', gap: '0.5rem', padding: '0.65rem 0.8rem', alignItems: 'end' }}>
                            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                                <label>Start date</label>
                                <input type="date" value={payrollStartDate} onChange={(e) => setPayrollStartDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ marginLeft: '0.25rem' }}>
                                <label>End date</label>
                                <input type="date" value={payrollEndDate} onChange={(e) => setPayrollEndDate(e.target.value)} />
                            </div>
                            <button onClick={handleGeneratePayroll} className="btn btn-primary" disabled={loading} style={{ height: '42px', marginLeft: '0.625rem' }}>
                                {loading ? 'Generating…' : 'Generate Payroll'}
                            </button>
                            {payrollData && (
                                <button onClick={handleDownloadCSV} className="btn btn-secondary" disabled={loading} style={{ height: '42px' }}>
                                    Download CSV
                                </button>
                            )}
                        </div>

                        {payrollData && (
                            <>
                                <div className="stats-grid stats-grid--4">
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon">
                                                <Users size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value">{payrollData.totals.total_workers}</div>
                                        <div className="stat-label">Total workers</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon">
                                                <Clock size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">{formatHours(payrollData.totals.total_hours)}</div>
                                        <div className="stat-label">Total hours</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                                                <DollarSign size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">
                                            {formatCurrency(payrollData.totals.total_gross_pay)}
                                        </div>
                                        <div className="stat-label">Gross pay</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: 'var(--teal-dim)', color: 'var(--teal)', borderColor: 'rgba(39, 40, 51, 0.2)' }}>
                                                <TrendingUp size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">
                                            {formatCurrency(payrollData.totals.total_net_pay)}
                                        </div>
                                        <div className="stat-label">Net payroll</div>
                                    </div>
                                </div>

                                {/* Additional insights */}
                                <div className="stats-grid stats-grid--4" style={{ marginBottom: '1.25rem' }}>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: '#fff1f2', color: 'var(--rose)', borderColor: '#fecdd3' }}>
                                                <TrendingDown size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">
                                            {formatCurrency(payrollData.totals.total_deductions)}
                                        </div>
                                        <div className="stat-label">Total deductions</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: '#e0f2fe', color: '#075985', borderColor: '#bae6fd' }}>
                                                <Award size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">
                                            {(() => {
                                                const totalHours = typeof payrollData.totals.total_hours === 'string'
                                                    ? parseFloat(payrollData.totals.total_hours)
                                                    : (payrollData.totals.total_hours || 0);
                                                const totalWorkers = payrollData.totals.total_workers || 1;
                                                const avg = totalHours / totalWorkers;
                                                return isNaN(avg) ? '0.0' : avg.toFixed(1);
                                            })()}h
                                        </div>
                                        <div className="stat-label">Avg hours/worker</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}>
                                                <DollarSign size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value stat-value--sm">
                                            {(() => {
                                                const totalNetPay = typeof payrollData.totals.total_net_pay === 'string'
                                                    ? parseFloat(payrollData.totals.total_net_pay)
                                                    : (payrollData.totals.total_net_pay || 0);
                                                const totalWorkers = payrollData.totals.total_workers || 1;
                                                const avg = totalNetPay / totalWorkers;
                                                return formatCurrency(isNaN(avg) ? 0 : avg);
                                            })()}
                                        </div>
                                        <div className="stat-label">Avg pay/worker</div>
                                    </div>
                                    <div className="stat-card">
                                        <div className="stat-card__top">
                                            <div className="stat-card__icon" style={{ background: '#ffedd5', color: '#9a3412', borderColor: '#fed7aa' }}>
                                                <AlertTriangle size={18} />
                                            </div>
                                        </div>
                                        <div className="stat-value">
                                            {(() => {
                                                const totalDeductions = typeof payrollData.totals.total_deductions === 'string'
                                                    ? parseFloat(payrollData.totals.total_deductions)
                                                    : (payrollData.totals.total_deductions || 0);
                                                const totalGrossPay = typeof payrollData.totals.total_gross_pay === 'string'
                                                    ? parseFloat(payrollData.totals.total_gross_pay)
                                                    : (payrollData.totals.total_gross_pay || 1);
                                                const rate = (totalDeductions / totalGrossPay) * 100;
                                                return isNaN(rate) ? '0.0' : rate.toFixed(1);
                                            })()}%
                                        </div>
                                        <div className="stat-label">Deduction rate</div>
                                    </div>
                                </div>

                                <div className="panel">
                                    <div className="panel__head">
                                        <h2 className="panel__title">Payroll details</h2>
                                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                            {formatDateRange(payrollStartDate, payrollEndDate)}
                                        </div>
                                    </div>
                                    <div className="panel__body" style={{ padding: 0 }}>
                                        <div className="table-wrap">
                                            <table className="data-table">
                                                <thead>
                                                    <tr>
                                                        <th>Worker #</th>
                                                        <th>Name</th>
                                                        <th>Classification</th>
                                                        <th>Rate</th>
                                                        <th>Days</th>
                                                        <th>Hours</th>
                                                        <th>Regular pay</th>
                                                        <th>Gross</th>
                                                        <th>Deductions</th>
                                                        <th>Net pay</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {payrollData.workers.map((worker, index) => (
                                                        <tr key={index}>
                                                            <td><strong>{worker.worker_number}</strong></td>
                                                            <td>{worker.full_name}</td>
                                                            <td>{worker.classification}</td>
                                                            <td>{formatCurrency(worker.hourly_rate)}</td>
                                                            <td>{worker.days_worked}</td>
                                                            <td>{formatHours(worker.total_hours)}h</td>
                                                            <td>{formatCurrency(worker.regular_pay)}</td>
                                                            <td style={{ fontWeight: 700 }}>{formatCurrency(worker.gross_pay)}</td>
                                                            <td style={{ color: 'var(--rose)' }}>{formatCurrency(worker.total_deductions)}</td>
                                                            <td style={{ fontWeight: 700 }}>{formatCurrency(worker.net_pay)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                                                        <td colSpan={5}><strong>TOTALS</strong></td>
                                                        <td><strong>{formatHours(payrollData.totals.total_hours)}h</strong></td>
                                                        <td></td>
                                                        <td><strong>{formatCurrency(payrollData.totals.total_gross_pay)}</strong></td>
                                                        <td style={{ color: 'var(--rose)' }}><strong>{formatCurrency(payrollData.totals.total_deductions)}</strong></td>
                                                        <td><strong>{formatCurrency(payrollData.totals.total_net_pay)}</strong></td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )
            }

            {loading && <LoadingState label="Generating report…" />}
        </div >
    );
};

export default Reports;
