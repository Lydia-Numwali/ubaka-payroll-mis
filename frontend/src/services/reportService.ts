import api from './api';

export interface MonthlyReportData {
    month: string;
    year: number;
    workers: WorkerMonthlyStats[];
    summary: {
        total_workers: number;
        total_days: number;
        total_hours: number;
        total_regular_pay: number;
        total_deductions: number;
        total_net_pay: number;
        average_hours_per_worker: number;
        late_arrival_rate: number;
    };
}

export interface WorkerMonthlyStats {
    worker_id: number;
    worker_number: string;
    full_name: string;
    classification: string;
    days_present: number;
    days_late: number;
    total_hours: number;
    regular_pay: number;
    deductions: number;
    net_pay: number;
    late_percentage: number;
}

export interface LateArrivalTrends {
    period: {
        start_date: string;
        end_date: string;
    };
    daily_stats: Array<{
        date: string;
        total_late: number;
        average_late_minutes: number;
        total_deductions: number;
    }>;
    worker_stats: Array<{
        worker_id: number;
        worker_number: string;
        full_name: string;
        total_lates: number;
        average_late_minutes: number;
        total_deductions: number;
        trend: 'improving' | 'worsening' | 'stable';
    }>;
    top_offenders: Array<{
        worker_id: number;
        worker_number: string;
        full_name: string;
        late_count: number;
        total_late_minutes: number;
    }>;
}

export interface PayrollExportData {
    period: {
        start_date: string;
        end_date: string;
    };
    workers: Array<{
        worker_number: string;
        full_name: string;
        classification: string;
        hourly_rate: number;
        days_worked: number;
        total_hours: number;
        regular_pay: number;
        overtime_pay: number;
        gross_pay: number;
        late_deductions: number;
        other_deductions: number;
        total_deductions: number;
        net_pay: number;
    }>;
    totals: {
        total_workers: number;
        total_hours: number;
        total_gross_pay: number;
        total_deductions: number;
        total_net_pay: number;
    };
}

const reportService = {
    async getMonthlyReport(year: number, month: number): Promise<MonthlyReportData> {
        const response = await api.get(`/reports/monthly/${year}/${month}`);
        return response.data.data;
    },

    async getLateTrends(startDate: string, endDate: string): Promise<LateArrivalTrends> {
        const response = await api.get('/reports/late-trends', {
            params: { start_date: startDate, end_date: endDate }
        });
        return response.data.data;
    },

    async getPayrollExport(startDate: string, endDate: string): Promise<PayrollExportData> {
        const response = await api.get('/reports/payroll-export', {
            params: { start_date: startDate, end_date: endDate }
        });
        return response.data.data;
    },

    async downloadPayrollCSV(startDate: string, endDate: string): Promise<void> {
        const response = await api.get('/reports/payroll-csv', {
            params: { start_date: startDate, end_date: endDate },
            responseType: 'blob'
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `payroll_${startDate}_to_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    }
};

export default reportService;
