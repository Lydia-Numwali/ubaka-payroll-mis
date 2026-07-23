import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/Logger'

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now()

    // Log request
    logger.info(`Incoming request: ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent'),
        query: req.query,
    })

    // Capture response
    const originalSend = res.send
    res.send = function (data: any) {
        const duration = Date.now() - startTime
        logger.logRequest(req.method, req.path, res.statusCode, duration)
        return originalSend.call(this, data)
    }

    next()
}
