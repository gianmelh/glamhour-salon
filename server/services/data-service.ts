import crypto from 'node:crypto'
import type { PoolClient, QueryResultRow } from 'pg'
import { ApiError } from '../errors.js'
import { query, withTransaction } from '../db.js'
import { config } from '../config.js'
import { sendPasswordResetCode } from './email-service.js'
import { saveSalonMedia } from './media-storage.js'
import type {
  Appointment,
  Client,
  Invoice,
  Notification,
  Payment,
  Professional,
  Receipt,
  Review,
  Salon,
  SalonSettings,
  Service,
  ServiceCategory,
} from '../types/entities.js'

interface ListOptions {
  limit: number
  offset: number
}

interface AppointmentFilters extends ListOptions {
  from?: string
  to?: string
  professionalId?: string
  clientId?: string
  status?: string
}

interface SalesHistoryFilters extends ListOptions {
  professionalId?: string
  categoryId?: string
  category?: string
  from?: string
  to?: string
  startDate?: string
  endDate?: string
}

interface AvailabilityFilters {
  from: string
  to: string
  professionalId?: string
}

interface AppointmentAvailabilityFilters {
  providerId: string
  serviceId: string
  date: string
  timezone?: string
}

interface EligibleProviderFilters {
  serviceId: string
  categoryId?: string
  date?: string
  durationMinutes?: number
  optionalStartTime?: string
}

interface CreateAppointmentInput {
  salonId: string
  clientId: string
  professionalId: string
  serviceIds: string[]
  startsAt: string
  endsAt: string
  source: 'internal' | 'public_booking' | 'rebook'
  customerNotes?: string
  internalNotes?: string
  treatmentDetails?: Record<string, unknown>
  treatmentNotes?: string
  treatmentRecommendations?: string
  createdByUserId?: string
}

interface UpdateAppointmentStatusInput {
  status: string
  actorRole: 'owner' | 'admin' | 'professional' | 'receptionist' | 'client' | 'system'
  actorUserId?: string
  note?: string
}

interface CreateClientInput {
  fullName: string
  email?: string
  phone?: string
  dateOfBirth?: string
  preferredLanguage?: string
  notes?: string
}

interface CreateServiceInput {
  categoryId: string
  name: string
  description?: string
  durationMinutes: number
  priceMinor: number
  currencyCode: string
  isPubliclyBookable: boolean
}

interface UpdateSettingsInput {
  appointmentIntervalMinutes?: number
  minimumBookingNoticeMinutes?: number
  maximumBookingDaysAhead?: number
  cancellationNoticeMinutes?: number
  allowPublicBooking?: boolean
  requireBookingConfirmation?: boolean
  settingsJson?: Record<string, unknown>
}

interface OnboardingDayInput {
  enabled: boolean
  open: string
  close: string
}

interface OnboardingServiceInput {
  id: string
  categoryId: string
  name: string
  selected: boolean
  price: string
  duration: string
  section?: 'service' | 'material'
}

interface OnboardingProviderInput {
  id: string
  name: string
  email: string
  phone: string
  photoPreview?: string
  languages: string[]
  salonPercent: string
  professionalPercent: string
  serviceIds: string[]
  schedule: Record<string, OnboardingDayInput>
  useSalonSchedule?: boolean
}

interface SaveOnboardingInput {
  step: 'categories' | 'services' | 'schedule' | 'team' | 'complete'
  completed: boolean
  draft: {
    selectedCategoryIds: string[]
    services: OnboardingServiceInput[]
    schedule: Record<string, OnboardingDayInput>
    providers: OnboardingProviderInput[]
    activeProviderId?: string
  }
}

interface NailSettingsServiceInput {
  id?: string
  name: string
  description?: string | null
  priceMinor: number
  durationMinutes: number
  isActive: boolean
  sortOrder: number
}

interface NailMaterialInput {
  id?: string
  serviceId?: string | null
  name: string
  brand?: string | null
  materialType?: string | null
  unit?: string | null
  costMinor?: number | null
  isActive: boolean
  sortOrder: number
}

interface UpdateNailSettingsInput {
  categoryEnabled: boolean
  forceDisable?: boolean
  services: NailSettingsServiceInput[]
  materials: NailMaterialInput[]
}

interface QuestionnaireAnswerInput {
  questionKey: string
  answerType: 'boolean' | 'text' | 'number' | 'json'
  booleanValue?: boolean | null
  textValue?: string | null
  numericValue?: number | null
  jsonValue?: unknown
}

interface HealthQuestionnaireInput {
  clientId: string
  appointmentId?: string | null
  categoryId?: string | null
  category?: string
  questionnaireType: string
  version: number
  status: 'draft' | 'completed' | 'superseded' | 'expired'
  completedAt?: string | null
  expiresAt?: string | null
  createdByUserId?: string | null
  answers: QuestionnaireAnswerInput[]
}

interface ConsentRecordInput {
  clientId: string
  appointmentId: string
  questionnaireId?: string | null
  consentType: string
  consentVersion: number
  accepted: boolean
  acceptedAt?: string | null
  consentTextSnapshot: string
}

interface SignatureRecordInput {
  clientId: string
  appointmentId?: string | null
  questionnaireId?: string | null
  signatureType: 'client_consent' | 'professional_signature' | 'design_approval' | 'photography_consent'
  signerName: string
  signatureData: string
  signedAt?: string | null
}

interface AnnotationInput {
  clientId: string
  category: string
  bodyArea?: string | null
  annotationType: string
  xPosition?: number | null
  yPosition?: number | null
  width?: number | null
  height?: number | null
  pathData?: string | null
  pointsJson?: unknown
  notes?: string | null
}

interface ProfessionalServiceAssignmentInput {
  serviceId: string
  isActive: boolean
  durationOverrideMinutes?: number | null
  priceOverrideMinor?: number | null
}

interface UpsertProfessionalInput {
  fullName: string
  email?: string
  phone?: string
  avatarUrl?: string | null
  languages: string[]
  status: 'active' | 'inactive'
  salonEarningsPercent: number
  professionalEarningsPercent: number
  useSalonSchedule: boolean
  schedule?: Record<string, OnboardingDayInput>
  serviceAssignments: ProfessionalServiceAssignmentInput[]
}

interface ReassignProfessionalInput {
  replacementProviderId: string
  appointmentIds: string[]
}

interface DashboardAppointment {
  id: string
  starts_at: string
  ends_at: string
  status_code: string
  client_name: string
  professional_name: string
  services: Array<{
    service_name_snapshot: string
    category_code_snapshot: string
    duration_minutes_snapshot: number
    unit_price_minor: number
    status_code: string
  }>
}

interface DashboardResult {
  salon: Pick<Salon, 'id' | 'name' | 'slug' | 'currency_code' | 'timezone' | 'onboarding_status'>
  selectedDate: string
  revenue: {
    amountMinor: number
    currencyCode: string
    periodLabel: string
  }
  appointmentCount: number
  slotsRemaining: number
  activeStaffCount: number
  staffLimit: number
  upcomingAppointments: DashboardAppointment[]
  nextHourAppointmentCount: number
  bookingLink: string
  emptyStateFlags: {
    noAppointmentsToday: boolean
    noActiveStaff: boolean
    zeroRevenue: boolean
    staffLimitReached: boolean
  }
}

interface RegisterSalonInput {
  salonName: string
  email: string
  password: string
  acceptedTerms: true
  ownerFullName?: string
  location: {
    formattedAddress: string
    placeId?: string
  }
  document: {
    originalFilename: string
    mimeType: string
    size: number
  }
}

interface RegisterSalonResult {
  user: { id: string; email: string; full_name: string }
  salon: Salon
}

interface RegisterSocialSalonInput extends Omit<RegisterSalonInput, 'email' | 'password'> {
  authProvider: 'google' | 'facebook' | 'apple'
  authProviderSubject: string
  email: string
  ownerFullName: string
}

interface LoginInput {
  email: string
  password: string
}

interface AuthUser extends QueryResultRow {
  id: string
  email: string
  full_name: string
  auth_provider: string
}

interface AuthSalon extends QueryResultRow {
  id: string
  name: string
  slug: string
  role: string
}

interface LoginResult {
  user: AuthUser
  salons: AuthSalon[]
}

interface RequestPasswordResetInput {
  email: string
}

interface VerifyPasswordResetCodeInput {
  email: string
  code: string
}

interface ConfirmPasswordResetInput extends VerifyPasswordResetCodeInput {
  password: string
}

interface PasswordResetCodeRow extends QueryResultRow {
  id: string
  user_id: string
}

interface PasswordResetUserRow extends QueryResultRow {
  id: string
  email: string
  full_name: string
}

interface PasswordResetExpiryRow extends QueryResultRow {
  expires_at: string
}

interface PasswordResetRequestResult {
  email: string
  expiresAt: string
  devCode?: string
}

interface SalesHistoryRecord extends QueryResultRow {
  id: string
  appointment_id: string
  appointment_service_id: string
  salon_id: string
  client_id: string
  client_name: string
  professional_id: string
  professional_name: string
  provider_avatar_url: string | null
  starts_at: string
  ends_at: string
  recorded_at: string
  status_code: string
  service_id: string | null
  service_name: string
  category_id: string | null
  category_code: string
  category_name: string
  subtotal_minor: number
  discount_minor: number
  tax_minor: number
  tip_minor: number
  total_minor: number
  salon_earnings_minor: number
  professional_earnings_minor: number
  currency_code: string
  notes: string | null
  recommendations: string | null
  treatment_details: Record<string, unknown> | null
  completed_at: string | null
}

interface SalesHistoryResponse {
  filters: {
    providerId: string | null
    startDate: string | null
    endDate: string | null
    categoryId: string | null
  }
  summary: {
    salonIncome: number
    providerIncome: number
    tips: number
    recordCount: number
    totalAvailableCount: number
    currencyCode: string
    selectedProviderHasServices: boolean | null
    selectedProviderName: string | null
    selectedProviderAvatarUrl: string | null
  }
  records: SalesHistoryRecord[]
}

async function oneOrNotFound<T extends QueryResultRow>(
  sql: string,
  values: readonly unknown[],
  message: string,
): Promise<T> {
  const rows = await query<T>(sql, values)
  if (!rows[0]) throw new ApiError(404, message)
  return rows[0]
}

async function clientRows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: readonly unknown[],
): Promise<T[]> {
  const result = await client.query<T>(sql, [...values])
  return result.rows
}

function slugifySalonName(name: string) {
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'salon'
}

function safeStorageFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'verification-document'
}

const onboardingDayToPostgres: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
}

function parseOnboardingMoney(value: string) {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) {
    throw new ApiError(400, 'Service prices must be valid positive numbers.')
  }

  return Math.round(amount * 100)
}

function parseOnboardingInteger(value: string, message: string) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiError(400, message)
  }

  return parsed
}

function parsePercent(value: string, message: string) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new ApiError(400, message)
  }

  return parsed
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function dayOfWeekFromIsoDate(date: string) {
  return new Date(`${date}T12:00:00.000Z`).getUTCDay()
}

function timeToMinutes(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null
  }

  return hours * 60 + minutes
}

function minutesBetween(start: number, end: number) {
  return Math.max(0, end - start)
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

async function uniqueSalonSlug(client: PoolClient, salonName: string) {
  const baseSlug = slugifySalonName(salonName)

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix + 1}`
    const rows = await clientRows<QueryResultRow>(
      client,
      'SELECT 1 FROM salons WHERE slug = $1 LIMIT 1',
      [candidate],
    )

    if (!rows[0]) {
      return candidate
    }
  }

  return `${baseSlug}-${Date.now()}`
}

async function verifyActivePasswordResetCode(
  client: PoolClient,
  input: VerifyPasswordResetCodeInput,
): Promise<PasswordResetCodeRow> {
  const resetCodes = await clientRows<PasswordResetCodeRow>(
    client,
    `SELECT prc.id, prc.user_id
     FROM password_reset_codes prc
     JOIN users u ON u.id = prc.user_id
     WHERE lower(u.email) = lower($1)
       AND u.deleted_at IS NULL
       AND u.password_hash IS NOT NULL
       AND prc.consumed_at IS NULL
       AND prc.expires_at > now()
       AND prc.attempts < 5
       AND prc.code_hash = crypt($2, prc.code_hash)
     ORDER BY prc.created_at DESC
     LIMIT 1
     FOR UPDATE OF prc`,
    [input.email, input.code],
  )
  const resetCode = resetCodes[0]

  if (resetCode) {
    return resetCode
  }

  await client.query(
    `UPDATE password_reset_codes prc
     SET attempts = attempts + 1
     FROM users u
     WHERE u.id = prc.user_id
       AND lower(u.email) = lower($1)
       AND prc.consumed_at IS NULL
       AND prc.expires_at > now()
       AND prc.attempts < 5`,
    [input.email],
  )

  throw new ApiError(400, 'Invalid or expired verification code.')
}

function stepsCompletedThrough(step: SaveOnboardingInput['step']) {
  const order: SaveOnboardingInput['step'][] = ['categories', 'services', 'schedule', 'team', 'complete']
  const index = order.indexOf(step)
  return order.slice(0, Math.max(0, index + 1))
}

async function upsertSalonWorkingHours(
  client: PoolClient,
  salonId: string,
  schedule: Record<string, OnboardingDayInput>,
) {
  for (const [day, value] of Object.entries(schedule)) {
    const dayOfWeek = onboardingDayToPostgres[day]
    if (dayOfWeek === undefined) continue
    await client.query(
      `INSERT INTO salon_working_hours (
         salon_id, day_of_week, is_open, opens_at, closes_at
       ) VALUES ($1, $2, $3, $4::time, $5::time)
       ON CONFLICT (salon_id, day_of_week) DO UPDATE SET
         is_open = EXCLUDED.is_open,
         opens_at = EXCLUDED.opens_at,
         closes_at = EXCLUDED.closes_at`,
      [salonId, dayOfWeek, value.enabled, value.enabled ? value.open : null, value.enabled ? value.close : null],
    )
  }
}

async function upsertProfessionalWorkingHours(
  client: PoolClient,
  salonId: string,
  professionalId: string,
  schedule: Record<string, OnboardingDayInput>,
) {
  for (const [day, value] of Object.entries(schedule)) {
    const dayOfWeek = onboardingDayToPostgres[day]
    if (dayOfWeek === undefined) continue
    await client.query(
      `INSERT INTO professional_working_hours (
         salon_id, professional_id, day_of_week, is_working, starts_at, ends_at
       ) VALUES ($1, $2, $3, $4, $5::time, $6::time)
       ON CONFLICT (professional_id, day_of_week) DO UPDATE SET
         is_working = EXCLUDED.is_working,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at`,
      [
        salonId,
        professionalId,
        dayOfWeek,
        value.enabled,
        value.enabled ? value.open : null,
        value.enabled ? value.close : null,
      ],
    )
  }
}

function postgresDayToName(day: number) {
  return Object.entries(onboardingDayToPostgres).find(([, value]) => value === day)?.[0] ?? 'Monday'
}

function normalizeScheduleRows(rows: Array<{ day_of_week: number; enabled: boolean; open: string | null; close: string | null }>) {
  const schedule: Record<string, OnboardingDayInput> = {}
  for (const [dayName] of Object.entries(onboardingDayToPostgres)) {
    schedule[dayName] = { enabled: false, open: '09:00', close: '18:00' }
  }
  for (const row of rows) {
    schedule[postgresDayToName(row.day_of_week)] = {
      enabled: row.enabled,
      open: (row.open ?? '09:00').slice(0, 5),
      close: (row.close ?? '18:00').slice(0, 5),
    }
  }
  return schedule
}

let serviceMaterialsReady = false

async function ensureServiceMaterialsTable(client?: PoolClient) {
  if (serviceMaterialsReady) return
  const run = (text: string) => client ? client.query(text) : query(text)
  await run(
    `CREATE TABLE IF NOT EXISTS service_materials (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       category_id uuid NOT NULL REFERENCES service_categories(id) ON DELETE RESTRICT,
       service_id uuid,
       name varchar(160) NOT NULL,
       brand varchar(160),
       material_type varchar(100),
       unit varchar(40),
       cost_minor integer,
       currency_code char(3) NOT NULL DEFAULT 'USD',
       is_active boolean NOT NULL DEFAULT true,
       sort_order integer NOT NULL DEFAULT 0,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, id),
       FOREIGN KEY (salon_id, service_id) REFERENCES services(salon_id, id) ON DELETE SET NULL,
       CONSTRAINT service_materials_name_not_blank CHECK (btrim(name) <> ''),
       CONSTRAINT service_materials_cost_check CHECK (cost_minor IS NULL OR cost_minor >= 0),
       CONSTRAINT service_materials_currency_check CHECK (currency_code ~ '^[A-Z]{3}$')
     )`,
  )
  await run('CREATE INDEX IF NOT EXISTS service_materials_salon_category_idx ON service_materials (salon_id, category_id, is_active)')
  await run('CREATE INDEX IF NOT EXISTS service_materials_service_idx ON service_materials (salon_id, service_id) WHERE service_id IS NOT NULL')
  serviceMaterialsReady = true
}

let clinicalTablesReady = false

async function ensureClinicalTables(client?: PoolClient) {
  if (clinicalTablesReady) return
  const run = (text: string) => client ? client.query(text) : query(text)
  await run(
    `CREATE TABLE IF NOT EXISTS health_questionnaires (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       client_id uuid NOT NULL,
       appointment_id uuid,
       category_id uuid REFERENCES service_categories(id) ON DELETE RESTRICT,
       questionnaire_type varchar(80) NOT NULL,
       version integer NOT NULL DEFAULT 1,
       status varchar(30) NOT NULL DEFAULT 'draft',
       completed_at timestamptz,
       expires_at timestamptz,
       created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, id),
       FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
       FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE
     )`,
  )
  await run(
    `CREATE TABLE IF NOT EXISTS health_questionnaire_answers (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       questionnaire_id uuid NOT NULL REFERENCES health_questionnaires(id) ON DELETE CASCADE,
       question_key varchar(160) NOT NULL,
       answer_type varchar(30) NOT NULL,
       boolean_value boolean,
       text_value text,
       numeric_value numeric,
       json_value jsonb,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (questionnaire_id, question_key)
     )`,
  )
  await run(
    `ALTER TABLE consent_records
       ADD COLUMN IF NOT EXISTS questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
       ADD COLUMN IF NOT EXISTS consent_type varchar(80),
       ADD COLUMN IF NOT EXISTS consent_version integer NOT NULL DEFAULT 1,
       ADD COLUMN IF NOT EXISTS accepted boolean NOT NULL DEFAULT true,
       ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
       ADD COLUMN IF NOT EXISTS consent_text_snapshot text`,
  )
  await run(
    `CREATE TABLE IF NOT EXISTS signature_records (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       client_id uuid NOT NULL,
       appointment_id uuid,
       questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
       signature_type varchar(80) NOT NULL,
       signer_name varchar(160) NOT NULL,
       signature_data text NOT NULL,
       signed_at timestamptz NOT NULL DEFAULT now(),
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, id),
       FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
       FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE
     )`,
  )
  await run(
    `CREATE TABLE IF NOT EXISTS treatment_visual_annotations (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       client_id uuid NOT NULL,
       appointment_id uuid,
       category varchar(60) NOT NULL,
       body_area varchar(80),
       annotation_type varchar(80) NOT NULL,
       x_position numeric(8,4),
       y_position numeric(8,4),
       width numeric(8,4),
       height numeric(8,4),
       path_data text,
       points_json jsonb,
       notes text,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, id),
       FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE,
       FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE
     )`,
  )
  await run(
    `CREATE TABLE IF NOT EXISTS appointment_category_details (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       appointment_id uuid NOT NULL,
       category varchar(60) NOT NULL,
       details_json jsonb NOT NULL DEFAULT '{}'::jsonb,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, appointment_id, category),
       FOREIGN KEY (salon_id, appointment_id) REFERENCES appointments(salon_id, id) ON DELETE CASCADE
     )`,
  )
  await run(
    `CREATE TABLE IF NOT EXISTS health_profile_versions (
       id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
       salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
       client_id uuid NOT NULL,
       category varchar(60) NOT NULL,
       questionnaire_id uuid REFERENCES health_questionnaires(id) ON DELETE SET NULL,
       valid_from timestamptz NOT NULL DEFAULT now(),
       valid_until timestamptz NOT NULL,
       status varchar(30) NOT NULL DEFAULT 'active',
       superseded_by_id uuid REFERENCES health_profile_versions(id) ON DELETE SET NULL,
       medical_change_confirmed_at timestamptz,
       created_at timestamptz NOT NULL DEFAULT now(),
       updated_at timestamptz NOT NULL DEFAULT now(),
       UNIQUE (salon_id, id),
       FOREIGN KEY (salon_id, client_id) REFERENCES clients(salon_id, id) ON DELETE CASCADE
     )`,
  )
  await run('CREATE INDEX IF NOT EXISTS health_questionnaires_client_idx ON health_questionnaires (salon_id, client_id, completed_at DESC)')
  await run('CREATE INDEX IF NOT EXISTS appointment_category_details_appointment_idx ON appointment_category_details (salon_id, appointment_id, category)')
  await run('CREATE INDEX IF NOT EXISTS treatment_annotations_appointment_idx ON treatment_visual_annotations (salon_id, appointment_id, category)')
  await run('CREATE INDEX IF NOT EXISTS health_profile_versions_client_category_idx ON health_profile_versions (salon_id, client_id, category, status, valid_until DESC)')
  clinicalTablesReady = true
}

async function persistTreatmentVisualAnnotations(
  client: PoolClient,
  salonId: string,
  clientId: string,
  appointmentId: string,
  categoryCode: string,
  treatmentDetails: Record<string, unknown>,
) {
  const faceAnnotations = treatmentDetails.faceAnnotations
  if (Array.isArray(faceAnnotations)) {
    for (const item of faceAnnotations) {
      if (!item || typeof item !== 'object') continue
      const annotation = item as Record<string, unknown>
      await client.query(
        `INSERT INTO treatment_visual_annotations (
           salon_id, client_id, appointment_id, category, body_area, annotation_type,
           x_position, y_position, notes
         ) VALUES ($1, $2, $3, $4, 'face', $5, $6, $7, $8)`,
        [
          salonId,
          clientId,
          appointmentId,
          categoryCode,
          typeof annotation.type === 'string' ? annotation.type : 'annotation',
          typeof annotation.x === 'number' ? annotation.x : null,
          typeof annotation.y === 'number' ? annotation.y : null,
          typeof annotation.type === 'string' ? annotation.type : null,
        ],
      )
    }
  }

  const lashMap = treatmentDetails.lashMap
  if (lashMap && typeof lashMap === 'object' && !Array.isArray(lashMap)) {
    for (const [eye, entries] of Object.entries(lashMap as Record<string, unknown>)) {
      if (!Array.isArray(entries) || !entries.length) continue
      await client.query(
        `INSERT INTO treatment_visual_annotations (
           salon_id, client_id, appointment_id, category, body_area, annotation_type, points_json
         ) VALUES ($1, $2, $3, $4, $5, 'lash_map', $6::jsonb)`,
        [salonId, clientId, appointmentId, categoryCode, eye, JSON.stringify(entries)],
      )
    }
  }

  for (const handKey of ['rightHand', 'leftHand'] as const) {
    const hand = treatmentDetails[handKey]
    if (!hand || typeof hand !== 'object' || Array.isArray(hand)) continue
    const hasData = Object.values(hand as Record<string, unknown>).some(
      (finger) => finger && typeof finger === 'object' && Object.keys(finger as object).length > 0,
    )
    if (!hasData) continue
    await client.query(
      `INSERT INTO treatment_visual_annotations (
         salon_id, client_id, appointment_id, category, body_area, annotation_type, points_json
       ) VALUES ($1, $2, $3, $4, $5, 'nail_measurements', $6::jsonb)`,
      [salonId, clientId, appointmentId, categoryCode, handKey, JSON.stringify(hand)],
    )
  }
}

function normalizeHealthAnswerValue(answerValue: unknown) {
  if (answerValue === 'yes') return { answerType: 'boolean' as const, booleanValue: true, textValue: null, numericValue: null, jsonValue: null }
  if (answerValue === 'no') return { answerType: 'boolean' as const, booleanValue: false, textValue: null, numericValue: null, jsonValue: null }
  if (typeof answerValue === 'boolean') return { answerType: 'boolean' as const, booleanValue: answerValue, textValue: null, numericValue: null, jsonValue: null }
  if (typeof answerValue === 'number') return { answerType: 'number' as const, booleanValue: null, textValue: null, numericValue: answerValue, jsonValue: null }
  if (typeof answerValue === 'string') return { answerType: 'text' as const, booleanValue: null, textValue: answerValue, numericValue: null, jsonValue: null }
  return { answerType: 'json' as const, booleanValue: null, textValue: null, numericValue: null, jsonValue: JSON.stringify(answerValue) }
}

function timeStringToMinutes(value: string | null | undefined) {
  if (!value) return null
  const [hours, minutes] = value.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

function minutesToTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60).toString().padStart(2, '0')
  const minutes = (totalMinutes % 60).toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function dateAtLocalTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function getUtcDayOfWeek(date: string) {
  return dateAtLocalTime(date, '12:00').getDay()
}

async function ensureSalonCategoriesForAssignments(
  client: PoolClient,
  salonId: string,
  assignments: ProfessionalServiceAssignmentInput[],
) {
  const serviceIds = assignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId)
  if (!serviceIds.length) return
  await client.query(
    `INSERT INTO salon_service_categories (salon_id, category_id, is_active)
     SELECT DISTINCT $1::uuid, s.category_id, true
     FROM services s
     WHERE s.salon_id = $1::uuid
       AND s.id = ANY($2::uuid[])
       AND s.is_active
     ON CONFLICT (salon_id, category_id) DO UPDATE SET is_active = true`,
    [salonId, serviceIds],
  )
}

async function validateProfessionalAssignments(
  client: PoolClient,
  salonId: string,
  assignments: ProfessionalServiceAssignmentInput[],
) {
  const serviceIds = assignments.filter((assignment) => assignment.isActive).map((assignment) => assignment.serviceId)
  if (!serviceIds.length) return
  const uniqueServiceIds = [...new Set(serviceIds)]
  if (uniqueServiceIds.length !== serviceIds.length) {
    throw new ApiError(400, 'Provider service assignments cannot contain duplicates.')
  }

  await ensureSalonCategoriesForAssignments(client, salonId, assignments)

  const validRows = await clientRows<QueryResultRow & { id: string }>(
    client,
    `SELECT s.id
     FROM services s
     JOIN service_categories sc ON sc.id = s.category_id AND sc.is_active
     WHERE s.salon_id = $1::uuid
       AND s.id = ANY($2::uuid[])
       AND s.is_active`,
    [salonId, uniqueServiceIds],
  )
  if (validRows.length !== uniqueServiceIds.length) {
    throw new ApiError(400, 'One or more selected services are unavailable for this salon. Refresh the page and choose active services again.')
  }
}

async function saveProfessionalAssignments(
  client: PoolClient,
  salonId: string,
  professionalId: string,
  assignments: ProfessionalServiceAssignmentInput[],
) {
  await client.query(
    'UPDATE professional_services SET is_active = false WHERE salon_id = $1 AND professional_id = $2',
    [salonId, professionalId],
  )
  for (const assignment of assignments) {
    await client.query(
      `INSERT INTO professional_services (
         salon_id, professional_id, service_id, duration_override_minutes, price_override_minor, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (professional_id, service_id) DO UPDATE SET
         duration_override_minutes = EXCLUDED.duration_override_minutes,
         price_override_minor = EXCLUDED.price_override_minor,
         is_active = EXCLUDED.is_active`,
      [
        salonId,
        professionalId,
        assignment.serviceId,
        assignment.durationOverrideMinutes ?? null,
        assignment.priceOverrideMinor ?? null,
        assignment.isActive,
      ],
    )
  }
}

export const dataService = {
  async requestPasswordReset(input: RequestPasswordResetInput): Promise<PasswordResetRequestResult> {
    const code = String(crypto.randomInt(100000, 1000000))

    const result = await withTransaction(async (client) => {
      const users = await clientRows<PasswordResetUserRow>(
        client,
        `SELECT id, email, full_name
         FROM users
         WHERE lower(email) = lower($1)
           AND deleted_at IS NULL
           AND password_hash IS NOT NULL
         LIMIT 1`,
        [input.email],
      )
      const user = users[0]

      if (!user) {
        throw new ApiError(404, 'No account was found for this email.')
      }

      await client.query(
        `UPDATE password_reset_codes
         SET consumed_at = now()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id],
      )

      const resetCodes = await clientRows<PasswordResetExpiryRow>(
        client,
        `INSERT INTO password_reset_codes (user_id, code_hash, expires_at)
         VALUES ($1, crypt($2, gen_salt('bf')), now() + interval '10 minutes')
         RETURNING expires_at`,
        [user.id, code],
      )
      const resetCode = resetCodes[0]
      if (!resetCode) throw new ApiError(500, 'Password reset code could not be created.')

      return {
        email: user.email,
        expiresAt: resetCode.expires_at,
        name: user.full_name,
      }
    })

    await sendPasswordResetCode({
      code,
      email: result.email,
      name: result.name,
    })

    return {
      email: result.email,
      expiresAt: result.expiresAt,
      devCode: config.NODE_ENV === 'production' ? undefined : code,
    }
  },

  async verifyPasswordResetCode(input: VerifyPasswordResetCodeInput): Promise<{ valid: true }> {
    await withTransaction(async (client) => {
      await verifyActivePasswordResetCode(client, input)
    })

    return { valid: true }
  },

  async confirmPasswordReset(input: ConfirmPasswordResetInput): Promise<{ reset: true }> {
    await withTransaction(async (client) => {
      const resetCode = await verifyActivePasswordResetCode(client, input)

      await client.query(
        `UPDATE users
         SET password_hash = crypt($2, gen_salt('bf'))
         WHERE id = $1`,
        [resetCode.user_id, input.password],
      )
      await client.query(
        'UPDATE password_reset_codes SET consumed_at = now() WHERE id = $1',
        [resetCode.id],
      )
    })

    return { reset: true }
  },

  login(input: LoginInput): Promise<LoginResult> {
    return withTransaction(async (client) => {
      const users = await clientRows<AuthUser>(
        client,
        `SELECT id, email, full_name, auth_provider
         FROM users
         WHERE lower(email) = lower($1)
           AND deleted_at IS NULL
           AND password_hash IS NOT NULL
           AND password_hash = crypt($2, password_hash)
         LIMIT 1`,
        [input.email, input.password],
      )
      const user = users[0]

      if (!user) {
        throw new ApiError(401, 'Invalid email or password.')
      }

      await client.query(
        'UPDATE users SET last_login_at = now() WHERE id = $1',
        [user.id],
      )

      const salons = await clientRows<AuthSalon>(
        client,
        `SELECT s.id, s.name, s.slug, sm.role
         FROM salon_memberships sm
         JOIN salons s ON s.id = sm.salon_id
         WHERE sm.user_id = $1
           AND sm.status = 'active'
           AND s.deleted_at IS NULL
           AND s.is_active
         ORDER BY sm.role = 'owner' DESC, s.name`,
        [user.id],
      )

      return { user, salons }
    })
  },

  registerSocialSalon(input: RegisterSocialSalonInput): Promise<RegisterSalonResult> {
    return withTransaction(async (client) => {
      const existingIdentities = await clientRows<QueryResultRow>(
        client,
        `SELECT 1 FROM users
         WHERE auth_provider = $1 AND auth_provider_subject = $2 AND deleted_at IS NULL
         LIMIT 1`,
        [input.authProvider, input.authProviderSubject],
      )

      if (existingIdentities[0]) {
        throw new ApiError(409, `This ${input.authProvider} account is already registered.`)
      }

      const existingUsers = await clientRows<QueryResultRow>(
        client,
        'SELECT 1 FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1',
        [input.email],
      )

      if (existingUsers[0]) {
        throw new ApiError(409, 'An account with this email already exists.')
      }

      const users = await clientRows<{ id: string; email: string; full_name: string }>(
        client,
        `INSERT INTO users (
           auth_provider, auth_provider_subject, email, password_hash,
           full_name, email_verified_at
         ) VALUES ($1, $2, lower($3), null, $4, now())
         RETURNING id, email, full_name`,
        [input.authProvider, input.authProviderSubject, input.email, input.ownerFullName],
      )
      const user = users[0]
      if (!user) throw new ApiError(500, 'User could not be created.')

      const slug = await uniqueSalonSlug(client, input.salonName)
      const salons = await clientRows<Salon>(
        client,
        `INSERT INTO salons (
           name, slug, email, address_line_1, verification_status,
           onboarding_status, onboarding_step, booking_enabled
         ) VALUES ($1, $2, lower($3), $4, 'under_review', 'in_progress', 'service_categories', false)
         RETURNING *`,
        [input.salonName, slug, input.email, input.location.formattedAddress],
      )
      const salon = salons[0]
      if (!salon) throw new ApiError(500, 'Salon could not be created.')

      await client.query(
        'INSERT INTO salon_owners (salon_id, user_id, is_primary, ownership_percent) VALUES ($1, $2, true, 100.00)',
        [salon.id, user.id],
      )
      await client.query(
        `INSERT INTO salon_memberships (salon_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'owner', 'active', now())`,
        [salon.id, user.id],
      )
      await client.query(
        'INSERT INTO user_settings (user_id, timezone, locale) VALUES ($1, $2, $3)',
        [user.id, salon.timezone, salon.locale],
      )
      await client.query(
        `INSERT INTO salon_settings (salon_id, settings_json)
         VALUES ($1, $2::jsonb)`,
        [
          salon.id,
          JSON.stringify({
            registrationSource: input.authProvider,
            googlePlaceId: input.location.placeId ?? null,
          }),
        ],
      )
      await client.query(
        `INSERT INTO salon_verification_documents (
           salon_id, uploaded_by_user_id, document_type, storage_key,
           original_filename, mime_type, review_status
         ) VALUES ($1, $2, 'proof_of_ownership', $3, $4, $5, 'pending')`,
        [
          salon.id,
          user.id,
          `salon-verification/${salon.id}/${safeStorageFilename(input.document.originalFilename)}`,
          input.document.originalFilename,
          input.document.mimeType,
        ],
      )
      await client.query(
        `INSERT INTO onboarding_sessions (salon_id, current_step, draft_data)
         VALUES ($1, 'service_categories', $2::jsonb)`,
        [
          salon.id,
          JSON.stringify({
            salonName: input.salonName,
            ownerEmail: input.email,
            location: input.location,
            authProvider: input.authProvider,
            verificationDocument: {
              originalFilename: input.document.originalFilename,
              mimeType: input.document.mimeType,
              size: input.document.size,
            },
          }),
        ],
      )
      await client.query(
        `INSERT INTO legal_acceptances (user_id, salon_id, legal_document_id, user_agent)
         SELECT $1, $2, id, $3
         FROM legal_documents
         WHERE is_active AND document_type IN ('terms', 'privacy')
         ON CONFLICT DO NOTHING`,
        [user.id, salon.id, `Glamhour ${input.authProvider} signup`],
      )

      return { user, salon }
    })
  },

  registerSalon(input: RegisterSalonInput): Promise<RegisterSalonResult> {
    return withTransaction(async (client) => {
      const existingUsers = await clientRows<QueryResultRow>(
        client,
        'SELECT 1 FROM users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1',
        [input.email],
      )

      if (existingUsers[0]) {
        throw new ApiError(409, 'An account with this email already exists.')
      }

      const ownerName = input.ownerFullName?.trim() || `${input.salonName.trim()} Owner`
      const users = await clientRows<{ id: string; email: string; full_name: string }>(
        client,
        `INSERT INTO users (auth_provider, email, password_hash, full_name)
         VALUES ('email', lower($1), crypt($2, gen_salt('bf')), $3)
         RETURNING id, email, full_name`,
        [input.email, input.password, ownerName],
      )
      const user = users[0]
      if (!user) throw new ApiError(500, 'User could not be created.')

      const slug = await uniqueSalonSlug(client, input.salonName)
      const salons = await clientRows<Salon>(
        client,
        `INSERT INTO salons (
           name, slug, email, address_line_1, verification_status,
           onboarding_status, onboarding_step, booking_enabled
         ) VALUES ($1, $2, lower($3), $4, 'under_review', 'in_progress', 'service_categories', false)
         RETURNING *`,
        [input.salonName, slug, input.email, input.location.formattedAddress],
      )
      const salon = salons[0]
      if (!salon) throw new ApiError(500, 'Salon could not be created.')

      await client.query(
        'INSERT INTO salon_owners (salon_id, user_id, is_primary, ownership_percent) VALUES ($1, $2, true, 100.00)',
        [salon.id, user.id],
      )
      await client.query(
        `INSERT INTO salon_memberships (salon_id, user_id, role, status, joined_at)
         VALUES ($1, $2, 'owner', 'active', now())`,
        [salon.id, user.id],
      )
      await client.query(
        'INSERT INTO user_settings (user_id, timezone, locale) VALUES ($1, $2, $3)',
        [user.id, salon.timezone, salon.locale],
      )
      await client.query(
        `INSERT INTO salon_settings (salon_id, settings_json)
         VALUES ($1, $2::jsonb)`,
        [
          salon.id,
          JSON.stringify({
            registrationSource: 'self_serve',
            googlePlaceId: input.location.placeId ?? null,
          }),
        ],
      )
      await client.query(
        `INSERT INTO salon_verification_documents (
           salon_id, uploaded_by_user_id, document_type, storage_key,
           original_filename, mime_type, review_status
         ) VALUES ($1, $2, 'proof_of_ownership', $3, $4, $5, 'pending')`,
        [
          salon.id,
          user.id,
          `salon-verification/${salon.id}/${safeStorageFilename(input.document.originalFilename)}`,
          input.document.originalFilename,
          input.document.mimeType,
        ],
      )
      await client.query(
        `INSERT INTO onboarding_sessions (salon_id, current_step, draft_data)
         VALUES ($1, 'service_categories', $2::jsonb)`,
        [
          salon.id,
          JSON.stringify({
            salonName: input.salonName,
            ownerEmail: input.email,
            location: input.location,
            verificationDocument: {
              originalFilename: input.document.originalFilename,
              mimeType: input.document.mimeType,
              size: input.document.size,
            },
          }),
        ],
      )
      await client.query(
        `INSERT INTO legal_acceptances (user_id, salon_id, legal_document_id, user_agent)
         SELECT $1, $2, id, 'Glamhour signup'
         FROM legal_documents
         WHERE is_active AND document_type IN ('terms', 'privacy')
         ON CONFLICT DO NOTHING`,
        [user.id, salon.id],
      )

      return { user, salon }
    })
  },

  listSalons(options: ListOptions): Promise<Salon[]> {
    return query<Salon>(
      `SELECT * FROM salons
       WHERE deleted_at IS NULL
       ORDER BY name
       LIMIT $1 OFFSET $2`,
      [options.limit, options.offset],
    )
  },

  getSalon(id: string): Promise<Salon> {
    return oneOrNotFound<Salon>(
      'SELECT * FROM salons WHERE id = $1 AND deleted_at IS NULL',
      [id],
      'Salon not found',
    )
  },

  async getDashboard(salonId: string, selectedDateInput?: string): Promise<DashboardResult> {
    const selectedDate = selectedDateInput ?? todayIsoDate()
    const staffLimit = 10
    const salon = await this.getSalon(salonId)
    const dayOfWeek = dayOfWeekFromIsoDate(selectedDate)

    const [
      revenueRows,
      countRows,
      upcomingAppointments,
      nextHourRows,
      staffRows,
      slotDurationRows,
      salonHoursRows,
      professionalHoursRows,
      appointmentBlockRows,
      exceptionBlockRows,
    ] = await Promise.all([
      query<{ amount_minor: string | number | null }>(
        `WITH salon_context AS (
           SELECT timezone FROM salons WHERE id = $1 AND deleted_at IS NULL
         ),
         week_bounds AS (
           SELECT
             (date_trunc('week', $2::date::timestamp) AT TIME ZONE timezone) AS starts_at,
             ((date_trunc('week', $2::date::timestamp) + interval '7 days') AT TIME ZONE timezone) AS ends_at
           FROM salon_context
         ),
         completed_financials AS (
           SELECT COALESCE(SUM(af.total_minor), 0) AS amount_minor
           FROM appointment_financials af
           JOIN appointments a ON a.salon_id = af.salon_id AND a.id = af.appointment_id
           CROSS JOIN week_bounds wb
           WHERE af.salon_id = $1
             AND a.status_code = 'completed'
             AND a.starts_at >= wb.starts_at
             AND a.starts_at < wb.ends_at
         ),
         paid_payments AS (
           SELECT COALESCE(SUM(p.amount_minor + p.tip_minor), 0) AS amount_minor
           FROM payments p
           JOIN appointments a ON a.salon_id = p.salon_id AND a.id = p.appointment_id
           CROSS JOIN week_bounds wb
           WHERE p.salon_id = $1
             AND p.status IN ('paid', 'authorized')
             AND a.status_code <> 'canceled'
             AND a.starts_at >= wb.starts_at
             AND a.starts_at < wb.ends_at
             AND NOT EXISTS (
               SELECT 1 FROM appointment_financials af
               WHERE af.salon_id = p.salon_id AND af.appointment_id = p.appointment_id
             )
         )
         SELECT (completed_financials.amount_minor + paid_payments.amount_minor) AS amount_minor
         FROM completed_financials, paid_payments`,
        [salonId, selectedDate],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM appointments a
         JOIN salons s ON s.id = a.salon_id
         WHERE a.salon_id = $1
           AND (a.starts_at AT TIME ZONE s.timezone)::date = $2::date
           AND a.status_code <> 'canceled'`,
        [salonId, selectedDate],
      ),
      query<DashboardAppointment>(
        `SELECT a.id, a.starts_at, a.ends_at, a.status_code,
           c.full_name AS client_name,
           p.full_name AS professional_name,
           COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'service_name_snapshot', aps.service_name_snapshot,
               'category_code_snapshot', aps.category_code_snapshot,
               'duration_minutes_snapshot', aps.duration_minutes_snapshot,
               'unit_price_minor', aps.unit_price_minor,
               'status_code', aps.status_code
             ) ORDER BY aps.created_at)
             FROM appointment_services aps
             WHERE aps.salon_id = a.salon_id AND aps.appointment_id = a.id
           ), '[]'::jsonb) AS services
         FROM appointments a
         JOIN salons s ON s.id = a.salon_id
         JOIN clients c ON c.salon_id = a.salon_id AND c.id = a.client_id
         JOIN professionals p ON p.salon_id = a.salon_id AND p.id = a.professional_id
         WHERE a.salon_id = $1
           AND (a.starts_at AT TIME ZONE s.timezone)::date = $2::date
           AND a.status_code <> 'canceled'
         ORDER BY a.starts_at
         LIMIT 5`,
        [salonId, selectedDate],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM appointments
         WHERE salon_id = $1
           AND status_code NOT IN ('completed', 'canceled', 'no_show')
           AND starts_at >= now()
           AND starts_at < now() + interval '1 hour'`,
        [salonId],
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM professionals
         WHERE salon_id = $1 AND deleted_at IS NULL AND status = 'active'`,
        [salonId],
      ),
      query<{ duration_minutes: number | null; appointment_interval_minutes: number }>(
        `SELECT MIN(s.duration_minutes) AS duration_minutes, ss.appointment_interval_minutes
         FROM salon_settings ss
         LEFT JOIN services s ON s.salon_id = ss.salon_id AND s.is_active
         WHERE ss.salon_id = $1
         GROUP BY ss.appointment_interval_minutes`,
        [salonId],
      ),
      query<{ day_of_week: number; is_open: boolean; opens_at: string | null; closes_at: string | null }>(
        `SELECT day_of_week, is_open, opens_at::text, closes_at::text
         FROM salon_working_hours
         WHERE salon_id = $1 AND day_of_week = $2`,
        [salonId, dayOfWeek],
      ),
      query<{ professional_id: string; is_working: boolean; starts_at: string | null; ends_at: string | null }>(
        `SELECT p.id AS professional_id,
           COALESCE(pwh.is_working, swh.is_open, false) AS is_working,
           COALESCE(pwh.starts_at::text, swh.opens_at::text) AS starts_at,
           COALESCE(pwh.ends_at::text, swh.closes_at::text) AS ends_at
         FROM professionals p
         LEFT JOIN salon_working_hours swh
           ON swh.salon_id = p.salon_id AND swh.day_of_week = $2
         LEFT JOIN professional_working_hours pwh
           ON pwh.salon_id = p.salon_id AND pwh.professional_id = p.id AND pwh.day_of_week = $2
         WHERE p.salon_id = $1
           AND p.deleted_at IS NULL
           AND p.status = 'active'`,
        [salonId, dayOfWeek],
      ),
      query<{ professional_id: string; start_minute: string; end_minute: string }>(
        `SELECT a.professional_id,
           EXTRACT(EPOCH FROM ((a.starts_at AT TIME ZONE s.timezone)::time)) / 60 AS start_minute,
           EXTRACT(EPOCH FROM ((a.ends_at AT TIME ZONE s.timezone)::time)) / 60 AS end_minute
         FROM appointments a
         JOIN salons s ON s.id = a.salon_id
         WHERE a.salon_id = $1
           AND (a.starts_at AT TIME ZONE s.timezone)::date = $2::date
           AND a.status_code NOT IN ('completed', 'canceled', 'no_show')`,
        [salonId, selectedDate],
      ),
      query<{ professional_id: string | null; start_minute: string; end_minute: string }>(
        `SELECT ae.professional_id,
           EXTRACT(EPOCH FROM ((ae.starts_at AT TIME ZONE s.timezone)::time)) / 60 AS start_minute,
           EXTRACT(EPOCH FROM ((ae.ends_at AT TIME ZONE s.timezone)::time)) / 60 AS end_minute
         FROM availability_exceptions ae
         JOIN salons s ON s.id = ae.salon_id
         WHERE ae.salon_id = $1
           AND (ae.starts_at AT TIME ZONE s.timezone)::date = $2::date
           AND ae.exception_type IN ('blocked', 'time_off', 'holiday')`,
        [salonId, selectedDate],
      ),
    ])

    const slotDuration = Math.max(
      1,
      Number(slotDurationRows[0]?.duration_minutes ?? slotDurationRows[0]?.appointment_interval_minutes ?? 60),
    )
    const globalSalonHours = salonHoursRows[0]
    const globalExceptionBlocks = exceptionBlockRows.filter((row) => row.professional_id === null)
    let availableMinutes = 0

    for (const professionalHours of professionalHoursRows) {
      const opensAt = timeToMinutes(professionalHours.starts_at ?? globalSalonHours?.opens_at)
      const closesAt = timeToMinutes(professionalHours.ends_at ?? globalSalonHours?.closes_at)
      if (!professionalHours.is_working || opensAt === null || closesAt === null || closesAt <= opensAt) {
        continue
      }

      let minutes = minutesBetween(opensAt, closesAt)
      const appointmentBlocks = appointmentBlockRows.filter((row) => row.professional_id === professionalHours.professional_id)
      const professionalExceptionBlocks = exceptionBlockRows.filter((row) => row.professional_id === professionalHours.professional_id)
      for (const block of [...appointmentBlocks, ...professionalExceptionBlocks, ...globalExceptionBlocks]) {
        const blockStart = Number(block.start_minute)
        const blockEnd = Number(block.end_minute)
        if (!Number.isFinite(blockStart) || !Number.isFinite(blockEnd)) {
          continue
        }

        minutes -= minutesBetween(Math.max(opensAt, blockStart), Math.min(closesAt, blockEnd))
      }
      availableMinutes += Math.max(0, minutes)
    }

    const revenueAmountMinor = Number(revenueRows[0]?.amount_minor ?? 0)
    const appointmentCount = Number(countRows[0]?.count ?? 0)
    const activeStaffCount = Number(staffRows[0]?.count ?? 0)

    return {
      salon: {
        id: salon.id,
        name: salon.name,
        slug: salon.slug,
        currency_code: salon.currency_code,
        timezone: salon.timezone,
        onboarding_status: salon.onboarding_status,
      },
      selectedDate,
      revenue: {
        amountMinor: revenueAmountMinor,
        currencyCode: salon.currency_code,
        periodLabel: 'This week',
      },
      appointmentCount,
      slotsRemaining: Math.max(0, Math.floor(availableMinutes / slotDuration)),
      activeStaffCount,
      staffLimit,
      upcomingAppointments,
      nextHourAppointmentCount: Number(nextHourRows[0]?.count ?? 0),
      bookingLink: `https://glamhour.app/${salon.slug}`,
      emptyStateFlags: {
        noAppointmentsToday: appointmentCount === 0,
        noActiveStaff: activeStaffCount === 0,
        zeroRevenue: revenueAmountMinor === 0,
        staffLimitReached: activeStaffCount >= staffLimit,
      },
    }
  },

  getSalonBySlug(slug: string): Promise<Salon> {
    return oneOrNotFound<Salon>(
      'SELECT * FROM salons WHERE slug = $1 AND deleted_at IS NULL',
      [slug],
      'Salon not found',
    )
  },

  saveOnboarding(salonId: string, input: SaveOnboardingInput): Promise<Salon> {
    return withTransaction(async (client) => {
      const salons = await clientRows<Salon>(
        client,
        'SELECT * FROM salons WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
        [salonId],
      )
      const salon = salons[0]
      if (!salon) throw new ApiError(404, 'Salon not found')

      const completedSteps = stepsCompletedThrough(input.step)
      await client.query(
        `INSERT INTO onboarding_sessions (
           salon_id, current_step, completed_steps, draft_data, completed_at
         ) VALUES ($1, $2, $3, $4::jsonb, $5)
         ON CONFLICT (salon_id) DO UPDATE SET
           current_step = EXCLUDED.current_step,
           completed_steps = EXCLUDED.completed_steps,
           draft_data = EXCLUDED.draft_data,
           completed_at = EXCLUDED.completed_at`,
        [
          salonId,
          input.step,
          completedSteps,
          JSON.stringify(input.draft),
          input.completed ? new Date().toISOString() : null,
        ],
      )

      await client.query(
        `UPDATE salons
         SET onboarding_status = $2::varchar,
             onboarding_step = $3::varchar,
             booking_enabled = CASE WHEN $2::varchar = 'completed' THEN true ELSE booking_enabled END
         WHERE id = $1`,
        [salonId, input.completed ? 'completed' : 'in_progress', input.completed ? null : input.step],
      )

      if (!input.completed) {
        const rows = await clientRows<Salon>(
          client,
          'SELECT * FROM salons WHERE id = $1 AND deleted_at IS NULL',
          [salonId],
        )
        if (!rows[0]) throw new ApiError(404, 'Salon not found')
        return rows[0]
      }

      const selectedCategoryIds = [...new Set(input.draft.selectedCategoryIds)]
      if (!selectedCategoryIds.length) {
        throw new ApiError(400, 'Select at least one service category.')
      }

      const selectedServices = input.draft.services.filter((service) => (
        service.selected && service.section !== 'material' && selectedCategoryIds.includes(service.categoryId)
        && service.price.trim() !== ''
        && Number.isFinite(Number(service.price))
        && Number.isInteger(Number(service.duration))
        && Number(service.duration) > 0
      ))
      if (!selectedServices.length) {
        throw new ApiError(400, 'Select at least one service.')
      }

      const selectedServiceDraftIds = new Set(selectedServices.map((service) => service.id))
      const activeProviders = input.draft.providers.filter((provider) => (
        provider.name.trim() && provider.serviceIds.some((serviceId) => selectedServiceDraftIds.has(serviceId))
      ))
      if (!activeProviders.length) {
        throw new ApiError(400, 'Add at least one provider and assign a service.')
      }
      if (activeProviders.length > 10) {
        throw new ApiError(400, 'You’ve reached the limit of 10 active staff members. Upgrade your plan to add more providers.')
      }

      await client.query(
        'UPDATE salon_service_categories SET is_active = false WHERE salon_id = $1',
        [salonId],
      )
      for (const categoryId of selectedCategoryIds) {
        await client.query(
          `INSERT INTO salon_service_categories (salon_id, category_id, is_active)
           VALUES ($1, $2, true)
           ON CONFLICT (salon_id, category_id) DO UPDATE SET is_active = true`,
          [salonId, categoryId],
        )
      }

      const serviceIdByDraftId = new Map<string, string>()
      for (const [index, service] of selectedServices.entries()) {
        const durationMinutes = parseOnboardingInteger(service.duration, 'Service durations must be positive whole minutes.')
        const priceMinor = parseOnboardingMoney(service.price)
        const existing = await clientRows<{ id: string }>(
          client,
          `SELECT id FROM services
           WHERE salon_id = $1 AND category_id = $2 AND lower(name) = lower($3)
           ORDER BY created_at
           LIMIT 1`,
          [salonId, service.categoryId, service.name.trim()],
        )

        const rows = existing[0]
          ? await clientRows<{ id: string }>(
              client,
              `UPDATE services
               SET name = $3,
                   duration_minutes = $4,
                   price_minor = $5,
                   currency_code = 'USD',
                   is_active = true,
                   is_publicly_bookable = true,
                   sort_order = $6
               WHERE salon_id = $1 AND id = $2
               RETURNING id`,
              [salonId, existing[0].id, service.name.trim(), durationMinutes, priceMinor, index * 10],
            )
          : await clientRows<{ id: string }>(
              client,
              `INSERT INTO services (
                 salon_id, category_id, name, duration_minutes, price_minor,
                 currency_code, is_active, is_publicly_bookable, sort_order
               ) VALUES ($1, $2, $3, $4, $5, 'USD', true, true, $6)
               RETURNING id`,
              [salonId, service.categoryId, service.name.trim(), durationMinutes, priceMinor, index * 10],
            )
        if (rows[0]) serviceIdByDraftId.set(service.id, rows[0].id)
      }

      await upsertSalonWorkingHours(client, salonId, input.draft.schedule)

      await client.query(
        'UPDATE professionals SET status = $2 WHERE salon_id = $1 AND deleted_at IS NULL',
        [salonId, 'inactive'],
      )
      for (const provider of activeProviders) {
        const salonPercent = parsePercent(provider.salonPercent, 'Salon earnings percent must be between 0 and 100.')
        const professionalPercent = parsePercent(provider.professionalPercent, 'Provider earnings percent must be between 0 and 100.')
        if (Math.round((salonPercent + professionalPercent) * 100) !== 10000) {
          throw new ApiError(400, 'Salon and provider earnings must add up to 100%.')
        }

        const existingProvider = isUuid(provider.id)
          ? await clientRows<{ id: string }>(
              client,
              'SELECT id FROM professionals WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1',
              [salonId, provider.id],
            )
          : []
        const byIdentity = existingProvider[0]
          ? existingProvider
          : await clientRows<{ id: string }>(
              client,
              `SELECT id FROM professionals
               WHERE salon_id = $1
                 AND deleted_at IS NULL
                 AND (
                   ($2::text <> '' AND lower(email) = lower($2))
                   OR ($2::text = '' AND lower(full_name) = lower($3))
                 )
               ORDER BY created_at
               LIMIT 1`,
              [salonId, provider.email.trim(), provider.name.trim()],
            )
        const providerRows = byIdentity[0]
          ? await clientRows<{ id: string }>(
              client,
              `UPDATE professionals
               SET full_name = $3,
                   email = NULLIF($4, ''),
                   phone = NULLIF($5, ''),
                   languages = $6,
                   status = 'active',
                   salon_earnings_percent = $7,
                   professional_earnings_percent = $8
               WHERE salon_id = $1 AND id = $2
               RETURNING id`,
              [
                salonId,
                byIdentity[0].id,
                provider.name.trim(),
                provider.email.trim(),
                provider.phone.trim(),
                provider.languages,
                salonPercent,
                professionalPercent,
              ],
            )
          : await clientRows<{ id: string }>(
              client,
              `INSERT INTO professionals (
                 salon_id, full_name, email, phone, languages, status,
                 salon_earnings_percent, professional_earnings_percent
               ) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, 'active', $6, $7)
               RETURNING id`,
              [
                salonId,
                provider.name.trim(),
                provider.email.trim(),
                provider.phone.trim(),
                provider.languages,
                salonPercent,
                professionalPercent,
              ],
            )
        const professionalId = providerRows[0]?.id
        if (!professionalId) throw new ApiError(500, 'Provider could not be saved.')

        await client.query(
          'UPDATE professional_services SET is_active = false WHERE salon_id = $1 AND professional_id = $2',
          [salonId, professionalId],
        )
        for (const draftServiceId of provider.serviceIds) {
          const serviceId = serviceIdByDraftId.get(draftServiceId)
          if (!serviceId) continue
          await client.query(
            `INSERT INTO professional_services (salon_id, professional_id, service_id, is_active)
             VALUES ($1, $2, $3, true)
             ON CONFLICT (professional_id, service_id) DO UPDATE SET is_active = true`,
            [salonId, professionalId, serviceId],
          )
        }

        await upsertProfessionalWorkingHours(client, salonId, professionalId, provider.schedule)
      }

      const rows = await clientRows<Salon>(
        client,
        'SELECT * FROM salons WHERE id = $1 AND deleted_at IS NULL',
        [salonId],
      )
      if (!rows[0]) throw new ApiError(404, 'Salon not found')
      return rows[0]
    })
  },

  async getNailSettings(salonId: string) {
    await ensureServiceMaterialsTable()
    const salon = await this.getSalon(salonId)
    const categoryRows = await query<QueryResultRow & ServiceCategory & { salon_enabled: boolean }>(
      `SELECT sc.*, COALESCE(ssc.is_active, false) AS salon_enabled
       FROM service_categories sc
       LEFT JOIN salon_service_categories ssc ON ssc.category_id = sc.id AND ssc.salon_id = $1
       WHERE sc.code = 'nails' AND sc.is_active
       LIMIT 1`,
      [salonId],
    )
    const category = categoryRows[0]
    if (!category) throw new ApiError(404, 'Nail category not found.')

    const [services, materials, salonHours, professionalRows] = await Promise.all([
      query<Service>(
        `SELECT s.*, sc.code AS category_code, sc.name AS category_name
         FROM services s
         JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.salon_id = $1 AND s.category_id = $2
         ORDER BY s.sort_order, s.name`,
        [salonId, category.id],
      ),
      query<QueryResultRow>(
        `SELECT *
         FROM service_materials
         WHERE salon_id = $1 AND category_id = $2
         ORDER BY sort_order, name`,
        [salonId, category.id],
      ),
      query<QueryResultRow & { day_of_week: number; enabled: boolean; open: string | null; close: string | null }>(
        `SELECT day_of_week, is_open AS enabled, opens_at::text AS open, closes_at::text AS close
         FROM salon_working_hours
         WHERE salon_id = $1
         ORDER BY day_of_week`,
        [salonId],
      ),
      query<QueryResultRow>(
        `SELECT
           p.*,
           EXISTS (
             SELECT 1 FROM professional_working_hours pwh
             WHERE pwh.salon_id = p.salon_id AND pwh.professional_id = p.id
           ) AS has_custom_schedule,
           COALESCE(
             jsonb_agg(DISTINCT jsonb_build_object(
               'service_id', ps.service_id,
               'duration_override_minutes', ps.duration_override_minutes,
               'price_override_minor', ps.price_override_minor,
               'is_active', ps.is_active
             )) FILTER (WHERE ps.service_id IS NOT NULL),
             '[]'::jsonb
           ) AS service_assignments
         FROM professionals p
         LEFT JOIN professional_services ps
           ON ps.salon_id = p.salon_id
          AND ps.professional_id = p.id
          AND ps.service_id IN (SELECT id FROM services WHERE salon_id = $1 AND category_id = $2)
         WHERE p.salon_id = $1 AND p.deleted_at IS NULL
         GROUP BY p.id
         ORDER BY p.full_name`,
        [salonId, category.id],
      ),
    ])

    const professionalIds = professionalRows.map((row) => row.id as string)
    const scheduleRows = professionalIds.length
      ? await query<QueryResultRow & { professional_id: string; day_of_week: number; enabled: boolean; open: string | null; close: string | null }>(
        `SELECT professional_id, day_of_week, is_working AS enabled, starts_at::text AS open, ends_at::text AS close
         FROM professional_working_hours
         WHERE salon_id = $1 AND professional_id = ANY($2::uuid[])
         ORDER BY professional_id, day_of_week`,
        [salonId, professionalIds],
      )
      : []

    const schedulesByProfessional = new Map<string, typeof scheduleRows>()
    for (const row of scheduleRows) {
      const rows = schedulesByProfessional.get(row.professional_id) ?? []
      rows.push(row)
      schedulesByProfessional.set(row.professional_id, rows)
    }

    return {
      salon: {
        id: salon.id,
        name: salon.name,
        currencyCode: salon.currency_code,
        timezone: salon.timezone,
      },
      category: {
        id: category.id,
        code: category.code,
        name: category.name,
        description: category.description,
        isEnabled: category.salon_enabled,
      },
      services,
      materials,
      salonSchedule: normalizeScheduleRows(salonHours),
      providers: professionalRows.map((row) => ({
        ...row,
        use_salon_schedule: !row.has_custom_schedule,
        schedule: normalizeScheduleRows(schedulesByProfessional.get(row.id as string) ?? []),
      })),
      staffLimit: 10,
      activeStaffCount: professionalRows.filter((row) => row.status === 'active').length,
    }
  },

  async updateNailSettings(salonId: string, input: UpdateNailSettingsInput) {
    return withTransaction(async (client) => {
      await ensureServiceMaterialsTable(client)
      const categoryRows = await clientRows<QueryResultRow & { id: string }>(
        client,
        "SELECT id FROM service_categories WHERE code = 'nails' AND is_active LIMIT 1",
        [],
      )
      const categoryId = categoryRows[0]?.id
      if (!categoryId) throw new ApiError(404, 'Nail category not found.')

      if (!input.categoryEnabled && !input.forceDisable) {
        const futureRows = await clientRows<QueryResultRow & { count: string }>(
          client,
          `SELECT COUNT(*)::text AS count
           FROM appointments a
           JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
           JOIN services s ON s.salon_id = aps.salon_id AND s.id = aps.service_id
           WHERE a.salon_id = $1
             AND s.category_id = $2
             AND a.starts_at > now()
             AND a.status_code NOT IN ('completed', 'canceled', 'no_show')`,
          [salonId, categoryId],
        )
        const futureCount = Number(futureRows[0]?.count ?? 0)
        if (futureCount > 0) {
          throw new ApiError(409, `Nails has ${futureCount} future appointments. Confirm before disabling this category.`)
        }
      }

      await client.query(
        `INSERT INTO salon_service_categories (salon_id, category_id, is_active)
         VALUES ($1, $2, $3)
         ON CONFLICT (salon_id, category_id) DO UPDATE SET is_active = EXCLUDED.is_active`,
        [salonId, categoryId, input.categoryEnabled],
      )

      const seenNames = new Set<string>()
      for (const service of input.services) {
        const normalized = service.name.trim().toLowerCase()
        if (seenNames.has(normalized)) throw new ApiError(400, 'Service names must be unique within Nails.')
        seenNames.add(normalized)
        if (service.id) {
          await client.query(
            `UPDATE services
             SET name = $4, description = $5, price_minor = $6, duration_minutes = $7,
                 is_active = $8, is_publicly_bookable = $8, sort_order = $9
             WHERE salon_id = $1 AND category_id = $2 AND id = $3`,
            [salonId, categoryId, service.id, service.name.trim(), service.description ?? null, service.priceMinor, service.durationMinutes, service.isActive, service.sortOrder],
          )
        } else {
          await client.query(
            `INSERT INTO services (
               salon_id, category_id, name, description, price_minor, duration_minutes,
               currency_code, is_active, is_publicly_bookable, sort_order
             )
             SELECT $1, $2, $3, $4, $5, $6, s.currency_code, $7, $7, $8
             FROM salons s
             WHERE s.id = $1`,
            [salonId, categoryId, service.name.trim(), service.description ?? null, service.priceMinor, service.durationMinutes, service.isActive, service.sortOrder],
          )
        }
      }

      for (const material of input.materials) {
        if (material.serviceId) {
          const serviceRows = await clientRows<QueryResultRow>(
            client,
            'SELECT 1 FROM services WHERE salon_id = $1 AND category_id = $2 AND id = $3 LIMIT 1',
            [salonId, categoryId, material.serviceId],
          )
          if (!serviceRows[0]) throw new ApiError(400, 'Material service assignment is invalid.')
        }

        if (material.id) {
          await client.query(
            `UPDATE service_materials
             SET service_id = $4, name = $5, brand = $6, material_type = $7, unit = $8,
                 cost_minor = $9, is_active = $10, sort_order = $11
             WHERE salon_id = $1 AND category_id = $2 AND id = $3`,
            [salonId, categoryId, material.id, material.serviceId ?? null, material.name.trim(), material.brand ?? null, material.materialType ?? null, material.unit ?? null, material.costMinor ?? null, material.isActive, material.sortOrder],
          )
        } else {
          await client.query(
            `INSERT INTO service_materials (
               salon_id, category_id, service_id, name, brand, material_type, unit,
               cost_minor, currency_code, is_active, sort_order
             )
             SELECT $1, $2, $3, $4, $5, $6, $7, $8, s.currency_code, $9, $10
             FROM salons s
             WHERE s.id = $1`,
            [salonId, categoryId, material.serviceId ?? null, material.name.trim(), material.brand ?? null, material.materialType ?? null, material.unit ?? null, material.costMinor ?? null, material.isActive, material.sortOrder],
          )
        }
      }

      return this.getNailSettings(salonId)
    })
  },

  listProfessionals(salonId: string, options: ListOptions): Promise<Professional[]> {
    return query<Professional>(
      `SELECT * FROM professionals
       WHERE salon_id = $1 AND deleted_at IS NULL
       ORDER BY full_name
       LIMIT $2 OFFSET $3`,
      [salonId, options.limit, options.offset],
    )
  },

  getProfessional(salonId: string, id: string): Promise<Professional> {
    return oneOrNotFound<Professional>(
      'SELECT * FROM professionals WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL',
      [salonId, id],
      'Professional not found',
    )
  },

  async createProfessional(salonId: string, input: UpsertProfessionalInput): Promise<Professional> {
    return withTransaction(async (client) => {
      const activeRows = await clientRows<QueryResultRow & { count: string }>(
        client,
        "SELECT COUNT(*)::text AS count FROM professionals WHERE salon_id = $1 AND status = 'active' AND deleted_at IS NULL",
        [salonId],
      )
      if (input.status === 'active' && Number(activeRows[0]?.count ?? 0) >= 10) {
        throw new ApiError(403, "You've reached the limit of 10 active staff members. Upgrade your plan to add more providers.")
      }

      await validateProfessionalAssignments(client, salonId, input.serviceAssignments)

      const rows = await clientRows<Professional>(
        client,
        `INSERT INTO professionals (
           salon_id, full_name, email, phone, avatar_url, languages, status,
           salon_earnings_percent, professional_earnings_percent
         ) VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          salonId,
          input.fullName.trim(),
          input.email ?? '',
          input.phone ?? '',
          input.avatarUrl ?? null,
          input.languages,
          input.status,
          input.salonEarningsPercent,
          input.professionalEarningsPercent,
        ],
      )
      const professional = rows[0]
      if (!professional) throw new ApiError(500, 'Provider could not be created.')
      await saveProfessionalAssignments(client, salonId, professional.id, input.serviceAssignments)
      if (!input.useSalonSchedule && input.schedule) {
        await upsertProfessionalWorkingHours(client, salonId, professional.id, input.schedule)
      }
      return professional
    })
  },

  async updateProfessional(salonId: string, id: string, input: UpsertProfessionalInput): Promise<Professional> {
    return withTransaction(async (client) => {
      const currentRows = await clientRows<Professional>(
        client,
        'SELECT * FROM professionals WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL FOR UPDATE',
        [salonId, id],
      )
      const current = currentRows[0]
      if (!current) throw new ApiError(404, 'Professional not found')

      if (current.status !== 'active' && input.status === 'active') {
        const activeRows = await clientRows<QueryResultRow & { count: string }>(
          client,
          "SELECT COUNT(*)::text AS count FROM professionals WHERE salon_id = $1 AND status = 'active' AND deleted_at IS NULL",
          [salonId],
        )
        if (Number(activeRows[0]?.count ?? 0) >= 10) {
          throw new ApiError(403, "You've reached the limit of 10 active staff members. Upgrade your plan to add more providers.")
        }
      }

      await validateProfessionalAssignments(client, salonId, input.serviceAssignments)

      const rows = await clientRows<Professional>(
        client,
        `UPDATE professionals
         SET full_name = $3, email = NULLIF($4, ''), phone = NULLIF($5, ''), avatar_url = $6,
             languages = $7, status = $8, salon_earnings_percent = $9,
             professional_earnings_percent = $10
         WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [
          salonId,
          id,
          input.fullName.trim(),
          input.email ?? '',
          input.phone ?? '',
          input.avatarUrl ?? null,
          input.languages,
          input.status,
          input.salonEarningsPercent,
          input.professionalEarningsPercent,
        ],
      )

      await saveProfessionalAssignments(client, salonId, id, input.serviceAssignments)
      if (input.useSalonSchedule) {
        await client.query('DELETE FROM professional_working_hours WHERE salon_id = $1 AND professional_id = $2', [salonId, id])
      } else if (input.schedule) {
        await upsertProfessionalWorkingHours(client, salonId, id, input.schedule)
      }

      const professional = rows[0]
      if (!professional) throw new ApiError(404, 'Professional not found')
      return professional
    })
  },

  async deleteProfessional(salonId: string, id: string) {
    return withTransaction(async (client) => {
      const futureRows = await clientRows<QueryResultRow & { count: string }>(
        client,
        `SELECT COUNT(*)::text AS count
         FROM appointments
         WHERE salon_id = $1
           AND professional_id = $2
           AND starts_at > now()
           AND status_code NOT IN ('completed', 'canceled', 'no_show')`,
        [salonId, id],
      )
      const futureCount = Number(futureRows[0]?.count ?? 0)
      if (futureCount > 0) {
        throw new ApiError(409, `Cannot be deleted. This provider has ${futureCount} future appointments that must be reassigned first.`)
      }

      const rows = await clientRows<Professional>(
        client,
        `UPDATE professionals
         SET status = 'inactive', deleted_at = now()
         WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [salonId, id],
      )
      if (!rows[0]) throw new ApiError(404, 'Professional not found')
      await client.query('UPDATE professional_services SET is_active = false WHERE salon_id = $1 AND professional_id = $2', [salonId, id])
      return { deleted: true, futureAppointmentCount: 0 }
    })
  },

  async reassignAndDeactivateProfessional(salonId: string, id: string, input: ReassignProfessionalInput) {
    return withTransaction(async (client) => {
      if (id === input.replacementProviderId) {
        throw new ApiError(400, 'Replacement provider must be different.')
      }

      const replacementRows = await clientRows<QueryResultRow>(
        client,
        `SELECT 1 FROM professionals
         WHERE salon_id = $1 AND id = $2 AND status = 'active' AND deleted_at IS NULL
         LIMIT 1`,
        [salonId, input.replacementProviderId],
      )
      if (!replacementRows[0]) throw new ApiError(400, 'Replacement provider is not available.')

      const appointments = await clientRows<QueryResultRow & { id: string }>(
        client,
        `SELECT id
         FROM appointments
         WHERE salon_id = $1
           AND professional_id = $2
           AND id = ANY($3::uuid[])
           AND starts_at > now()
           AND status_code NOT IN ('completed', 'canceled', 'no_show')
         FOR UPDATE`,
        [salonId, id, input.appointmentIds],
      )
      if (appointments.length !== input.appointmentIds.length) {
        throw new ApiError(400, 'Only future appointments from this provider can be reassigned.')
      }

      for (const appointment of appointments) {
        const unsupportedRows = await clientRows<QueryResultRow>(
          client,
          `SELECT 1
           FROM appointment_services aps
           LEFT JOIN professional_services ps
             ON ps.salon_id = aps.salon_id
            AND ps.service_id = aps.service_id
            AND ps.professional_id = $3
            AND ps.is_active
           WHERE aps.salon_id = $1 AND aps.appointment_id = $2 AND ps.service_id IS NULL
           LIMIT 1`,
          [salonId, appointment.id, input.replacementProviderId],
        )
        if (unsupportedRows[0]) {
          throw new ApiError(400, 'Replacement provider does not support all selected appointment services.')
        }
      }

      const conflictRows = await clientRows<QueryResultRow>(
        client,
        `SELECT 1
         FROM appointments target
         JOIN appointments existing
           ON existing.salon_id = target.salon_id
          AND existing.professional_id = $3
          AND existing.id <> target.id
          AND existing.status_code NOT IN ('completed', 'canceled', 'no_show')
          AND existing.starts_at < target.ends_at
          AND existing.ends_at > target.starts_at
         WHERE target.salon_id = $1
           AND target.id = ANY($2::uuid[])
         LIMIT 1`,
        [salonId, input.appointmentIds, input.replacementProviderId],
      )
      if (conflictRows[0]) {
        throw new ApiError(409, 'Replacement provider has a scheduling conflict with one or more selected appointments.')
      }

      await client.query(
        `UPDATE appointments
         SET professional_id = $3
         WHERE salon_id = $1 AND professional_id = $2 AND id = ANY($4::uuid[])`,
        [salonId, id, input.replacementProviderId, input.appointmentIds],
      )
      await client.query(
        `UPDATE professionals
         SET status = 'inactive', deleted_at = now()
         WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL`,
        [salonId, id],
      )
      await client.query('UPDATE professional_services SET is_active = false WHERE salon_id = $1 AND professional_id = $2', [salonId, id])
      return { reassigned: input.appointmentIds.length, deactivated: true }
    })
  },

  listClients(salonId: string, search: string | undefined, options: ListOptions): Promise<Client[]> {
    return query<Client>(
      `SELECT * FROM clients
       WHERE salon_id = $1
         AND deleted_at IS NULL
         AND (
           $2::text IS NULL
           OR full_name ILIKE '%' || $2 || '%'
           OR email ILIKE '%' || $2 || '%'
           OR phone ILIKE '%' || $2 || '%'
         )
       ORDER BY full_name
       LIMIT $3 OFFSET $4`,
      [salonId, search ?? null, options.limit, options.offset],
    )
  },

  getClient(salonId: string, id: string): Promise<Client> {
    return oneOrNotFound<Client>(
      `SELECT c.*, to_jsonb(chp) - 'id' - 'salon_id' - 'client_id' AS health_profile
       FROM clients c
       LEFT JOIN client_health_profiles chp ON chp.salon_id = c.salon_id AND chp.client_id = c.id
       WHERE c.salon_id = $1 AND c.id = $2 AND c.deleted_at IS NULL`,
      [salonId, id],
      'Client not found',
    )
  },

  createClient(salonId: string, input: CreateClientInput): Promise<Client> {
    return oneOrNotFound<Client>(
      `INSERT INTO clients (
         salon_id, full_name, email, phone, date_of_birth, preferred_language, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        salonId,
        input.fullName,
        input.email ?? null,
        input.phone ?? null,
        input.dateOfBirth ?? null,
        input.preferredLanguage ?? null,
        input.notes ?? null,
      ],
      'Client could not be created',
    )
  },

  listServiceCategories(salonId?: string): Promise<ServiceCategory[]> {
    if (!salonId) {
      return query<ServiceCategory>(
        'SELECT * FROM service_categories WHERE is_active ORDER BY sort_order, name',
      )
    }

    return query<ServiceCategory>(
      `SELECT sc.*
       FROM service_categories sc
       JOIN salon_service_categories ssc ON ssc.category_id = sc.id
       WHERE ssc.salon_id = $1 AND sc.is_active AND ssc.is_active
       ORDER BY sc.sort_order, sc.name`,
      [salonId],
    )
  },

  async listAppointmentCategories(salonId: string) {
    const rows = await query<QueryResultRow>(
      `SELECT sc.id, sc.code, sc.name, sc.description, sc.sort_order,
              ssc.is_active AS enabled,
              COUNT(DISTINCT s.id)::int AS service_count
       FROM service_categories sc
       JOIN salon_service_categories ssc ON ssc.category_id = sc.id AND ssc.salon_id = $1
       LEFT JOIN services s ON s.salon_id = $1 AND s.category_id = sc.id AND s.is_active
       WHERE sc.is_active
       GROUP BY sc.id, sc.code, sc.name, sc.description, sc.sort_order, ssc.is_active
       ORDER BY sc.sort_order, sc.name`,
      [salonId],
    )
    return rows
  },

  async listHealthProfiles(salonId: string, clientId: string) {
    await ensureClinicalTables()
    return query<QueryResultRow>(
      `SELECT hpv.*, hq.questionnaire_type, hq.completed_at,
              COALESCE(
                jsonb_object_agg(hqa.question_key, COALESCE(hqa.json_value, to_jsonb(hqa.text_value), to_jsonb(hqa.numeric_value), to_jsonb(hqa.boolean_value)))
                FILTER (WHERE hqa.id IS NOT NULL),
                '{}'::jsonb
              ) AS answers
       FROM health_profile_versions hpv
       LEFT JOIN health_questionnaires hq ON hq.id = hpv.questionnaire_id
       LEFT JOIN health_questionnaire_answers hqa ON hqa.questionnaire_id = hq.id
       WHERE hpv.salon_id = $1 AND hpv.client_id = $2
       GROUP BY hpv.id, hq.questionnaire_type, hq.completed_at
       ORDER BY hpv.category, hpv.valid_until DESC`,
      [salonId, clientId],
    )
  },

  async getHealthProfile(salonId: string, clientId: string, category: string) {
    await ensureClinicalTables()
    const rows = await query<QueryResultRow>(
      `SELECT hpv.*, hq.questionnaire_type, hq.completed_at,
              (hpv.status = 'active' AND hpv.valid_until >= now()) AS is_valid,
              COALESCE(
                jsonb_object_agg(hqa.question_key, COALESCE(hqa.json_value, to_jsonb(hqa.text_value), to_jsonb(hqa.numeric_value), to_jsonb(hqa.boolean_value)))
                FILTER (WHERE hqa.id IS NOT NULL),
                '{}'::jsonb
              ) AS answers
       FROM health_profile_versions hpv
       LEFT JOIN health_questionnaires hq ON hq.id = hpv.questionnaire_id
       LEFT JOIN health_questionnaire_answers hqa ON hqa.questionnaire_id = hq.id
       WHERE hpv.salon_id = $1 AND hpv.client_id = $2 AND hpv.category = $3
       GROUP BY hpv.id, hq.questionnaire_type, hq.completed_at
       ORDER BY hpv.valid_until DESC
       LIMIT 1`,
      [salonId, clientId, category],
    )
    return rows[0] ?? null
  },

  async createHealthQuestionnaire(salonId: string, input: HealthQuestionnaireInput) {
    return withTransaction(async (client) => {
      await ensureClinicalTables(client)
      let categoryId = input.categoryId ?? null
      let categoryCode = input.category ?? null
      if (!categoryId && categoryCode) {
        const categoryRows = await clientRows<QueryResultRow & { id: string }>(
          client,
          'SELECT id FROM service_categories WHERE code = $1 LIMIT 1',
          [categoryCode],
        )
        categoryId = categoryRows[0]?.id ?? null
      }
      if (!categoryCode && categoryId) {
        const categoryRows = await clientRows<QueryResultRow & { code: string }>(
          client,
          'SELECT code FROM service_categories WHERE id = $1 LIMIT 1',
          [categoryId],
        )
        categoryCode = categoryRows[0]?.code ?? null
      }

      const rows = await clientRows<QueryResultRow & { id: string }>(
        client,
        `INSERT INTO health_questionnaires (
           salon_id, client_id, appointment_id, category_id, questionnaire_type, version,
           status, completed_at, expires_at, created_by_user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          salonId,
          input.clientId,
          input.appointmentId ?? null,
          categoryId,
          input.questionnaireType,
          input.version,
          input.status,
          input.completedAt ?? (input.status === 'completed' ? new Date().toISOString() : null),
          input.expiresAt ?? null,
          input.createdByUserId ?? null,
        ],
      )
      const questionnaire = rows[0]
      if (!questionnaire) throw new ApiError(500, 'Health questionnaire could not be created.')

      for (const answer of input.answers) {
        await client.query(
          `INSERT INTO health_questionnaire_answers (
             questionnaire_id, question_key, answer_type, boolean_value, text_value, numeric_value, json_value
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [
            questionnaire.id,
            answer.questionKey,
            answer.answerType,
            answer.booleanValue ?? null,
            answer.textValue ?? null,
            answer.numericValue ?? null,
            answer.jsonValue === undefined || answer.jsonValue === null ? null : JSON.stringify(answer.jsonValue),
          ],
        )
      }

      if (input.status === 'completed' && categoryCode) {
        const months = categoryCode === 'cosmetology' || categoryCode === 'micropigmentation' ? 6 : 12
        await client.query(
          `UPDATE health_profile_versions
           SET status = 'superseded'
           WHERE salon_id = $1 AND client_id = $2 AND category = $3 AND status = 'active'`,
          [salonId, input.clientId, categoryCode],
        )
        await client.query(
          `INSERT INTO health_profile_versions (
             salon_id, client_id, category, questionnaire_id, valid_from, valid_until, status
           ) VALUES ($1, $2, $3, $4, now(), now() + ($5::text || ' months')::interval, 'active')`,
          [salonId, input.clientId, categoryCode, questionnaire.id, months],
        )
      }

      return questionnaire
    })
  },

  async updateHealthQuestionnaire(salonId: string, questionnaireId: string, input: HealthQuestionnaireInput) {
    return withTransaction(async (client) => {
      await ensureClinicalTables(client)
      const rows = await clientRows<QueryResultRow & { id: string }>(
        client,
        `UPDATE health_questionnaires
         SET status = $3, completed_at = $4, expires_at = $5
         WHERE salon_id = $1 AND id = $2
         RETURNING *`,
        [salonId, questionnaireId, input.status, input.completedAt ?? null, input.expiresAt ?? null],
      )
      const questionnaire = rows[0]
      if (!questionnaire) throw new ApiError(404, 'Health questionnaire not found.')
      for (const answer of input.answers) {
        await client.query(
          `INSERT INTO health_questionnaire_answers (
             questionnaire_id, question_key, answer_type, boolean_value, text_value, numeric_value, json_value
           ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
           ON CONFLICT (questionnaire_id, question_key) DO UPDATE SET
             answer_type = EXCLUDED.answer_type,
             boolean_value = EXCLUDED.boolean_value,
             text_value = EXCLUDED.text_value,
             numeric_value = EXCLUDED.numeric_value,
             json_value = EXCLUDED.json_value`,
          [
            questionnaireId,
            answer.questionKey,
            answer.answerType,
            answer.booleanValue ?? null,
            answer.textValue ?? null,
            answer.numericValue ?? null,
            answer.jsonValue === undefined || answer.jsonValue === null ? null : JSON.stringify(answer.jsonValue),
          ],
        )
      }
      return questionnaire
    })
  },

  async createConsentRecord(salonId: string, input: ConsentRecordInput) {
    await ensureClinicalTables()
    return oneOrNotFound<QueryResultRow>(
      `INSERT INTO consent_records (
         salon_id, client_id, appointment_id, questionnaire_id, consent_type, consent_version,
         accepted, accepted_at, consent_text_snapshot, signed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()), $9, COALESCE($8::timestamptz, now()))
       RETURNING *`,
      [
        salonId,
        input.clientId,
        input.appointmentId,
        input.questionnaireId ?? null,
        input.consentType,
        input.consentVersion,
        input.accepted,
        input.acceptedAt ?? null,
        input.consentTextSnapshot,
      ],
      'Consent could not be saved',
    )
  },

  async createSignatureRecord(salonId: string, input: SignatureRecordInput) {
    await ensureClinicalTables()
    return oneOrNotFound<QueryResultRow>(
      `INSERT INTO signature_records (
         salon_id, client_id, appointment_id, questionnaire_id, signature_type,
         signer_name, signature_data, signed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
       RETURNING *`,
      [
        salonId,
        input.clientId,
        input.appointmentId ?? null,
        input.questionnaireId ?? null,
        input.signatureType,
        input.signerName,
        input.signatureData,
        input.signedAt ?? null,
      ],
      'Signature could not be saved',
    )
  },

  async createAnnotation(salonId: string, appointmentId: string, input: AnnotationInput) {
    await ensureClinicalTables()
    return oneOrNotFound<QueryResultRow>(
      `INSERT INTO treatment_visual_annotations (
         salon_id, client_id, appointment_id, category, body_area, annotation_type,
         x_position, y_position, width, height, path_data, points_json, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13)
       RETURNING *`,
      [
        salonId,
        input.clientId,
        appointmentId,
        input.category,
        input.bodyArea ?? null,
        input.annotationType,
        input.xPosition ?? null,
        input.yPosition ?? null,
        input.width ?? null,
        input.height ?? null,
        input.pathData ?? null,
        input.pointsJson === undefined || input.pointsJson === null ? null : JSON.stringify(input.pointsJson),
        input.notes ?? null,
      ],
      'Annotation could not be saved',
    )
  },

  async updateAnnotation(salonId: string, appointmentId: string, annotationId: string, input: AnnotationInput) {
    await ensureClinicalTables()
    return oneOrNotFound<QueryResultRow>(
      `UPDATE treatment_visual_annotations
       SET body_area = $5, annotation_type = $6, x_position = $7, y_position = $8,
           width = $9, height = $10, path_data = $11, points_json = $12::jsonb, notes = $13
       WHERE salon_id = $1 AND appointment_id = $2 AND id = $3 AND client_id = $4
       RETURNING *`,
      [
        salonId,
        appointmentId,
        annotationId,
        input.clientId,
        input.bodyArea ?? null,
        input.annotationType,
        input.xPosition ?? null,
        input.yPosition ?? null,
        input.width ?? null,
        input.height ?? null,
        input.pathData ?? null,
        input.pointsJson === undefined || input.pointsJson === null ? null : JSON.stringify(input.pointsJson),
        input.notes ?? null,
      ],
      'Annotation not found',
    )
  },

  async deleteAnnotation(salonId: string, appointmentId: string, annotationId: string) {
    const rows = await query<QueryResultRow>(
      `DELETE FROM treatment_visual_annotations
       WHERE salon_id = $1 AND appointment_id = $2 AND id = $3
       RETURNING id`,
      [salonId, appointmentId, annotationId],
    )
    if (!rows[0]) throw new ApiError(404, 'Annotation not found')
    return { deleted: true }
  },

  listServices(salonId: string, categoryCode: string | undefined, options: ListOptions): Promise<Service[]> {
    return query<Service>(
      `SELECT s.*, sc.code AS category_code, sc.name AS category_name
       FROM services s
       JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.salon_id = $1
         AND s.is_active
         AND ($2::text IS NULL OR sc.code = $2)
       ORDER BY sc.sort_order, s.sort_order, s.name
       LIMIT $3 OFFSET $4`,
      [salonId, categoryCode ?? null, options.limit, options.offset],
    )
  },

  getService(salonId: string, id: string): Promise<Service> {
    return oneOrNotFound<Service>(
      `SELECT s.*, sc.code AS category_code, sc.name AS category_name
       FROM services s
       JOIN service_categories sc ON sc.id = s.category_id
       WHERE s.salon_id = $1 AND s.id = $2`,
      [salonId, id],
      'Service not found',
    )
  },

  createService(salonId: string, input: CreateServiceInput): Promise<Service> {
    return oneOrNotFound<Service>(
      `INSERT INTO services (
         salon_id, category_id, name, description, duration_minutes, price_minor,
         currency_code, is_publicly_bookable
       ) VALUES ($1, $2, $3, $4, $5, $6, upper($7::text), $8)
       RETURNING *`,
      [
        salonId,
        input.categoryId,
        input.name,
        input.description ?? null,
        input.durationMinutes,
        input.priceMinor,
        input.currencyCode,
        input.isPubliclyBookable,
      ],
      'Service could not be created',
    )
  },

  listAppointments(salonId: string, filters: AppointmentFilters): Promise<Appointment[]> {
    return query<Appointment>(
      `SELECT a.*, c.full_name AS client_name, p.full_name AS professional_name,
         COALESCE((
           SELECT jsonb_agg(to_jsonb(aps) ORDER BY aps.created_at)
           FROM appointment_services aps
           WHERE aps.salon_id = a.salon_id AND aps.appointment_id = a.id
         ), '[]'::jsonb) AS services
       FROM appointments a
       JOIN clients c ON c.salon_id = a.salon_id AND c.id = a.client_id
       JOIN professionals p ON p.salon_id = a.salon_id AND p.id = a.professional_id
       WHERE a.salon_id = $1
         AND ($2::timestamptz IS NULL OR a.starts_at >= $2)
         AND ($3::timestamptz IS NULL OR a.starts_at < $3)
         AND ($4::uuid IS NULL OR a.professional_id = $4)
         AND ($5::uuid IS NULL OR a.client_id = $5)
         AND ($6::text IS NULL OR a.status_code = $6)
       ORDER BY a.starts_at
       LIMIT $7 OFFSET $8`,
      [
        salonId,
        filters.from ?? null,
        filters.to ?? null,
        filters.professionalId ?? null,
        filters.clientId ?? null,
        filters.status ?? null,
        filters.limit,
        filters.offset,
      ],
    )
  },

  getAppointment(salonId: string, id: string): Promise<Appointment> {
    return oneOrNotFound<Appointment>(
      `SELECT a.*, c.full_name AS client_name, p.full_name AS professional_name,
         COALESCE(jsonb_agg(to_jsonb(aps) ORDER BY aps.created_at)
           FILTER (WHERE aps.id IS NOT NULL), '[]'::jsonb) AS services,
         (
           SELECT COALESCE(jsonb_object_agg(acd.category, acd.details_json), '{}'::jsonb)
           FROM appointment_category_details acd
           WHERE acd.salon_id = a.salon_id AND acd.appointment_id = a.id
         ) AS treatment_details_by_category,
         (
           SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', sr.id,
             'signature_type', sr.signature_type,
             'signer_name', sr.signer_name,
             'signature_data', sr.signature_data,
             'signed_at', sr.signed_at
           ) ORDER BY sr.signed_at), '[]'::jsonb)
           FROM signature_records sr
           WHERE sr.salon_id = a.salon_id AND sr.appointment_id = a.id
         ) AS clinical_signatures,
         (
           SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'consent_type', cr.consent_type,
             'accepted', cr.accepted,
             'accepted_at', cr.accepted_at,
             'consent_text_snapshot', cr.consent_text_snapshot
           ) ORDER BY cr.accepted_at), '[]'::jsonb)
           FROM consent_records cr
           WHERE cr.salon_id = a.salon_id AND cr.appointment_id = a.id
         ) AS clinical_consents,
         (
           SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'id', tva.id,
             'category', tva.category,
             'body_area', tva.body_area,
             'annotation_type', tva.annotation_type,
             'x_position', tva.x_position,
             'y_position', tva.y_position,
             'points_json', tva.points_json,
             'notes', tva.notes
           ) ORDER BY tva.created_at), '[]'::jsonb)
           FROM treatment_visual_annotations tva
           WHERE tva.salon_id = a.salon_id AND tva.appointment_id = a.id
         ) AS clinical_annotations,
         (
           SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'media_type', tm.media_type,
             'storage_key', tm.storage_key,
             'mime_type', tm.mime_type,
             'url', COALESCE(tm.metadata_json->>'url', '/api/media/' || tm.storage_key)
           ) ORDER BY tm.created_at), '[]'::jsonb)
           FROM treatment_media tm
           JOIN treatment_records tr ON tr.id = tm.treatment_record_id
           JOIN appointment_services aps2 ON aps2.id = tr.appointment_service_id
           WHERE aps2.salon_id = a.salon_id AND aps2.appointment_id = a.id
         ) AS clinical_media,
         (
           SELECT COALESCE(
             jsonb_object_agg(
               hqa.question_key,
               COALESCE(
                 to_jsonb(hqa.boolean_value),
                 to_jsonb(hqa.text_value),
                 to_jsonb(hqa.numeric_value),
                 hqa.json_value
               )
             ),
             '{}'::jsonb
           )
           FROM health_questionnaires hq
           JOIN health_questionnaire_answers hqa ON hqa.questionnaire_id = hq.id
           WHERE hq.salon_id = a.salon_id AND hq.appointment_id = a.id
         ) AS health_questionnaire_answers
       FROM appointments a
       JOIN clients c ON c.salon_id = a.salon_id AND c.id = a.client_id
       JOIN professionals p ON p.salon_id = a.salon_id AND p.id = a.professional_id
       LEFT JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
       WHERE a.salon_id = $1 AND a.id = $2
       GROUP BY a.id, c.full_name, p.full_name`,
      [salonId, id],
      'Appointment not found',
    )
  },

  async getServiceMaterials(salonId: string, filters: { categoryId?: string; categoryCode?: string; serviceId?: string }) {
    await ensureServiceMaterialsTable()
    let categoryId = filters.categoryId ?? null
    if (!categoryId && filters.categoryCode) {
      const rows = await query<QueryResultRow & { id: string }>(
        'SELECT id FROM service_categories WHERE code = $1 LIMIT 1',
        [filters.categoryCode],
      )
      categoryId = rows[0]?.id ?? null
    }
    if (!categoryId) return []

    const params: unknown[] = [salonId, categoryId]
    let serviceFilter = ''
    if (filters.serviceId) {
      params.push(filters.serviceId)
      serviceFilter = 'AND (service_id IS NULL OR service_id = $3)'
    }

    return query<QueryResultRow>(
      `SELECT *
       FROM service_materials
       WHERE salon_id = $1 AND category_id = $2 AND is_active
       ${serviceFilter}
       ORDER BY sort_order, name`,
      params,
    )
  },

  createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    return withTransaction(async (client) => {
      await ensureClinicalTables(client)
      const services = await clientRows<Service>(
        client,
        `SELECT s.*, sc.code AS category_code
         FROM services s
         JOIN service_categories sc ON sc.id = s.category_id
         JOIN professional_services ps
           ON ps.salon_id = s.salon_id AND ps.service_id = s.id
         WHERE s.salon_id = $1
           AND ps.professional_id = $2
           AND s.id = ANY($3::uuid[])
           AND s.is_active AND ps.is_active`,
        [input.salonId, input.professionalId, input.serviceIds],
      )

      if (services.length !== new Set(input.serviceIds).size) {
        throw new ApiError(400, 'One or more services are unavailable for this professional.')
      }

      const conflicts = await clientRows<QueryResultRow>(
        client,
        `SELECT 1
         FROM appointments
         WHERE salon_id = $1
           AND professional_id = $2
           AND status_code NOT IN ('completed', 'canceled', 'no_show')
           AND starts_at < $4::timestamptz
           AND ends_at > $3::timestamptz
         LIMIT 1`,
        [input.salonId, input.professionalId, input.startsAt, input.endsAt],
      )
      if (conflicts[0]) {
        throw new ApiError(409, 'The professional is unavailable for that time.')
      }

      const appointments = await clientRows<Appointment>(
        client,
        `INSERT INTO appointments (
           salon_id, client_id, professional_id, status_code, source, starts_at, ends_at,
           customer_notes, internal_notes, created_by_user_id
         ) VALUES ($1, $2, $3, 'scheduled', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          input.salonId,
          input.clientId,
          input.professionalId,
          input.source,
          input.startsAt,
          input.endsAt,
          input.customerNotes ?? null,
          input.internalNotes ?? null,
          input.createdByUserId ?? null,
        ],
      )
      const appointment = appointments[0]
      if (!appointment) throw new ApiError(500, 'Appointment could not be created.')

      const savedCategories = new Set<string>()
      let questionnaireId: string | null = null

      for (const service of services) {
        const categoryCode = String(service.category_code ?? 'general')
        if (input.treatmentDetails && !savedCategories.has(categoryCode)) {
          savedCategories.add(categoryCode)
          await client.query(
            `INSERT INTO appointment_category_details (salon_id, appointment_id, category, details_json)
             VALUES ($1, $2, $3, $4::jsonb)
             ON CONFLICT (salon_id, appointment_id, category) DO UPDATE SET
               details_json = EXCLUDED.details_json`,
            [input.salonId, appointment.id, categoryCode, JSON.stringify(input.treatmentDetails)],
          )

          const healthAnswers = input.treatmentDetails.healthAnswers
          const usedExistingProfile = input.treatmentDetails.usedExistingHealthProfile === true
          const existingQuestionnaireId = typeof input.treatmentDetails.existingQuestionnaireId === 'string'
            ? input.treatmentDetails.existingQuestionnaireId
            : null

          if (usedExistingProfile && existingQuestionnaireId) {
            questionnaireId = existingQuestionnaireId
            await client.query(
              `UPDATE health_questionnaires SET appointment_id = $1 WHERE id = $2 AND salon_id = $3`,
              [appointment.id, existingQuestionnaireId, input.salonId],
            )
          } else if (healthAnswers && typeof healthAnswers === 'object' && !Array.isArray(healthAnswers)) {
            const categoryRows = await clientRows<QueryResultRow & { id: string }>(
              client,
              'SELECT id FROM service_categories WHERE code = $1 LIMIT 1',
              [categoryCode],
            )
            const questionnaireRows = await clientRows<QueryResultRow & { id: string }>(
              client,
              `INSERT INTO health_questionnaires (
                 salon_id, client_id, appointment_id, category_id, questionnaire_type,
                 version, status, completed_at, expires_at, created_by_user_id
               ) VALUES ($1, $2, $3, $4, 'appointment_intake', 1, 'completed', now(),
                        now() + ($5::text || ' months')::interval, $6)
               RETURNING id`,
              [
                input.salonId,
                input.clientId,
                appointment.id,
                categoryRows[0]?.id ?? null,
                categoryCode === 'cosmetology' || categoryCode === 'micropigmentation' ? 6 : 12,
                input.createdByUserId ?? null,
              ],
            )
            questionnaireId = questionnaireRows[0]?.id ?? null
            if (questionnaireId) {
              for (const [questionKey, answerValue] of Object.entries(healthAnswers)) {
                const normalized = normalizeHealthAnswerValue(answerValue)
                await client.query(
                  `INSERT INTO health_questionnaire_answers (
                     questionnaire_id, question_key, answer_type, boolean_value,
                     text_value, numeric_value, json_value
                   ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
                   ON CONFLICT (questionnaire_id, question_key) DO UPDATE SET
                     answer_type = EXCLUDED.answer_type,
                     boolean_value = EXCLUDED.boolean_value,
                     text_value = EXCLUDED.text_value,
                     numeric_value = EXCLUDED.numeric_value,
                     json_value = EXCLUDED.json_value`,
                  [
                    questionnaireId,
                    questionKey,
                    normalized.answerType,
                    normalized.booleanValue,
                    normalized.textValue,
                    normalized.numericValue,
                    normalized.jsonValue,
                  ],
                )
              }
              await client.query(
                `UPDATE health_profile_versions
                 SET status = 'superseded'
                 WHERE salon_id = $1 AND client_id = $2 AND category = $3 AND status = 'active'`,
                [input.salonId, input.clientId, categoryCode],
              )
              await client.query(
                `INSERT INTO health_profile_versions (
                   salon_id, client_id, category, questionnaire_id, valid_from, valid_until, status
                 ) VALUES ($1, $2, $3, $4, now(),
                          now() + ($5::text || ' months')::interval, 'active')`,
                [
                  input.salonId,
                  input.clientId,
                  categoryCode,
                  questionnaireId,
                  categoryCode === 'cosmetology' || categoryCode === 'micropigmentation' ? 6 : 12,
                ],
              )
            }
          }

          const consents = Array.isArray(input.treatmentDetails.consents) ? input.treatmentDetails.consents : []
          for (const consent of consents) {
            if (!consent || typeof consent !== 'object') continue
            const item = consent as Record<string, unknown>
            if (item.accepted !== true || typeof item.text !== 'string') continue
            await client.query(
              `INSERT INTO consent_records (
                 salon_id, client_id, appointment_id, questionnaire_id, consent_type,
                 consent_version, accepted, accepted_at, consent_text_snapshot, signed_at
               ) VALUES ($1, $2, $3, $4, $5, $6, true, now(), $7, now())`,
              [
                input.salonId,
                input.clientId,
                appointment.id,
                questionnaireId,
                typeof item.type === 'string' ? item.type : 'appointment_consent',
                typeof item.version === 'number' ? item.version : 1,
                item.text,
              ],
            )
          }

          const signatures = Array.isArray(input.treatmentDetails.signatures) ? [...input.treatmentDetails.signatures] : []
          if (typeof input.treatmentDetails.clientDesignSignature === 'string' && input.treatmentDetails.clientDesignSignature) {
            const hasDesign = signatures.some((item) => item && typeof item === 'object' && (item as { type?: string }).type === 'design_approval')
            if (!hasDesign) {
              signatures.push({
                type: 'design_approval',
                signerName: typeof input.treatmentDetails.healthFullName === 'string' ? input.treatmentDetails.healthFullName : 'Client',
                data: input.treatmentDetails.clientDesignSignature,
              })
            }
          }
          for (const signature of signatures) {
            if (!signature || typeof signature !== 'object') continue
            const item = signature as Record<string, unknown>
            if (typeof item.data !== 'string' || typeof item.signerName !== 'string') continue
            await client.query(
              `INSERT INTO signature_records (
                 salon_id, client_id, appointment_id, questionnaire_id, signature_type,
                 signer_name, signature_data, signed_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
              [
                input.salonId,
                input.clientId,
                appointment.id,
                questionnaireId,
                typeof item.type === 'string' ? item.type : 'professional_signature',
                item.signerName,
                item.data,
              ],
            )
          }

          if (input.treatmentDetails.photoConsent === true) {
            await client.query(
              `INSERT INTO consent_records (
                 salon_id, client_id, appointment_id, questionnaire_id, consent_type,
                 consent_version, accepted, accepted_at, consent_text_snapshot, signed_at
               ) VALUES ($1, $2, $3, $4, $5, 1, true, now(), $6, now())`,
              [
                input.salonId,
                input.clientId,
                appointment.id,
                questionnaireId,
                `${categoryCode}_photography_consent`,
                'Client authorizes photo storage for this appointment.',
              ],
            )
          }

          await persistTreatmentVisualAnnotations(
            client,
            input.salonId,
            input.clientId,
            appointment.id,
            categoryCode,
            input.treatmentDetails,
          )
        }

        const appointmentServices = await clientRows<QueryResultRow & { id: string }>(
          client,
          `INSERT INTO appointment_services (
             salon_id, appointment_id, service_id, service_name_snapshot, category_code_snapshot,
             duration_minutes_snapshot, unit_price_minor, status_code
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
           RETURNING id`,
          [
            input.salonId,
            appointment.id,
            service.id,
            service.name,
            service.category_code,
            service.duration_minutes,
            service.price_minor,
          ],
        )
        const appointmentServiceId = appointmentServices[0]?.id

        if (appointmentServiceId && input.treatmentDetails && Object.keys(input.treatmentDetails).length > 0) {
          const treatmentRows = await clientRows<QueryResultRow & { id: string }>(
            client,
            `INSERT INTO treatment_records (
               salon_id, appointment_service_id, client_id, professional_id, category_code,
               details_json, notes, recommendations
             ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
             RETURNING id`,
            [
              input.salonId,
              appointmentServiceId,
              input.clientId,
              input.professionalId,
              service.category_code,
              JSON.stringify(input.treatmentDetails),
              input.treatmentNotes ?? null,
              input.treatmentRecommendations ?? null,
            ],
          )
          const treatmentRecordId = treatmentRows[0]?.id
          const mediaItems = Array.isArray(input.treatmentDetails.mediaItems)
            ? input.treatmentDetails.mediaItems
            : []
          for (const item of mediaItems) {
            if (!item || typeof item !== 'object' || !treatmentRecordId) continue
            const media = item as Record<string, unknown>
            if (typeof media.storageKey !== 'string') continue
            await client.query(
              `INSERT INTO treatment_media (
                 treatment_record_id, media_type, storage_key, mime_type, metadata_json
               ) VALUES ($1, $2, $3, $4, $5::jsonb)`,
              [
                treatmentRecordId,
                typeof media.mediaType === 'string' ? media.mediaType : 'reference',
                media.storageKey,
                typeof media.mimeType === 'string' ? media.mimeType : null,
                JSON.stringify({
                  url: typeof media.url === 'string' ? media.url : null,
                  originalFilename: typeof media.originalFilename === 'string' ? media.originalFilename : null,
                }),
              ],
            )
          }
        }
      }

      await client.query(
        `INSERT INTO appointment_status_history
          (salon_id, appointment_id, status_code, changed_by_user_id, note)
         VALUES ($1, $2, 'scheduled', $3, 'Appointment created through API')`,
        [input.salonId, appointment.id, input.createdByUserId ?? null],
      )

      return appointment
    })
  },

  uploadTreatmentMedia(
    salonId: string,
    input: {
      dataBase64: string
      mimeType: string
      originalFilename?: string
      mediaType?: string
      category?: string
    },
  ) {
    return saveSalonMedia({
      salonId,
      dataBase64: input.dataBase64,
      mimeType: input.mimeType,
      originalFilename: input.originalFilename,
      category: input.category,
    }).then((saved) => ({
      ...saved,
      mediaType: input.mediaType ?? 'reference',
    }))
  },

  updateAppointmentStatus(
    salonId: string,
    appointmentId: string,
    input: UpdateAppointmentStatusInput,
  ): Promise<Appointment> {
    return withTransaction(async (client) => {
      const currentRows = await clientRows<Appointment>(
        client,
        'SELECT * FROM appointments WHERE salon_id = $1 AND id = $2 FOR UPDATE',
        [salonId, appointmentId],
      )
      const current = currentRows[0]
      if (!current) throw new ApiError(404, 'Appointment not found')

      const transitions = await clientRows<QueryResultRow>(
        client,
        `SELECT 1 FROM appointment_status_transitions
         WHERE from_status_code = $1 AND to_status_code = $2
           AND allowed_actor_role IN ($3, 'any')`,
        [current.status_code, input.status, input.actorRole],
      )
      if (!transitions[0]) {
        throw new ApiError(409, `Cannot move appointment from ${current.status_code} to ${input.status}.`)
      }

      const rows = await clientRows<Appointment>(
        client,
        `UPDATE appointments SET
           status_code = $3,
           canceled_at = CASE WHEN $3 = 'canceled' THEN now() ELSE canceled_at END,
           canceled_by_user_id = CASE WHEN $3 = 'canceled' THEN $4::uuid ELSE canceled_by_user_id END
         WHERE salon_id = $1 AND id = $2
         RETURNING *`,
        [salonId, appointmentId, input.status, input.actorUserId ?? null],
      )
      const updated = rows[0]
      if (!updated) throw new ApiError(500, 'Appointment status could not be updated.')

      await client.query(
        `INSERT INTO appointment_status_history
          (salon_id, appointment_id, status_code, changed_by_user_id, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [salonId, appointmentId, input.status, input.actorUserId ?? null, input.note ?? null],
      )
      await client.query(
        `INSERT INTO appointment_events
          (salon_id, appointment_id, event_type, actor_user_id, from_status_code, to_status_code, metadata_json)
         VALUES ($1, $2, 'status_changed', $3, $4, $5, $6)`,
        [salonId, appointmentId, input.actorUserId ?? null, current.status_code, input.status, JSON.stringify({ note: input.note })],
      )

      return updated
    })
  },

  async listEligibleProviders(salonId: string, filters: EligibleProviderFilters) {
    const rows = await query<QueryResultRow>(
      `SELECT p.*, ps.duration_override_minutes,
              s.duration_minutes AS service_duration_minutes,
              s.category_id,
              sc.code AS category_code,
              sc.name AS category_name
       FROM professionals p
       JOIN professional_services ps
         ON ps.salon_id = p.salon_id AND ps.professional_id = p.id AND ps.is_active
       JOIN services s
         ON s.salon_id = p.salon_id AND s.id = ps.service_id AND s.is_active
       JOIN service_categories sc ON sc.id = s.category_id AND sc.is_active
       JOIN salon_service_categories ssc
         ON ssc.salon_id = p.salon_id AND ssc.category_id = s.category_id AND ssc.is_active
       WHERE p.salon_id = $1
         AND p.status = 'active'
         AND p.deleted_at IS NULL
         AND s.id = $2
         AND ($3::uuid IS NULL OR s.category_id = $3)
       ORDER BY p.full_name`,
      [salonId, filters.serviceId, filters.categoryId ?? null],
    )

    if (!filters.date) {
      return rows.map((row) => ({
        ...row,
        eligible: true,
        durationMinutes: row.duration_override_minutes ?? row.service_duration_minutes,
      }))
    }

    const duration = filters.durationMinutes ?? Number(rows[0]?.duration_override_minutes ?? rows[0]?.service_duration_minutes ?? 0)
    const eligible = []
    for (const row of rows) {
      const availability = await this.getAppointmentAvailability(salonId, {
        providerId: String(row.id),
        serviceId: filters.serviceId,
        date: filters.date,
      })
      const slots = availability.slots as Array<{ time: string; available: boolean }>
      const hasSlot = filters.optionalStartTime
        ? slots.some((slot) => slot.time === filters.optionalStartTime && slot.available)
        : slots.some((slot) => slot.available)
      if (hasSlot && duration > 0) {
        eligible.push({
          ...row,
          eligible: true,
          durationMinutes: row.duration_override_minutes ?? row.service_duration_minutes,
        })
      }
    }
    return eligible
  },

  async getAppointmentAvailability(salonId: string, filters: AppointmentAvailabilityFilters): Promise<Record<string, unknown>> {
    const serviceRows = await query<QueryResultRow & {
      duration_minutes: number
      duration_override_minutes: number | null
      professional_name: string
    }>(
      `SELECT s.duration_minutes, ps.duration_override_minutes, p.full_name AS professional_name
       FROM services s
       JOIN professional_services ps
         ON ps.salon_id = s.salon_id AND ps.service_id = s.id
       JOIN professionals p
         ON p.salon_id = ps.salon_id AND p.id = ps.professional_id
       WHERE s.salon_id = $1
         AND s.id = $2
         AND p.id = $3
         AND s.is_active
         AND ps.is_active
         AND p.status = 'active'
         AND p.deleted_at IS NULL
       LIMIT 1`,
      [salonId, filters.serviceId, filters.providerId],
    )
    const service = serviceRows[0]
    if (!service) {
      throw new ApiError(404, 'No active provider-service assignment was found.')
    }

    const durationMinutes = Number(service.duration_override_minutes ?? service.duration_minutes)
    const dayOfWeek = getUtcDayOfWeek(filters.date)
    const providerHours = await query<QueryResultRow & { starts_at: string | null; ends_at: string | null; is_working: boolean }>(
      `SELECT starts_at, ends_at, is_working
       FROM professional_working_hours
       WHERE salon_id = $1 AND professional_id = $2 AND day_of_week = $3
       LIMIT 1`,
      [salonId, filters.providerId, dayOfWeek],
    )
    const salonHours = await query<QueryResultRow & { opens_at: string | null; closes_at: string | null; is_open: boolean }>(
      `SELECT opens_at, closes_at, is_open
       FROM salon_working_hours
       WHERE salon_id = $1 AND day_of_week = $2
       LIMIT 1`,
      [salonId, dayOfWeek],
    )
    const providerDay = providerHours[0]
    const salonDay = salonHours[0]
    const openRaw = providerDay
      ? (providerDay.is_working ? providerDay.starts_at : null)
      : (salonDay?.is_open ? salonDay.opens_at : null)
    const closeRaw = providerDay
      ? (providerDay.is_working ? providerDay.ends_at : null)
      : (salonDay?.is_open ? salonDay.closes_at : null)
    const openMinutes = timeStringToMinutes(openRaw)
    const closeMinutes = timeStringToMinutes(closeRaw)

    if (openMinutes === null || closeMinutes === null || openMinutes >= closeMinutes) {
      return {
        providerId: filters.providerId,
        serviceId: filters.serviceId,
        date: filters.date,
        durationMinutes,
        slots: [],
      }
    }

    const dayStart = dateAtLocalTime(filters.date, '00:00').toISOString()
    const dayEnd = dateAtLocalTime(filters.date, '23:59').toISOString()
    const [appointments, exceptions] = await Promise.all([
      query<QueryResultRow & { starts_at: string; ends_at: string }>(
        `SELECT starts_at, ends_at
         FROM appointments
         WHERE salon_id = $1
           AND professional_id = $2
           AND status_code NOT IN ('completed', 'canceled', 'no_show')
           AND starts_at < $4::timestamptz
           AND ends_at > $3::timestamptz
         ORDER BY starts_at`,
        [salonId, filters.providerId, dayStart, dayEnd],
      ),
      query<QueryResultRow & { starts_at: string; ends_at: string; exception_type: string }>(
        `SELECT starts_at, ends_at, exception_type
         FROM availability_exceptions
         WHERE salon_id = $1
           AND (professional_id IS NULL OR professional_id = $2)
           AND exception_type IN ('blocked', 'time_off', 'holiday')
           AND starts_at < $4::timestamptz
           AND ends_at > $3::timestamptz`,
        [salonId, filters.providerId, dayStart, dayEnd],
      ),
    ])

    const blocked = [...appointments, ...exceptions].map((item) => ({
      start: new Date(item.starts_at).getTime(),
      end: new Date(item.ends_at).getTime(),
    }))
    const slots = []
    for (let minute = openMinutes; minute + durationMinutes <= closeMinutes; minute += 30) {
      const time = minutesToTimeString(minute)
      const start = dateAtLocalTime(filters.date, time)
      const end = new Date(start.getTime() + durationMinutes * 60_000)
      const available = !blocked.some((block) => start.getTime() < block.end && end.getTime() > block.start)
      slots.push({
        time,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
        label: start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        available,
      })
    }

    return {
      providerId: filters.providerId,
      serviceId: filters.serviceId,
      date: filters.date,
      durationMinutes,
      timezone: filters.timezone ?? 'America/Merida',
      workingWindow: {
        open: minutesToTimeString(openMinutes),
        close: minutesToTimeString(closeMinutes),
      },
      slots,
    }
  },

  async getAvailability(salonId: string, filters: AvailabilityFilters): Promise<Record<string, unknown>> {
    const [salonHours, professionalHours, exceptions, appointments] = await Promise.all([
      query('SELECT * FROM salon_working_hours WHERE salon_id = $1 ORDER BY day_of_week', [salonId]),
      query(
        `SELECT * FROM professional_working_hours
         WHERE salon_id = $1 AND ($2::uuid IS NULL OR professional_id = $2)
         ORDER BY professional_id, day_of_week`,
        [salonId, filters.professionalId ?? null],
      ),
      query(
        `SELECT * FROM availability_exceptions
         WHERE salon_id = $1
           AND ($2::uuid IS NULL OR professional_id IS NULL OR professional_id = $2)
           AND starts_at < $4::timestamptz AND ends_at > $3::timestamptz
         ORDER BY starts_at`,
        [salonId, filters.professionalId ?? null, filters.from, filters.to],
      ),
      query(
        `SELECT id, professional_id, status_code, starts_at, ends_at
         FROM appointments
         WHERE salon_id = $1
           AND ($2::uuid IS NULL OR professional_id = $2)
           AND status_code NOT IN ('canceled', 'completed', 'no_show')
           AND starts_at < $4::timestamptz AND ends_at > $3::timestamptz
         ORDER BY starts_at`,
        [salonId, filters.professionalId ?? null, filters.from, filters.to],
      ),
    ])

    return { salon_hours: salonHours, professional_hours: professionalHours, exceptions, appointments }
  },

  listPayments(salonId: string, appointmentId: string | undefined, options: ListOptions): Promise<Payment[]> {
    return query<Payment>(
      `SELECT * FROM payments
       WHERE salon_id = $1 AND ($2::uuid IS NULL OR appointment_id = $2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [salonId, appointmentId ?? null, options.limit, options.offset],
    )
  },

  listInvoices(salonId: string, appointmentId: string | undefined, options: ListOptions): Promise<Invoice[]> {
    return query<Invoice>(
      `SELECT * FROM invoices
       WHERE salon_id = $1 AND ($2::uuid IS NULL OR appointment_id = $2)
       ORDER BY issued_at DESC LIMIT $3 OFFSET $4`,
      [salonId, appointmentId ?? null, options.limit, options.offset],
    )
  },

  listReceipts(salonId: string, options: ListOptions): Promise<Receipt[]> {
    return query<Receipt>(
      'SELECT * FROM receipts WHERE salon_id = $1 ORDER BY issued_at DESC LIMIT $2 OFFSET $3',
      [salonId, options.limit, options.offset],
    )
  },

  async listSalesHistory(salonId: string, filters: SalesHistoryFilters): Promise<SalesHistoryResponse> {
    const startDate = filters.startDate ?? (filters.from ? filters.from.slice(0, 10) : null)
    const endDate = filters.endDate ?? (filters.to ? filters.to.slice(0, 10) : null)
    const from = filters.from ?? (startDate ? `${startDate}T00:00:00.000Z` : null)
    const to = filters.to ?? (endDate ? `${endDate}T23:59:59.999Z` : null)

    const baseSql = `
      WITH service_financials AS (
        SELECT
          aps.id,
          a.id AS appointment_id,
          aps.id AS appointment_service_id,
          a.salon_id,
          a.client_id,
          c.full_name AS client_name,
          a.professional_id,
          p.full_name AS professional_name,
          p.avatar_url AS provider_avatar_url,
          a.starts_at,
          a.ends_at,
          af.recorded_at,
          a.status_code,
          aps.service_id,
          aps.service_name_snapshot AS service_name,
          s.category_id,
          aps.category_code_snapshot AS category_code,
          COALESCE(sc.name, initcap(replace(aps.category_code_snapshot, '_', ' '))) AS category_name,
          aps.duration_minutes_snapshot,
          aps.unit_price_minor,
          af.subtotal_minor,
          af.discount_minor,
          af.tax_minor,
          af.tip_minor,
          af.total_minor,
          af.salon_earnings_minor,
          af.professional_earnings_minor,
          af.currency_code,
          tr.notes,
          tr.recommendations,
          tr.details_json AS treatment_details,
          tr.completed_at,
          SUM(aps.unit_price_minor) OVER (PARTITION BY a.id) AS appointment_services_total
        FROM appointments a
        JOIN appointment_financials af
          ON af.salon_id = a.salon_id AND af.appointment_id = a.id
        JOIN appointment_services aps
          ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
        JOIN clients c
          ON c.salon_id = a.salon_id AND c.id = a.client_id
        JOIN professionals p
          ON p.salon_id = a.salon_id AND p.id = a.professional_id
        LEFT JOIN services s
          ON s.salon_id = a.salon_id AND s.id = aps.service_id
        LEFT JOIN service_categories sc
          ON sc.id = s.category_id OR sc.code = aps.category_code_snapshot
        LEFT JOIN treatment_records tr
          ON tr.salon_id = a.salon_id AND tr.appointment_service_id = aps.id
        WHERE a.salon_id = $1
          AND a.status_code = 'completed'
          AND ($2::uuid IS NULL OR a.professional_id = $2)
          AND ($3::timestamptz IS NULL OR COALESCE(tr.completed_at, af.recorded_at, a.ends_at) >= $3)
          AND ($4::timestamptz IS NULL OR COALESCE(tr.completed_at, af.recorded_at, a.ends_at) <= $4)
          AND ($5::uuid IS NULL OR s.category_id = $5)
          AND ($6::text IS NULL OR aps.category_code_snapshot = $6)
      ),
      allocated AS (
        SELECT
          *,
          CASE WHEN appointment_services_total > 0 THEN unit_price_minor::numeric / appointment_services_total::numeric ELSE 1 END AS share
        FROM service_financials
      )
    `
    const values = [
      salonId,
      filters.professionalId ?? null,
      from,
      to,
      filters.categoryId ?? null,
      filters.category ?? null,
    ]

    const records = await query<SalesHistoryRecord>(
      `${baseSql}
       SELECT
         id, appointment_id, appointment_service_id, salon_id, client_id, client_name,
         professional_id, professional_name, provider_avatar_url, starts_at, ends_at,
         recorded_at, status_code, service_id, service_name, category_id, category_code,
         category_name, unit_price_minor AS subtotal_minor,
         round(discount_minor * share)::int AS discount_minor,
         round(tax_minor * share)::int AS tax_minor,
         round(tip_minor * share)::int AS tip_minor,
         round(total_minor * share)::int AS total_minor,
         round(salon_earnings_minor * share)::int AS salon_earnings_minor,
         round(professional_earnings_minor * share)::int AS professional_earnings_minor,
         currency_code, notes, recommendations, treatment_details, completed_at
       FROM allocated
       ORDER BY COALESCE(completed_at, recorded_at, ends_at) DESC
       LIMIT $7 OFFSET $8`,
      [...values, filters.limit, filters.offset],
    )

    const [summaryRows, totalRows, providerRows, providerServiceRows] = await Promise.all([
      query<{ salon_income: string; provider_income: string; tips: string; record_count: string; currency_code: string }>(
        `${baseSql}
         SELECT
           COALESCE(SUM(round(salon_earnings_minor * share)::int), 0)::text AS salon_income,
           COALESCE(SUM(round(professional_earnings_minor * share)::int), 0)::text AS provider_income,
           COALESCE(SUM(round(tip_minor * share)::int), 0)::text AS tips,
           COUNT(*)::text AS record_count,
           COALESCE(MAX(currency_code), (SELECT currency_code FROM salons WHERE id = $1)) AS currency_code
         FROM allocated`,
        values,
      ),
      query<{ count: string }>(
        `SELECT COUNT(aps.id)::text AS count
         FROM appointments a
         JOIN appointment_financials af ON af.salon_id = a.salon_id AND af.appointment_id = a.id
         JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
         WHERE a.salon_id = $1 AND a.status_code = 'completed'`,
        [salonId],
      ),
      filters.professionalId
        ? query<{ full_name: string; avatar_url: string | null }>(
            'SELECT full_name, avatar_url FROM professionals WHERE salon_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1',
            [salonId, filters.professionalId],
          )
        : Promise.resolve([]),
      filters.professionalId
        ? query<{ count: string }>(
            'SELECT COUNT(*)::text AS count FROM professional_services WHERE salon_id = $1 AND professional_id = $2 AND is_active',
            [salonId, filters.professionalId],
          )
        : Promise.resolve([]),
    ])
    const summary = summaryRows[0]
    const provider = providerRows[0]

    return {
      filters: {
        providerId: filters.professionalId ?? null,
        startDate,
        endDate,
        categoryId: filters.categoryId ?? null,
      },
      summary: {
        salonIncome: Number(summary?.salon_income ?? 0),
        providerIncome: Number(summary?.provider_income ?? 0),
        tips: Number(summary?.tips ?? 0),
        recordCount: Number(summary?.record_count ?? 0),
        totalAvailableCount: Number(totalRows[0]?.count ?? 0),
        currencyCode: summary?.currency_code ?? 'USD',
        selectedProviderHasServices: filters.professionalId ? Number(providerServiceRows[0]?.count ?? 0) > 0 : null,
        selectedProviderName: provider?.full_name ?? null,
        selectedProviderAvatarUrl: provider?.avatar_url ?? null,
      },
      records,
    }
  },

  async getSalesHistoryDetail(salonId: string, recordId: string): Promise<SalesHistoryRecord> {
    const result = await this.listSalesHistory(salonId, {
      limit: 1,
      offset: 0,
    })
    const record = result.records.find((item) => item.id === recordId)
    if (record) return record

    const detail = await query<SalesHistoryRecord>(
      `WITH service_financials AS (
        SELECT
          aps.id,
          a.id AS appointment_id,
          aps.id AS appointment_service_id,
          a.salon_id,
          a.client_id,
          c.full_name AS client_name,
          a.professional_id,
          p.full_name AS professional_name,
          p.avatar_url AS provider_avatar_url,
          a.starts_at,
          a.ends_at,
          af.recorded_at,
          a.status_code,
          aps.service_id,
          aps.service_name_snapshot AS service_name,
          s.category_id,
          aps.category_code_snapshot AS category_code,
          COALESCE(sc.name, initcap(replace(aps.category_code_snapshot, '_', ' '))) AS category_name,
          aps.duration_minutes_snapshot,
          aps.unit_price_minor,
          af.subtotal_minor,
          af.discount_minor,
          af.tax_minor,
          af.tip_minor,
          af.total_minor,
          af.salon_earnings_minor,
          af.professional_earnings_minor,
          af.currency_code,
          tr.notes,
          tr.recommendations,
          tr.details_json AS treatment_details,
          tr.completed_at,
          SUM(aps.unit_price_minor) OVER (PARTITION BY a.id) AS appointment_services_total
        FROM appointments a
        JOIN appointment_financials af ON af.salon_id = a.salon_id AND af.appointment_id = a.id
        JOIN appointment_services aps ON aps.salon_id = a.salon_id AND aps.appointment_id = a.id
        JOIN clients c ON c.salon_id = a.salon_id AND c.id = a.client_id
        JOIN professionals p ON p.salon_id = a.salon_id AND p.id = a.professional_id
        LEFT JOIN services s ON s.salon_id = a.salon_id AND s.id = aps.service_id
        LEFT JOIN service_categories sc ON sc.id = s.category_id OR sc.code = aps.category_code_snapshot
        LEFT JOIN treatment_records tr ON tr.salon_id = a.salon_id AND tr.appointment_service_id = aps.id
        WHERE a.salon_id = $1 AND aps.id = $2 AND a.status_code = 'completed'
      ),
      allocated AS (
        SELECT *, CASE WHEN appointment_services_total > 0 THEN unit_price_minor::numeric / appointment_services_total::numeric ELSE 1 END AS share
        FROM service_financials
      )
      SELECT
        id, appointment_id, appointment_service_id, salon_id, client_id, client_name,
        professional_id, professional_name, provider_avatar_url, starts_at, ends_at,
        recorded_at, status_code, service_id, service_name, category_id, category_code,
        category_name, unit_price_minor AS subtotal_minor,
        round(discount_minor * share)::int AS discount_minor,
        round(tax_minor * share)::int AS tax_minor,
        round(tip_minor * share)::int AS tip_minor,
        round(total_minor * share)::int AS total_minor,
        round(salon_earnings_minor * share)::int AS salon_earnings_minor,
        round(professional_earnings_minor * share)::int AS professional_earnings_minor,
        currency_code, notes, recommendations, treatment_details, completed_at
      FROM allocated`,
      [salonId, recordId],
    )
    if (!detail[0]) throw new ApiError(404, 'Sales history record not found')
    return detail[0]
  },

  listNotifications(salonId: string, status: string | undefined, options: ListOptions): Promise<Notification[]> {
    return query<Notification>(
      `SELECT * FROM notifications
       WHERE salon_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [salonId, status ?? null, options.limit, options.offset],
    )
  },

  getSettings(salonId: string): Promise<SalonSettings> {
    return oneOrNotFound<SalonSettings>(
      'SELECT * FROM salon_settings WHERE salon_id = $1',
      [salonId],
      'Salon settings not found',
    )
  },

  updateSettings(salonId: string, input: UpdateSettingsInput): Promise<SalonSettings> {
    return oneOrNotFound<SalonSettings>(
      `UPDATE salon_settings SET
         appointment_interval_minutes = COALESCE($2, appointment_interval_minutes),
         minimum_booking_notice_minutes = COALESCE($3, minimum_booking_notice_minutes),
         maximum_booking_days_ahead = COALESCE($4, maximum_booking_days_ahead),
         cancellation_notice_minutes = COALESCE($5, cancellation_notice_minutes),
         allow_public_booking = COALESCE($6, allow_public_booking),
         require_booking_confirmation = COALESCE($7, require_booking_confirmation),
         settings_json = COALESCE($8::jsonb, settings_json)
       WHERE salon_id = $1
       RETURNING *`,
      [
        salonId,
        input.appointmentIntervalMinutes ?? null,
        input.minimumBookingNoticeMinutes ?? null,
        input.maximumBookingDaysAhead ?? null,
        input.cancellationNoticeMinutes ?? null,
        input.allowPublicBooking ?? null,
        input.requireBookingConfirmation ?? null,
        input.settingsJson ? JSON.stringify(input.settingsJson) : null,
      ],
      'Salon settings not found',
    )
  },

  listReviews(salonId: string, publicOnly: boolean, options: ListOptions): Promise<Review[]> {
    return query<Review>(
      `SELECT * FROM reviews
       WHERE salon_id = $1 AND (NOT $2::boolean OR is_public)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [salonId, publicOnly, options.limit, options.offset],
    )
  },
}
