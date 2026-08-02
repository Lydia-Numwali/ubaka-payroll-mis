import { Router } from 'express'
import { AttendanceCalculationController } from '../controllers/AttendanceCalculationController'

const router = Router()
const controller = new AttendanceCalculationController()

// Calculate daily summary
router.post('/calculate/:workerId/:date', controller.calculateDaily)

// Batch calculation
router.post('/calculate-batch/:date', controller.calculateBatch)

// Get calculated summary
router.get('/summary/:workerId/:date', controller.getSummary)

// Get summaries requiring review
router.get('/pending-review', controller.getPendingReview)

// Get daily report with all workers
router.get('/daily-report/:date', controller.getDailyReport)

// Get late arrivals
router.get('/late-arrivals', controller.getLateArrivals)

export default router
