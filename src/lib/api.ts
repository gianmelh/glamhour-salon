const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:3001/api'

interface ApiErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export class ApiClientError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  const body = await response.json() as { data: T } & ApiErrorBody

  if (!response.ok) {
    throw new ApiClientError(
      response.status,
      body.error?.code ?? 'API_ERROR',
      body.error?.message ?? 'API request failed',
      body.error?.details,
    )
  }

  return body.data
}
