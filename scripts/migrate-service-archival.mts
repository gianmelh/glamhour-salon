#!/usr/bin/env -S npx tsx
// Safe to repeat: adds an archival timestamp without changing existing services.
import { readFile } from 'node:fs/promises'
import type { PoolClient } from 'pg'
import { pool } from '../server/db.ts'

let client: PoolClient | undefined
try {
  const sql = await readFile(new URL('../database/migrations/016_service_archival.sql', import.meta.url), 'utf8')
  client = await pool.connect()
  await client.query(sql)
  const { rows } = await client.query<{ data_type: string }>(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'services' AND column_name = 'deleted_at'`,
  )
  if (rows[0]?.data_type !== 'timestamp with time zone') throw new Error('Migration verification failed')
  console.log('Migration 016 applied: services can be archived while preserving appointment history.')
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {})
  const code = error && typeof error === 'object' && 'code' in error ? error.code : 'MIGRATION_FAILED'
  console.error('Migration 016 failed:', code)
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
}
