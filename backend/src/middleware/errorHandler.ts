import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/Logger'

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public isOperational: boolean = true
    ) {
        super(message)
        Object.setPrototypeOf(this, AppError.prototype)
    }
}

export const errorHandler = (
    err: Error | AppError,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Default error values
    let statusCode = 500
    let message = 'Internal server error'
    let isOperational = false

    // Check if it's an AppError
    if (err instanceof AppError) {
        statusCode = err.statusCode
        message = err.message
        isOperational = err.isOperational
    }

    // Log the error
    logger.logError(`Error in ${req.method} ${req.path}`, err, {
        statusCode,
        isOperational,
        body: req.body,
        params: req.params,
        query: req.query,
    })

    // Send response
    res.status(statusCode).json({
        success: false,
        error: message,
        ...(process.env.NODE_ENV !== 'production' && {
            stack: err.stack,
        }),
    })
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
