import 'dotenv/config'
import { z } from 'zod'

const booleanString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true')

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: booleanString,
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  VITE_GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  API_HOST: z.string().default('127.0.0.1'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('Invalid backend environment configuration:', result.error.flatten().fieldErrors)
  process.exit(1)
}

export const config = {
  ...result.data,
  GOOGLE_CLIENT_ID: result.data.GOOGLE_CLIENT_ID ?? result.data.VITE_GOOGLE_CLIENT_ID,
}
