import { Request, Response } from 'express'
import { AttendanceCalculationService } from '../services/AttendanceCalculationService'
import { DailyWorkSummaryRepository } from '../repositories/DailyWorkSummaryRepository'
import { LateArrivalRepository } from '../repositories/LateArrivalRepository'
import { WorkerRepository } from '../repositories/WorkerRepository'
import { logger } from '../utils/Logger'

export class AttendanceCalculationController {
    private calculationService: AttendanceCalculationService
    private summaryRepo: DailyWorkSummaryRepository
    private lateRepo: LateArrivalRepository
    private workerRepo: WorkerRepository

    constructor() {
        this.calculationService = new AttendanceCalculationService()
        this.summaryRepo = new DailyWorkSummaryRepository()
        this.lateRepo = new LateArrivalRepository()
        this.workerRepo = new WorkerRepository()
    }

    /**
     * Calculate daily work summary for a worker
     * POST /api/attendance/calculate/:workerId/:date
     */
    public calculateDaily = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerIdParam = Array.isArray(req.params.workerId) ? req.params.workerId[0] : req.params.workerId
            const dateParam = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date

            const workerId = parseInt(workerIdParam, 10)
            const date = dateParam // YYYY-MM-DD

            if (isNaN(workerId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid worker ID',
                })
                return
            }

            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid date format. Use YYYY-MM-DD',
                })
                return
            }

            logger.info('Calculate daily summary requested', { workerId, date })

            // Get worker to get hourly rate
            const worker = await this.workerRepo.findById(workerId)
            if (!worker) {
                res.status(404).json({
                    success: false,
                    error: 'Worker not found',
                })
                return
            }

            // Calculate
            const result = await this.calculationService.calculateDailyWorkSummary(
                workerId,
                date,
                worker.hourly_rate
            )

            res.json({
                success: true,
                data: {
                    summary: result.summary,
                    late_arrival: result.late_arrival,
                    anomalies: result.anomalies,
                    warnings: result.warnings,
                },
            })

            logger.info('Daily summary calculated successfully', {
                workerId,
                date,
                totalHours: result.summary.total_payable_hours,
                isLate: result.summary.is_late,
            })
        } catch (error) {
            logger.error('Failed to calculate daily summary', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to calculate daily summary',
            })
        }
    }

    /**
     * Get calculated summary for a worker on a date
     * GET /api/attendance/summary/:workerId/:date
     */
    public getSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const workerIdParam = Array.isArray(req.params.workerId) ? req.params.workerId[0] : req.params.workerId
            const dateParam = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date

            const workerId = parseInt(workerIdParam, 10)
            const date = dateParam

            if (isNaN(workerId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid worker ID',
                })
                return
            }

            const summary = await this.summaryRepo.findByWorkerAndDate(workerId, date)

            if (!summary) {
                res.status(404).json({
                    success: false,
                    error: 'No summary found for this date',
                })
                return
            }

            res.json({
                success: true,
                data: summary,
            })
        } catch (error) {
            logger.error('Failed to get summary', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to get summary',
            })
        }
    }

    /**
     * Get summaries requiring supervisor review
     * GET /api/attendance/pending-review
     */
    public getPendingReview = async (req: Request, res: Response): Promise<void> => {
        try {
            const summaries = await this.summaryRepo.findRequiringReview()

            res.json({
                success: true,
                data: {
                    count: summaries.length,
                    summaries,
                },
            })
        } catch (error) {
            logger.error('Failed to get pending reviews', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to get pending reviews',
            })
        }
    }

    /**
     * Get all summaries for a specific date
     * GET /api/attendance/daily-report/:date
     */
    public getDailyReport = async (req: Request, res: Response): Promise<void> => {
        try {
            const dateParam = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date
            const date = dateParam

            const summaries = await this.summaryRepo.findByDate(date)
            const lateArrivals = await this.lateRepo.findByDate(date)

            // Calculate statistics
            const stats = {
                total_workers: summaries.length,
                present: summaries.filter((s) => s.attendance_status !== 'ABSENT').length,
                absent: summaries.filter((s) => s.attendance_status === 'ABSENT').length,
                late: summaries.filter((s) => s.is_late).length,
                early_departure: summaries.filter((s) => s.is_early_departure).length,
                incomplete: summaries.filter((s) => s.attendance_status === 'INCOMPLETE').length,
                total_hours: summaries.reduce((sum, s) => sum + s.total_payable_hours, 0),
                total_deductions: summaries.reduce((sum, s) => sum + s.total_deductions, 0),
                requires_review: summaries.filter((s) => s.requires_supervisor_review).length,
            }

            res.json({
                success: true,
                data: {
                    date,
                    statistics: stats,
                    summaries,
                    late_arrivals: lateArrivals,
                },
            })
        } catch (error) {
            logger.error('Failed to get daily report', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to get daily report',
            })
        }
    }

    /**
     * Get late arrivals for date range
     * GET /api/attendance/late-arrivals?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&worker_id=X
     */
    public getLateArrivals = async (req: Request, res: Response): Promise<void> => {
        try {
            const { start_date, end_date, worker_id } = req.query

            if (!start_date || !end_date) {
                res.status(400).json({
                    success: false,
                    error: 'start_date and end_date are required',
                })
                return
            }

            let lateArrivals

            if (worker_id) {
                lateArrivals = await this.lateRepo.findByWorkerAndDateRange(
                    parseInt(worker_id as string, 10),
                    start_date as string,
                    end_date as string
                )
            } else {
                // Get all late arrivals for date range
                const query = `
                    SELECT la.*, w.worker_number, w.full_name, w.classification
                    FROM late_arrival la
                    JOIN worker w ON la.worker_id = w.id
                    WHERE la.work_date >= $1 AND la.work_date <= $2
                    ORDER BY la.work_date DESC, la.late_minutes DESC
                `
                const result = await this.lateRepo['pool'].query(query, [start_date, end_date])
                lateArrivals = result.rows
            }

            // Calculate statistics
            const stats = {
                total_lates: lateArrivals.length,
                total_deductions: lateArrivals.reduce((sum: number, la: any) =>
                    sum + parseFloat(la.deduction_amount), 0),
                average_late_minutes: lateArrivals.length > 0
                    ? lateArrivals.reduce((sum: number, la: any) => sum + la.late_minutes, 0) / lateArrivals.length
                    : 0,
            }

            res.json({
                success: true,
                data: {
                    period: { start_date, end_date },
                    statistics: stats,
                    late_arrivals: lateArrivals,
                },
            })
        } catch (error) {
            logger.error('Failed to get late arrivals', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to get late arrivals',
            })
        }
    }

    /**
     * Batch calculate for all active workers on a date
     * POST /api/attendance/calculate-batch/:date
     */
    public calculateBatch = async (req: Request, res: Response): Promise<void> => {
        try {
            const dateParam = Array.isArray(req.params.date) ? req.params.date[0] : req.params.date
            const date = dateParam

            logger.info('Batch calculation requested', { date })

            // Get all active workers
            const workers = await this.workerRepo.findActiveWorkers()

            const results = {
                total: workers.length,
                success: 0,
                failed: 0,
                errors: [] as any[],
            }

            // Calculate for each worker
            for (const worker of workers) {
                try {
                    await this.calculationService.calculateDailyWorkSummary(
                        worker.id,
                        date,
                        worker.hourly_rate
                    )
                    results.success++
                } catch (error) {
                    results.failed++
                    results.errors.push({
                        worker_id: worker.id,
                        worker_number: worker.worker_number,
                        error: (error as Error).message,
                    })
                }
            }

            res.json({
                success: true,
                data: results,
            })

            logger.info('Batch calculation completed', results)
        } catch (error) {
            logger.error('Batch calculation failed', error as Error)
            res.status(500).json({
                success: false,
                error: 'Batch calculation failed',
            })
        }
    }

    /**
     * Approve a summary for payroll
     * POST /api/attendance-calculation/approve/:summaryId
     */
    public approveSummary = async (req: Request, res: Response): Promise<void> => {
        try {
            const summaryIdParam = Array.isArray(req.params.summaryId) ? req.params.summaryId[0] : req.params.summaryId
            const summaryId = parseInt(summaryIdParam, 10)
            const { approved_by } = req.body

            if (isNaN(summaryId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid summary ID',
                })
                return
            }

            if (!approved_by) {
                res.status(400).json({
                    success: false,
                    error: 'approved_by is required',
                })
                return
            }

            // In real system, approved_by would be user ID from auth token
            // For now, accepting as string/number from request
            await this.summaryRepo.approve(summaryId, typeof approved_by === 'string' ? 1 : approved_by)

            res.json({
                success: true,
                message: 'Summary approved for payroll',
            })

            logger.info('Summary approved', { summaryId, approved_by })
        } catch (error) {
            logger.error('Failed to approve summary', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to approve summary',
            })
        }
    }

    /**
     * Waive a late arrival deduction
     * POST /api/attendance-calculation/waive-late/:lateId
     */
    public waiveLateDeduction = async (req: Request, res: Response): Promise<void> => {
        try {
            const lateIdParam = Array.isArray(req.params.lateId) ? req.params.lateId[0] : req.params.lateId
            const lateId = parseInt(lateIdParam, 10)
            const { waived_by, waiver_reason } = req.body

            if (isNaN(lateId)) {
                res.status(400).json({
                    success: false,
                    error: 'Invalid late arrival ID',
                })
                return
            }

            if (!waived_by || !waiver_reason) {
                res.status(400).json({
                    success: false,
                    error: 'waived_by and waiver_reason are required',
                })
                return
            }

            // In real system, waived_by would be user ID from auth token
            await this.lateRepo.waive(lateId, typeof waived_by === 'string' ? 1 : waived_by, waiver_reason)

            res.json({
                success: true,
                message: 'Late deduction waived',
            })

            logger.info('Late deduction waived', { lateId, waived_by, waiver_reason })
        } catch (error) {
            logger.error('Failed to waive late deduction', error as Error)
            res.status(500).json({
                success: false,
                error: 'Failed to waive late deduction',
            })
        }
    }
}
