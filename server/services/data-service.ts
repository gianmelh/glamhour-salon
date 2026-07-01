import crypto from 'node:crypto'
import type { PoolClient, QueryResultRow } from 'pg'
import { ApiError } from '../errors.js'
import { query, withTransaction } from '../db.js'
import { config } from '../config.js'
import { sendPasswordResetCode } from './email-service.js'
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
  SalesHistoryItem,
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

interface AvailabilityFilters {
  from: string
  to: string
  professionalId?: string
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

  getSalonBySlug(slug: string): Promise<Salon> {
    return oneOrNotFound<Salon>(
      'SELECT * FROM salons WHERE slug = $1 AND deleted_at IS NULL',
      [slug],
      'Salon not found',
    )
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
           FILTER (WHERE aps.id IS NOT NULL), '[]'::jsonb) AS services
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

  createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
    return withTransaction(async (client) => {
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

      for (const service of services) {
        await client.query(
          `INSERT INTO appointment_services (
             salon_id, appointment_id, service_id, service_name_snapshot, category_code_snapshot,
             duration_minutes_snapshot, unit_price_minor, status_code
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')`,
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

  listSalesHistory(
    salonId: string,
    professionalId: string | undefined,
    from: string | undefined,
    to: string | undefined,
    options: ListOptions,
  ): Promise<SalesHistoryItem[]> {
    return query<SalesHistoryItem>(
      `SELECT * FROM sales_history
       WHERE salon_id = $1
         AND ($2::uuid IS NULL OR professional_id = $2)
         AND ($3::timestamptz IS NULL OR starts_at >= $3)
         AND ($4::timestamptz IS NULL OR starts_at < $4)
       ORDER BY starts_at DESC LIMIT $5 OFFSET $6`,
      [salonId, professionalId ?? null, from ?? null, to ?? null, options.limit, options.offset],
    )
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
