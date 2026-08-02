import { Router } from 'express'
import { ReportController } from '../controllers/ReportController'

const router = Router()
const reportController = new ReportController()

// Monthly report
router.get('/monthly/:year/:month', reportController.getMonthlyReport)

// Late arrival trends
router.get('/late-trends', reportController.getLateTrends)

// Payroll export (JSON)
router.get('/payroll-export', reportController.getPayrollExport)

// Payroll export (CSV)
router.get('/payroll-csv', reportController.exportPayrollCSV)

export default router
