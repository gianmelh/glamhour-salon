import { z } from 'zod'

export const uuidSchema = z.string().uuid()
export const isoDateTimeSchema = z.string().datetime({ offset: true })

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

export const salonParamsSchema = z.object({ salonId: uuidSchema })
export const salonResourceParamsSchema = z.object({ salonId: uuidSchema, id: uuidSchema })

export const appointmentQuerySchema = paginationSchema.extend({
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
  professionalId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  status: z.string().min(1).optional(),
})

export const availabilityQuerySchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  professionalId: uuidSchema.optional(),
}).refine((value) => new Date(value.from) < new Date(value.to), {
  message: 'from must be before to',
})

export const createAppointmentSchema = z.object({
  clientId: uuidSchema,
  professionalId: uuidSchema,
  serviceIds: z.array(uuidSchema).min(1),
  startsAt: isoDateTimeSchema,
  endsAt: isoDateTimeSchema,
  source: z.enum(['internal', 'public_booking', 'rebook']).default('internal'),
  customerNotes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
  createdByUserId: uuidSchema.optional(),
}).refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
  message: 'startsAt must be before endsAt',
})

export const updateAppointmentStatusSchema = z.object({
  status: z.string().min(1),
  actorRole: z.enum(['owner', 'admin', 'professional', 'receptionist', 'client', 'system']),
  actorUserId: uuidSchema.optional(),
  note: z.string().max(2000).optional(),
})

export const createClientSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().email().max(320).optional(),
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().date().optional(),
  preferredLanguage: z.string().trim().max(10).optional(),
  notes: z.string().max(5000).optional(),
})

export const createServiceSchema = z.object({
  categoryId: uuidSchema,
  name: z.string().trim().min(1).max(160),
  description: z.string().max(5000).optional(),
  durationMinutes: z.number().int().positive(),
  priceMinor: z.number().int().min(0),
  currencyCode: z.string().trim().length(3).default('USD'),
  isPubliclyBookable: z.boolean().default(true),
})

export const updateSalonSettingsSchema = z.object({
  appointmentIntervalMinutes: z.number().int().positive().optional(),
  minimumBookingNoticeMinutes: z.number().int().min(0).optional(),
  maximumBookingDaysAhead: z.number().int().positive().optional(),
  cancellationNoticeMinutes: z.number().int().min(0).optional(),
  allowPublicBooking: z.boolean().optional(),
  requireBookingConfirmation: z.boolean().optional(),
  settingsJson: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one setting must be provided',
})

export const registerSalonSchema = z.object({
  salonName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320),
  password: z.string().min(6).max(200),
  acceptedTerms: z.literal(true),
  ownerFullName: z.string().trim().min(1).max(160).optional(),
  location: z.object({
    formattedAddress: z.string().trim().min(1).max(500),
    placeId: z.string().trim().min(1).max(255).optional(),
  }),
  document: z.object({
    originalFilename: z.string().trim().min(1).max(255),
    mimeType: z.string().trim().min(1).max(150),
    size: z.number().int().positive().max(10 * 1024 * 1024),
  }),
})

const registerSalonVerificationSchema = registerSalonSchema.omit({
  email: true,
  password: true,
})

export const registerGoogleSalonSchema = registerSalonVerificationSchema.extend({
  credential: z.string().trim().min(1),
})

export const registerFacebookSalonSchema = registerSalonVerificationSchema.extend({
  accessToken: z.string().trim().min(1),
})

export const registerAppleSalonSchema = registerSalonVerificationSchema.extend({
  identityToken: z.string().trim().min(1),
  ownerFullName: z.string().trim().min(1).max(160).optional(),
})

export const loginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
})

export const requestPasswordResetSchema = z.object({
  email: z.string().trim().email().max(320),
})

export const verifyPasswordResetCodeSchema = z.object({
  email: z.string().trim().email().max(320),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be 6 digits'),
})

export const confirmPasswordResetSchema = verifyPasswordResetCodeSchema.extend({
  password: z.string().min(6).max(200),
})
