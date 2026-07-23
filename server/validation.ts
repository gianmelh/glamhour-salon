import { z } from 'zod'

export const uuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID',
)
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

export const appointmentAvailabilityQuerySchema = z.object({
  providerId: uuidSchema,
  serviceId: uuidSchema,
  date: z.string().date(),
  timezone: z.string().trim().min(1).max(80).optional(),
})

export const eligibleProvidersQuerySchema = z.object({
  serviceId: uuidSchema,
  categoryId: uuidSchema.optional(),
  date: z.string().date().optional(),
  durationMinutes: z.coerce.number().int().positive().optional(),
  optionalStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
})

export const serviceMaterialsQuerySchema = z.object({
  categoryId: uuidSchema.optional(),
  categoryCode: z.string().trim().min(1).max(60).optional(),
  serviceId: uuidSchema.optional(),
}).refine((value) => Boolean(value.categoryId || value.categoryCode), {
  message: 'categoryId or categoryCode is required',
})

export const dashboardQuerySchema = z.object({
  date: z.string().date().optional(),
})

export const uploadTreatmentMediaSchema = z.object({
  dataBase64: z.string().min(1),
  mimeType: z.string().trim().min(1).max(150),
  originalFilename: z.string().trim().min(1).max(255).optional(),
  mediaType: z.enum(['reference', 'before', 'after', 'diagram', 'signature', 'other']).default('reference'),
  category: z.string().trim().min(1).max(60).optional(),
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
  treatmentDetails: z.record(z.string(), z.unknown()).optional(),
  treatmentNotes: z.string().max(5000).optional(),
  treatmentRecommendations: z.string().max(5000).optional(),
  createdByUserId: uuidSchema.optional(),
}).refine((value) => new Date(value.startsAt) < new Date(value.endsAt), {
  message: 'startsAt must be before endsAt',
})

export const categoryParamSchema = z.object({
  salonId: uuidSchema,
  clientId: uuidSchema,
  category: z.string().trim().min(1).max(60),
})

export const clientParamsSchema = z.object({
  salonId: uuidSchema,
  clientId: uuidSchema,
})

export const questionnaireParamsSchema = z.object({
  salonId: uuidSchema,
  questionnaireId: uuidSchema,
})

export const appointmentAnnotationParamsSchema = z.object({
  salonId: uuidSchema,
  appointmentId: uuidSchema,
})

export const appointmentAnnotationResourceParamsSchema = z.object({
  salonId: uuidSchema,
  appointmentId: uuidSchema,
  annotationId: uuidSchema,
})

const questionnaireAnswerSchema = z.object({
  questionKey: z.string().trim().min(1).max(160),
  answerType: z.enum(['boolean', 'text', 'number', 'json']),
  booleanValue: z.boolean().optional().nullable(),
  textValue: z.string().max(10000).optional().nullable(),
  numericValue: z.number().optional().nullable(),
  jsonValue: z.unknown().optional().nullable(),
})

export const healthQuestionnaireSchema = z.object({
  clientId: uuidSchema,
  appointmentId: uuidSchema.optional().nullable(),
  categoryId: uuidSchema.optional().nullable(),
  category: z.string().trim().min(1).max(60).optional(),
  questionnaireType: z.string().trim().min(1).max(80),
  version: z.number().int().positive().default(1),
  status: z.enum(['draft', 'completed', 'superseded', 'expired']).default('completed'),
  completedAt: isoDateTimeSchema.optional().nullable(),
  expiresAt: isoDateTimeSchema.optional().nullable(),
  createdByUserId: uuidSchema.optional().nullable(),
  answers: z.array(questionnaireAnswerSchema).default([]),
})

export const consentRecordSchema = z.object({
  clientId: uuidSchema,
  appointmentId: uuidSchema,
  questionnaireId: uuidSchema.optional().nullable(),
  consentType: z.string().trim().min(1).max(80),
  consentVersion: z.number().int().positive().default(1),
  accepted: z.boolean(),
  acceptedAt: isoDateTimeSchema.optional().nullable(),
  consentTextSnapshot: z.string().min(1).max(20000),
})

export const signatureRecordSchema = z.object({
  clientId: uuidSchema,
  appointmentId: uuidSchema.optional().nullable(),
  questionnaireId: uuidSchema.optional().nullable(),
  signatureType: z.enum(['client_consent', 'professional_signature', 'design_approval', 'photography_consent']),
  signerName: z.string().trim().min(1).max(160),
  signatureData: z.string().trim().min(1).max(100000),
  signedAt: isoDateTimeSchema.optional().nullable(),
})

export const annotationSchema = z.object({
  clientId: uuidSchema,
  category: z.string().trim().min(1).max(60),
  bodyArea: z.string().trim().max(80).optional().nullable(),
  annotationType: z.string().trim().min(1).max(80),
  xPosition: z.number().optional().nullable(),
  yPosition: z.number().optional().nullable(),
  width: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  pathData: z.string().max(50000).optional().nullable(),
  pointsJson: z.unknown().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
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

const scheduleDaySchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((value) => !value.enabled || value.open < value.close, {
  message: 'Closing time must be after opening time',
})

export const nailSettingsSchema = z.object({
  categoryEnabled: z.boolean(),
  forceDisable: z.boolean().optional(),
  services: z.array(z.object({
    id: uuidSchema.optional(),
    name: z.string().trim().min(1).max(160),
    description: z.string().max(5000).optional().nullable(),
    priceMinor: z.number().int().min(0),
    durationMinutes: z.number().int().positive(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
  })),
  materials: z.array(z.object({
    id: uuidSchema.optional(),
    serviceId: uuidSchema.optional().nullable(),
    name: z.string().trim().min(1).max(160),
    brand: z.string().trim().max(160).optional().nullable(),
    materialType: z.string().trim().max(100).optional().nullable(),
    unit: z.string().trim().max(40).optional().nullable(),
    costMinor: z.number().int().min(0).optional().nullable(),
    isActive: z.boolean(),
    sortOrder: z.number().int().min(0),
  })),
}).superRefine((value, context) => {
  const names = new Set<string>()
  for (const service of value.services) {
    const normalized = service.name.trim().toLowerCase()
    if (names.has(normalized)) {
      context.addIssue({ code: 'custom', message: 'Service names must be unique within Nails.' })
    }
    names.add(normalized)
  }
})

const providerServiceAssignmentSchema = z.object({
  serviceId: uuidSchema,
  isActive: z.boolean(),
  durationOverrideMinutes: z.number().int().positive().optional().nullable(),
  priceOverrideMinor: z.number().int().min(0).optional().nullable(),
})

export const upsertProfessionalSchema = z.object({
  fullName: z.string().trim().min(1).max(160),
  email: z.string().trim().email().max(320).or(z.literal('')).optional(),
  phone: z.string().trim().max(40).optional(),
  avatarUrl: z.string().max(3_000_000).optional().nullable(),
  languages: z.array(z.string().trim().min(1).max(40)).default([]),
  status: z.enum(['active', 'inactive']).default('active'),
  salonEarningsPercent: z.number().min(0).max(100),
  professionalEarningsPercent: z.number().min(0).max(100),
  useSalonSchedule: z.boolean().default(true),
  schedule: z.record(z.string(), scheduleDaySchema).optional(),
  serviceAssignments: z.array(providerServiceAssignmentSchema).default([]),
}).refine((value) => Math.abs(value.salonEarningsPercent + value.professionalEarningsPercent - 100) < 0.001, {
  message: 'Salon earnings and provider earnings must add up to 100%.',
})

export const reassignProfessionalSchema = z.object({
  replacementProviderId: uuidSchema,
  appointmentIds: z.array(uuidSchema).min(1),
})

const onboardingDaySchema = z.object({
  enabled: z.boolean(),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
})

export const saveOnboardingSchema = z.object({
  step: z.enum(['categories', 'services', 'schedule', 'team', 'complete']),
  completed: z.boolean().default(false),
  draft: z.object({
    selectedCategoryIds: z.array(uuidSchema),
    services: z.array(z.object({
      id: z.string().min(1),
      categoryId: uuidSchema,
      name: z.string().trim().min(1).max(160),
      selected: z.boolean(),
      price: z.string().trim(),
      duration: z.string().trim(),
      section: z.enum(['service', 'material']).optional(),
    })),
    schedule: z.record(z.string(), onboardingDaySchema),
    providers: z.array(z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(160),
      email: z.string().trim().email().max(320).or(z.literal('')),
      phone: z.string().trim().max(40),
      photoPreview: z.string().max(3_000_000).optional(),
      languages: z.array(z.string().trim().min(1).max(10)).min(1),
      salonPercent: z.string().trim().min(1),
      professionalPercent: z.string().trim().min(1),
      serviceIds: z.array(z.string().min(1)),
      schedule: z.record(z.string(), onboardingDaySchema),
      useSalonSchedule: z.boolean().optional(),
    })),
    activeProviderId: z.string().optional(),
  }),
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
