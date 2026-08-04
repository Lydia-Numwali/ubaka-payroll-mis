import api from './api';

export interface DailyWorkSummary {
    id?: number;
    worker_id: number;
    work_date: string;
    schedule_id: number;
    actual_entry_time?: string;
    actual_exit_time?: string;
    payable_entry_time?: string;
    payable_exit_time?: string;
    is_late: boolean;
    late_minutes: number;
    late_deduction_amount: number;
    is_early_departure: boolean;
    early_departure_minutes: number;
    early_departure_deduction: number;
    regular_hours_gross: number;
    regular_hours_net: number;
    break_minutes_paid: number;
    break_minutes_unpaid: number;
    overtime_minutes_authorized: number;
    overtime_minutes_actual: number;
    overtime_pay: number;
    hourly_rate: number;
    regular_pay: number;
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
    has_anomaly: boolean;
    anomaly_description?: string;
    attendance_status: 'present' | 'absent' | 'incomplete' | 'requires_review';
    approved_by?: string;
    approved_at?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
}

export interface LateArrival {
    id?: number;
    worker_id: number;
    work_date: string;
    scheduled_time: string;
    actual_time: string;
    late_minutes: number;
    hourly_rate: number;
    deduction_amount: number;
    late_count_this_month: number;
    is_waived: boolean;
    waived_by?: string;
    waived_at?: string;
    waiver_reason?: string;
    disciplinary_action?: string;
    notes?: string;
    created_at?: string;
}

export interface CalculationResult {
    success: boolean;
    data: {
        summary: DailyWorkSummary;
        late_arrival?: LateArrival;
        anomalies: string[];
        warnings: string[];
    };
    message?: string;
}

export interface DailyReport {
    date: string;
    statistics: {
        total_workers: number;
        present: number;
        absent: number;
        late: number;
        total_hours: number;
        total_deductions: number;
        requires_review: number;
    };
    summaries: DailyWorkSummary[];
    late_arrivals: LateArrival[];
}

export interface LateStatistics {
    period: {
        start_date: string;
        end_date: string;
    };
    statistics: {
        total_lates: number;
        total_deductions: number;
        average_late_minutes: number;
    };
    late_arrivals: LateArrival[];
}

export interface BatchCalculationResult {
    total: number;
    success: number;
    failed: number;
    errors: Array<{
        worker_id: number;
        worker_number: string;
        error: string;
    }>;
}

const attendanceCalculationService = {
    // Calculate daily summary for a specific worker
    async calculateDailySummary(workerId: number, date: string): Promise<CalculationResult> {
        const response = await api.post(`/attendance-calculation/calculate/${workerId}/${date}`);
        return response.data; // Already has {success, data} structure
    },

    // Get calculated summary for a worker on a specific date
    async getSummary(workerId: number, date: string): Promise<DailyWorkSummary> {
        const response = await api.get(`/attendance-calculation/summary/${workerId}/${date}`);
        return response.data.data; // Extract from {success, data}
    },

    // Get summaries requiring supervisor review
    async getPendingReview(): Promise<DailyWorkSummary[]> {
        const response = await api.get('/attendance-calculation/pending-review');
        return response.data.data.summaries; // Extract from {success, data: {count, summaries}}
    },

    // Get full daily report for all workers
    async getDailyReport(date: string): Promise<DailyReport> {
        const response = await api.get(`/attendance-calculation/daily-report/${date}`);
        return response.data.data;
    },

    // Get late arrival statistics for a date range
    async getLateArrivals(startDate: string, endDate: string): Promise<LateStatistics> {
        const response = await api.get('/attendance-calculation/late-arrivals', {
            params: { start_date: startDate, end_date: endDate }
        });
        return response.data.data; // Extract from {success, data}
    },

    // Batch calculate for all workers on a specific date
    async calculateBatch(date: string): Promise<BatchCalculationResult> {
        const response = await api.post(`/attendance-calculation/calculate-batch/${date}`);
        return response.data.data; // Extract from {success, data}
    },

    // Approve a summary for payroll
    async approveSummary(summaryId: number, approvedBy: string): Promise<void> {
        await api.post(`/attendance-calculation/approve/${summaryId}`, { approved_by: approvedBy });
    },

    // Waive a late deduction
    async waiveLateDeduction(lateId: number, waiver: {
        waived_by: string;
        waiver_reason: string;
    }): Promise<void> {
        await api.post(`/attendance-calculation/waive-late/${lateId}`, waiver);
    }
};

export default attendanceCalculationService;
