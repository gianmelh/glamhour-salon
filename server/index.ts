import { app } from './app.js'
import { config } from './config.js'
import { pool } from './db.js'

const server = app.listen(config.API_PORT, config.API_HOST, () => {
  console.log(`Glamhour API listening at http://${config.API_HOST}:${config.API_PORT}`)
})

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} received, shutting down`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
