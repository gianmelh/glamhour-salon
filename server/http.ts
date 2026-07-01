import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

export function validate<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value)
}
