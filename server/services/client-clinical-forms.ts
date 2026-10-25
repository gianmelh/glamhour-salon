import type { PoolClient } from 'pg'
import { createHash } from 'node:crypto'
import { pool, withTransaction } from '../db.js'
import { ApiError } from '../errors.js'
import { getClientAccessPolicy } from './stripe-billing-service.js'

export interface SaveClientClinicalFormInput {
  details: Record<string, unknown>
  notes: string
  expectedProfileId: string | null
  expectedRevision: string | null
}

type ClinicalCategory = 'nails' | 'lashes' | 'cosmetology' | 'micropigmentation'
const clinicalCategories: ClinicalCategory[] = ['nails', 'lashes', 'cosmetology', 'micropigmentation']

export interface ClientClinicalFormRecord {
  id: string | null
  category: string
  status: string
  valid_from: string
  valid_until: string
  questionnaire_id: string | null
  questionnaire_type: string | null
  completed_at: string | null
  is_valid: boolean
  answers: Record<string, unknown>
  form_details: Record<string, unknown>
  notes: string
  appointment_id: string | null
  revision: string
}

// Keep the booking form and its required fields as the single source of truth.
// A runtime import avoids making the NodeNext server typecheck the Vite-only
// type imports in the booking module. The server runs through tsx.
const clinicalFormModulePath = '../../src/pages/app/client-clinical-forms/clinicalFormDetails.ts'
type ClinicalFormModule = {
  isLegacyClinicalForm: (category: ClinicalCategory, details: Record<string, unknown>) => boolean
  clinicalFormMissingItems: (category: ClinicalCategory, details: Record<string, unknown>, legacy: boolean) => string[]
}

const clinicalKeys: Record<ClinicalCategory, string[]> = {
  nails: ['healthAnswers', 'nailServiceType', 'nailType', 'materials', 'materialIds', 'materialLabels', 'rightHand', 'leftHand'],
  lashes: ['healthAnswers', 'style', 'variant', 'eyeShape', 'lashMap', 'volume', 'curl', 'thickness'],
  cosmetology: ['healthAnswers', 'serviceType', 'healthHistory', 'currentMedications', 'skin_type', 'equipment', 'alterations', 'faceAnnotations'],
  micropigmentation: ['healthAnswers', 'procedure', 'procedures', 'healthHistory', 'currentMedications', 'pigment_brand', 'needle', 'needleType', 'herpesSimplex'],
}

function clinicalDetailsSql(details: string, category: string) {
  return `EXISTS (SELECT 1 FROM jsonb_each(${details}) entry WHERE entry.key = ANY(CASE ${category}
    ${clinicalCategories.map((code) => `WHEN '${code}' THEN ARRAY[${clinicalKeys[code].map((key) => `'${key}'`).join(',')}]`).join('\n')}
    ELSE ARRAY[]::text[] END) AND entry.value NOT IN ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb))`
}

function normalizedAnswersSql(answers: string) {
  return `(SELECT jsonb_object_agg(key, CASE value
    WHEN 'true'::jsonb THEN '"yes"'::jsonb WHEN 'false'::jsonb THEN '"no"'::jsonb ELSE value END)
    FROM jsonb_each(CASE WHEN jsonb_typeof(${answers}) = 'object' THEN ${answers} ELSE '{}'::jsonb END))`
}

async function missingClinicalItems(category: ClinicalCategory, details: Record<string, unknown>) {
  const definitions = await import(clinicalFormModulePath) as ClinicalFormModule
  try {
    return definitions.clinicalFormMissingItems(category, details, definitions.isLegacyClinicalForm(category, details))
  } catch {
    throw new ApiError(400, 'The clinical form contains invalid field values.')
  }
}

async function assertClientAccess(salonId: string, clientId: string, connection: Pick<PoolClient, 'query'>, lock: boolean) {
  const found = await connection.query(
    `SELECT id FROM clients WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL${lock ? ' FOR UPDATE' : ''}`,
    [salonId, clientId],
  )
  if (!found.rows[0]) throw new ApiError(404, 'Client not found.')
  if (!lock) return
  const access = await getClientAccessPolicy(salonId)
  if (access.hasPremiumAccess || access.limit === null) return
  const rank = await connection.query<{ access_rank: string }>(
    `SELECT access_rank FROM (
       SELECT id, row_number() OVER (ORDER BY created_at, id) AS access_rank
       FROM clients WHERE salon_id = $1 AND deleted_at IS NULL
     ) ranked WHERE id = $2`,
    [salonId, clientId],
  )
  if (Number(rank.rows[0]?.access_rank) > access.limit) {
    throw new ApiError(403, 'This client is locked on the Free plan. Upgrade to Premium to manage their clinical forms.')
  }
}

async function readClinicalForms(connection: Pick<PoolClient, 'query'>, salonId: string, clientId: string) {
  const result = await connection.query<ClientClinicalFormRecord>(
    `WITH latest_profiles AS (
       SELECT DISTINCT ON (category) * FROM health_profile_versions
       WHERE salon_id = $1 AND client_id = $2
       ORDER BY category, valid_from DESC, created_at DESC, id DESC
     ), appointment_forms AS (
       SELECT a.id AS appointment_id, acd.category, acd.details_json,
              COALESCE(tr.notes, '') AS notes, acd.updated_at AS recorded_at, acd.created_at
       FROM appointments a
       JOIN appointment_category_details acd ON acd.salon_id = a.salon_id AND acd.appointment_id = a.id
       LEFT JOIN LATERAL (
         SELECT tr.notes FROM treatment_records tr
         JOIN appointment_services aps ON aps.id = tr.appointment_service_id AND aps.salon_id = tr.salon_id
         WHERE tr.salon_id = a.salon_id AND tr.client_id = a.client_id
           AND aps.appointment_id = a.id AND tr.category_code = acd.category
         ORDER BY tr.updated_at DESC LIMIT 1
       ) tr ON true
       WHERE a.salon_id = $1 AND a.client_id = $2
         AND ${clinicalDetailsSql('acd.details_json', 'acd.category')}
       UNION ALL
       SELECT a.id, tr.category_code, tr.details_json, COALESCE(tr.notes, ''), tr.updated_at, tr.created_at
       FROM appointments a
       JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
       JOIN treatment_records tr ON tr.salon_id = a.salon_id AND tr.appointment_service_id = aps.id AND tr.client_id = a.client_id
       WHERE a.salon_id = $1 AND a.client_id = $2
         AND ${clinicalDetailsSql('tr.details_json', 'tr.category_code')}
         AND NOT EXISTS (
           SELECT 1 FROM appointment_category_details acd
           WHERE acd.salon_id = a.salon_id AND acd.appointment_id = a.id AND acd.category = tr.category_code
             AND ${clinicalDetailsSql('acd.details_json', 'acd.category')}
         )
     ), profiles AS (
       SELECT hpv.id, hpv.category, hpv.status, hpv.valid_from, hpv.valid_until,
              hpv.questionnaire_id, hq.questionnaire_type, hq.completed_at,
              (hpv.status = 'active' AND hpv.valid_until >= now()) AS is_valid,
              COALESCE(answers.value, '{}'::jsonb) AS answers,
              COALESCE(hq.form_details_json, origin.details_json, '{}'::jsonb)
                || CASE WHEN hq.form_details_json IS NULL AND answers.value IS NOT NULL
                        THEN jsonb_build_object('healthAnswers', answers.value) ELSE '{}'::jsonb END AS form_details,
              COALESCE(hq.notes, origin.notes, '') AS notes, origin.appointment_id
       FROM latest_profiles hpv
       LEFT JOIN health_questionnaires hq ON hq.id = hpv.questionnaire_id
         AND hq.salon_id = hpv.salon_id AND hq.client_id = hpv.client_id
       LEFT JOIN LATERAL (
         SELECT jsonb_object_agg(question_key, COALESCE(json_value, to_jsonb(text_value), to_jsonb(numeric_value), to_jsonb(boolean_value))) AS value
         FROM health_questionnaire_answers WHERE questionnaire_id = hq.id
       ) answers ON true
       LEFT JOIN LATERAL (
         SELECT af.* FROM appointment_forms af WHERE af.category = hpv.category
           AND (af.appointment_id = hq.appointment_id OR (af.created_at = hq.created_at
                  AND ${normalizedAnswersSql("af.details_json->'healthAnswers'")} = ${normalizedAnswersSql('answers.value')}
                  AND af.details_json->>'usedExistingHealthProfile' IS DISTINCT FROM 'true')
             OR af.details_json->>'existingQuestionnaireId' = hq.id::text)
         -- Reusing an intake moves its appointment_id. Its original category
         -- snapshot was created in the same transaction as the questionnaire.
         ORDER BY (af.created_at = hq.created_at) DESC,
                  (af.appointment_id = hq.appointment_id) DESC, af.recorded_at ASC LIMIT 1
       ) origin ON hq.form_details_json IS NULL
     ), fallback AS (
       SELECT DISTINCT ON (af.category)
              p.id, af.category, 'unversioned'::varchar AS status,
              af.recorded_at AS valid_from,
              af.recorded_at + CASE WHEN af.category IN ('cosmetology', 'micropigmentation') THEN interval '6 months' ELSE interval '12 months' END AS valid_until,
              NULL::uuid AS questionnaire_id, NULL::varchar AS questionnaire_type,
              af.recorded_at AS completed_at, false AS is_valid,
              COALESCE(af.details_json->'healthAnswers', '{}'::jsonb) AS answers, af.details_json AS form_details,
              af.notes, af.appointment_id
       FROM appointment_forms af LEFT JOIN profiles p ON p.category = af.category
       WHERE p.id IS NULL OR (
         af.recorded_at > p.valid_from
         AND af.details_json->>'usedExistingHealthProfile' IS DISTINCT FROM 'true'
         AND (af.created_at > p.valid_from OR af.appointment_id = p.appointment_id)
       )
       ORDER BY af.category, af.recorded_at DESC, af.appointment_id DESC
     )
     SELECT * FROM profiles p WHERE NOT EXISTS (SELECT 1 FROM fallback f WHERE f.category = p.category)
     UNION ALL SELECT * FROM fallback ORDER BY category`,
    [salonId, clientId],
  )
  return result.rows.map((record) => ({
    ...record,
    revision: createHash('sha256').update(JSON.stringify([
      record.category, record.id, record.form_details, record.notes,
      record.appointment_id, record.completed_at, record.valid_from,
    ])).digest('hex'),
  }))
}

export async function listClientClinicalForms(salonId: string, clientId: string) {
  await assertClientAccess(salonId, clientId, pool, false)
  return readClinicalForms(pool, salonId, clientId)
}

export async function saveClientClinicalForm(salonId: string, clientId: string, category: string, input: SaveClientClinicalFormInput) {
  if (!clinicalCategories.includes(category as ClinicalCategory)) throw new ApiError(400, 'This category has no clinical form.')
  const missing = await missingClinicalItems(category as ClinicalCategory, input.details)
  if (missing.length) throw new ApiError(400, 'Complete the clinical form before saving.', { missing })

  return withTransaction(async (connection) => {
    await assertClientAccess(salonId, clientId, connection, true)
    const current = (await readClinicalForms(connection, salonId, clientId)).find((form) => form.category === category)
    if ((current?.id ?? null) !== input.expectedProfileId
      || (current?.revision ?? null) !== input.expectedRevision) {
      throw new ApiError(409, 'This clinical form changed while you were editing. Reload it before saving again.')
    }
    const categories = await connection.query<{ id: string; enabled: boolean }>(
      `SELECT sc.id, (sc.is_active AND COALESCE(ssc.is_active, false)) AS enabled
       FROM service_categories sc LEFT JOIN salon_service_categories ssc ON ssc.category_id = sc.id AND ssc.salon_id = $1
       WHERE sc.code = $2 FOR SHARE OF sc`,
      [salonId, category],
    )
    const selectedCategory = categories.rows[0]
    if (!selectedCategory || (!current && !selectedCategory.enabled)) {
      throw new ApiError(400, 'This service category is disabled for the salon.')
    }
    const months = category === 'cosmetology' || category === 'micropigmentation' ? 6 : 12
    const questionnaires = await connection.query<{ id: string }>(
      `INSERT INTO health_questionnaires (
         salon_id, client_id, category_id, questionnaire_type, version, status,
         completed_at, expires_at, form_details_json, notes
       ) VALUES ($1, $2, $3, 'client_clinical_form', 1, 'completed', now(),
         now() + ($4::text || ' months')::interval, $5::jsonb, $6) RETURNING id`,
      [salonId, clientId, selectedCategory.id, months, JSON.stringify(input.details), input.notes],
    )
    const questionnaireId = questionnaires.rows[0]!.id
    const answers = { ...(input.details.healthAnswers as Record<string, unknown> | undefined) }
    for (const key of ['healthHistory', 'currentMedications', 'allergyReactionNotes', 'negativeExperience', 'negativeExperienceDetails', 'smoking', 'alcohol', 'herpesSimplex', 'phototype']) {
      if (input.details[key] !== undefined) answers[key] = input.details[key]
    }
    for (const [key, value] of Object.entries(answers)) {
      await connection.query(
        `INSERT INTO health_questionnaire_answers (questionnaire_id, question_key, answer_type, json_value)
         VALUES ($1, $2, 'json', $3::jsonb)`,
        [questionnaireId, key, value == null ? null : JSON.stringify(value)],
      )
    }
    const profiles = await connection.query<{ id: string }>(
      `INSERT INTO health_profile_versions (salon_id, client_id, category, questionnaire_id, valid_from, valid_until, status)
       VALUES ($1, $2, $3, $4, now(), now() + ($5::text || ' months')::interval, 'active') RETURNING id`,
      [salonId, clientId, category, questionnaireId, months],
    )
    await connection.query(
      `UPDATE health_profile_versions SET status = 'superseded', superseded_by_id = $4, updated_at = now()
       WHERE salon_id = $1 AND client_id = $2 AND category = $3 AND id <> $4 AND status = 'active'`,
      [salonId, clientId, category, profiles.rows[0]!.id],
    )
    return (await readClinicalForms(connection, salonId, clientId)).find((form) => form.id === profiles.rows[0]!.id)!
  })
}
