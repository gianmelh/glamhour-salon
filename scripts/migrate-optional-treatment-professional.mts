#!/usr/bin/env -S npx tsx
// Safe to repeat: migration 015 only relaxes the optional professional column.
import { readFile } from 'node:fs/promises'
import type { PoolClient } from 'pg'
import { pool } from '../server/db.ts'

let client: PoolClient | undefined
try {
  const sql = await readFile(new URL('../database/migrations/015_optional_treatment_professional.sql', import.meta.url), 'utf8')
  client = await pool.connect()
  await client.query(sql)
  const { rows } = await client.query<{ is_nullable: string }>(
    `SELECT is_nullable FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'treatment_records' AND column_name = 'professional_id'`,
  )
  if (rows[0]?.is_nullable !== 'YES') throw new Error('Migration verification failed')
  console.log('Migration 015 applied: treatment details can be saved without an assigned professional.')
} catch (error) {
  await client?.query('ROLLBACK').catch(() => {})
  const code = error && typeof error === 'object' && 'code' in error ? error.code : 'MIGRATION_FAILED'
  console.error('Migration 015 failed:', code)
  process.exitCode = 1
} finally {
  client?.release()
  await pool.end()
}
