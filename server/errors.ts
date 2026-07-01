import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError } from 'zod'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
  }
}

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, 'Route not found'))
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next

  if (error instanceof ZodError) {
    response.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.flatten() },
    })
    return
  }

  if (error instanceof ApiError) {
    response.status(error.status).json({
      error: { code: 'API_ERROR', message: error.message, details: error.details },
    })
    return
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const databaseError = error as { code?: string; detail?: string }

    if (databaseError.code === '23P01') {
      response.status(409).json({
        error: { code: 'APPOINTMENT_CONFLICT', message: 'The professional is unavailable for that time.' },
      })
      return
    }

    if (databaseError.code?.startsWith('23')) {
      response.status(409).json({
        error: { code: 'DATABASE_CONSTRAINT', message: 'The request conflicts with existing data.', details: databaseError.detail },
      })
      return
    }
  }

  console.error(error)
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
  })
}
