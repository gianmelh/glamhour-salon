import cors from 'cors'
import express from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { checkDatabase } from './db.js'
import { errorHandler, notFoundHandler } from './errors.js'
import { asyncHandler } from './http.js'
import { apiRouter } from './routes.js'

export const app = express()

app.disable('x-powered-by')
app.use(cors({ origin: config.CORS_ORIGIN }))
app.use(express.json({ limit: '4mb' }))

app.use('/api/media', express.static(path.resolve(config.UPLOAD_DIR), {
  setHeaders(response) {
    response.setHeader('Cache-Control', 'private, max-age=3600')
  },
}))

const clientDistPath = path.resolve(process.cwd(), 'dist')

app.get('/health', asyncHandler(async (_request, response) => {
  await checkDatabase()
  response.json({ status: 'ok', database: 'connected' })
}))

app.use('/api', apiRouter)

if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || !request.accepts('html')) {
      next()
      return
    }

    response.sendFile(path.join(clientDistPath, 'index.html'))
  })
}

app.use(notFoundHandler)
app.use(errorHandler)
