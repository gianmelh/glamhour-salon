import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { config } from './config.js'
import { ApiError } from './errors.js'
import { asyncHandler, validate } from './http.js'
import { dataService } from './services/data-service.js'
import { verifyAppleIdentityToken, verifyFacebookAccessToken } from './services/social-auth-service.js'
import {
  annotationSchema,
  appointmentAnnotationParamsSchema,
  appointmentAnnotationResourceParamsSchema,
  appointmentAvailabilityQuerySchema,
  appointmentQuerySchema,
  categoryParamSchema,
  clientParamsSchema,
  consentRecordSchema,
  createAppointmentSchema,
  createClientSchema,
  createServiceSchema,
  confirmPasswordResetSchema,
  dashboardQuerySchema,
  eligibleProvidersQuerySchema,
  healthQuestionnaireSchema,
  nailSettingsSchema,
  questionnaireParamsSchema,
  registerAppleSalonSchema,
  registerFacebookSalonSchema,
  loginSchema,
  paginationSchema,
  registerGoogleSalonSchema,
  registerSalonSchema,
  reassignProfessionalSchema,
  requestPasswordResetSchema,
  salonParamsSchema,
  salonResourceParamsSchema,
  saveOnboardingSchema,
  serviceMaterialsQuerySchema,
  signatureRecordSchema,
  updateAppointmentStatusSchema,
  updateSalonSettingsSchema,
  uploadTreatmentMediaSchema,
  upsertProfessionalSchema,
  uuidSchema,
  verifyPasswordResetCodeSchema,
} from './validation.js'
import { z } from 'zod'

const router = Router()
const googleOAuthClient = new OAuth2Client()

const listQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  categoryId: uuidSchema.optional(),
  appointmentId: uuidSchema.optional(),
  professionalId: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  status: z.string().trim().min(1).optional(),
  publicOnly: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

router.post('/auth/login', asyncHandler(async (request, response) => {
  const body = validate(loginSchema, request.body)
  response.json({ data: await dataService.login(body) })
}))

router.post('/auth/password-reset/request', asyncHandler(async (request, response) => {
  const body = validate(requestPasswordResetSchema, request.body)
  response.json({ data: await dataService.requestPasswordReset(body) })
}))

router.post('/auth/password-reset/verify', asyncHandler(async (request, response) => {
  const body = validate(verifyPasswordResetCodeSchema, request.body)
  response.json({ data: await dataService.verifyPasswordResetCode(body) })
}))

router.post('/auth/password-reset/confirm', asyncHandler(async (request, response) => {
  const body = validate(confirmPasswordResetSchema, request.body)
  response.json({ data: await dataService.confirmPasswordReset(body) })
}))

router.post('/auth/register', asyncHandler(async (request, response) => {
  const body = validate(registerSalonSchema, request.body)
  response.status(201).json({ data: await dataService.registerSalon(body) })
}))

router.post('/auth/google/register', asyncHandler(async (request, response) => {
  if (!config.GOOGLE_CLIENT_ID) {
    throw new ApiError(500, 'Google sign up is not configured.')
  }

  const body = validate(registerGoogleSalonSchema, request.body)
  const ticket = await googleOAuthClient.verifyIdToken({
    idToken: body.credential,
    audience: config.GOOGLE_CLIENT_ID,
  }).catch(() => {
    throw new ApiError(401, 'Google account could not be verified.')
  })
  const payload = ticket.getPayload()

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw new ApiError(401, 'Google account could not be verified.')
  }

  const { credential: _credential, ...registration } = body
  void _credential

  response.status(201).json({
    data: await dataService.registerSocialSalon({
      ...registration,
      email: payload.email,
      ownerFullName: payload.name ?? payload.email,
      authProvider: 'google',
      authProviderSubject: payload.sub,
    }),
  })
}))

router.post('/auth/facebook/register', asyncHandler(async (request, response) => {
  const body = validate(registerFacebookSalonSchema, request.body)
  const profile = await verifyFacebookAccessToken(body.accessToken)
  const { accessToken: _accessToken, ...registration } = body
  void _accessToken

  response.status(201).json({
    data: await dataService.registerSocialSalon({
      ...registration,
      email: profile.email,
      ownerFullName: profile.name,
      authProvider: 'facebook',
      authProviderSubject: profile.subject,
    }),
  })
}))

router.post('/auth/apple/register', asyncHandler(async (request, response) => {
  const body = validate(registerAppleSalonSchema, request.body)
  const profile = await verifyAppleIdentityToken(body.identityToken)
  const { identityToken: _identityToken, ...registration } = body
  void _identityToken

  response.status(201).json({
    data: await dataService.registerSocialSalon({
      ...registration,
      email: profile.email,
      ownerFullName: registration.ownerFullName ?? profile.name,
      authProvider: 'apple',
      authProviderSubject: profile.subject,
    }),
  })
}))

router.get('/salons', asyncHandler(async (request, response) => {
  const query = validate(paginationSchema, request.query)
  response.json({ data: await dataService.listSalons(query) })
}))

router.get('/salons/by-slug/:slug', asyncHandler(async (request, response) => {
  const { slug } = validate(z.object({ slug: z.string().min(1) }), request.params)
  response.json({ data: await dataService.getSalonBySlug(slug) })
}))

router.get('/salons/:salonId', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  response.json({ data: await dataService.getSalon(salonId) })
}))

router.get('/salons/:salonId/dashboard', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(dashboardQuerySchema, request.query)
  response.json({ data: await dataService.getDashboard(salonId, query.date) })
}))

router.put('/salons/:salonId/onboarding', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(saveOnboardingSchema, request.body)
  response.json({ data: await dataService.saveOnboarding(salonId, body) })
}))

router.get('/salons/:salonId/professionals', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(paginationSchema, request.query)
  response.json({ data: await dataService.listProfessionals(salonId, query) })
}))

router.get('/salons/:salonId/providers/eligible', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(eligibleProvidersQuerySchema, request.query)
  response.json({ data: await dataService.listEligibleProviders(salonId, query) })
}))

router.post('/salons/:salonId/professionals', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(upsertProfessionalSchema, request.body)
  response.status(201).json({ data: await dataService.createProfessional(salonId, body) })
}))

router.post('/salons/:salonId/professionals/:id/reassign-and-deactivate', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  const body = validate(reassignProfessionalSchema, request.body)
  response.json({ data: await dataService.reassignAndDeactivateProfessional(salonId, id, body) })
}))

router.get('/salons/:salonId/professionals/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getProfessional(salonId, id) })
}))

router.put('/salons/:salonId/professionals/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  const body = validate(upsertProfessionalSchema, request.body)
  response.json({ data: await dataService.updateProfessional(salonId, id, body) })
}))

router.delete('/salons/:salonId/professionals/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.deleteProfessional(salonId, id) })
}))

router.get('/salons/:salonId/clients', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listClients(salonId, query.search, query) })
}))

router.get('/salons/:salonId/clients/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getClient(salonId, id) })
}))

router.post('/salons/:salonId/clients', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(createClientSchema, request.body)
  response.status(201).json({ data: await dataService.createClient(salonId, body) })
}))

router.get('/salons/:salonId/clients/:clientId/health-profiles', asyncHandler(async (request, response) => {
  const { salonId, clientId } = validate(clientParamsSchema, request.params)
  response.json({ data: await dataService.listHealthProfiles(salonId, clientId) })
}))

router.get('/salons/:salonId/clients/:clientId/health-profiles/:category', asyncHandler(async (request, response) => {
  const { salonId, clientId, category } = validate(categoryParamSchema, request.params)
  response.json({ data: await dataService.getHealthProfile(salonId, clientId, category) })
}))

router.get('/service-categories', asyncHandler(async (request, response) => {
  const query = validate(z.object({ salonId: uuidSchema.optional() }), request.query)
  response.json({ data: await dataService.listServiceCategories(query.salonId) })
}))

router.get('/salons/:salonId/appointment-categories', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  response.json({ data: await dataService.listAppointmentCategories(salonId) })
}))

router.get('/salons/:salonId/services', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listServices(salonId, query.category, query) })
}))

router.get('/salons/:salonId/services/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getService(salonId, id) })
}))

router.post('/salons/:salonId/services', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(createServiceSchema, request.body)
  response.status(201).json({ data: await dataService.createService(salonId, body) })
}))

router.get('/salons/:salonId/appointments', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(appointmentQuerySchema, request.query)
  response.json({ data: await dataService.listAppointments(salonId, query) })
}))

router.post('/salons/:salonId/treatment-media/upload', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(uploadTreatmentMediaSchema, request.body)
  response.status(201).json({ data: await dataService.uploadTreatmentMedia(salonId, body) })
}))

router.post('/salons/:salonId/appointments', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(createAppointmentSchema, request.body)
  response.status(201).json({ data: await dataService.createAppointment({ salonId, ...body }) })
}))

router.post('/salons/:salonId/health-questionnaires', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(healthQuestionnaireSchema, request.body)
  response.status(201).json({ data: await dataService.createHealthQuestionnaire(salonId, body) })
}))

router.put('/salons/:salonId/health-questionnaires/:questionnaireId', asyncHandler(async (request, response) => {
  const { salonId, questionnaireId } = validate(questionnaireParamsSchema, request.params)
  const body = validate(healthQuestionnaireSchema, request.body)
  response.json({ data: await dataService.updateHealthQuestionnaire(salonId, questionnaireId, body) })
}))

router.post('/salons/:salonId/consents', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(consentRecordSchema, request.body)
  response.status(201).json({ data: await dataService.createConsentRecord(salonId, body) })
}))

router.post('/salons/:salonId/signatures', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(signatureRecordSchema, request.body)
  response.status(201).json({ data: await dataService.createSignatureRecord(salonId, body) })
}))

router.post('/salons/:salonId/appointments/:appointmentId/annotations', asyncHandler(async (request, response) => {
  const { salonId, appointmentId } = validate(appointmentAnnotationParamsSchema, request.params)
  const body = validate(annotationSchema, request.body)
  response.status(201).json({ data: await dataService.createAnnotation(salonId, appointmentId, body) })
}))

router.put('/salons/:salonId/appointments/:appointmentId/annotations/:annotationId', asyncHandler(async (request, response) => {
  const { salonId, appointmentId, annotationId } = validate(appointmentAnnotationResourceParamsSchema, request.params)
  const body = validate(annotationSchema, request.body)
  response.json({ data: await dataService.updateAnnotation(salonId, appointmentId, annotationId, body) })
}))

router.delete('/salons/:salonId/appointments/:appointmentId/annotations/:annotationId', asyncHandler(async (request, response) => {
  const { salonId, appointmentId, annotationId } = validate(appointmentAnnotationResourceParamsSchema, request.params)
  response.json({ data: await dataService.deleteAnnotation(salonId, appointmentId, annotationId) })
}))

router.get('/salons/:salonId/appointments/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getAppointment(salonId, id) })
}))

router.patch('/salons/:salonId/appointments/:id/status', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  const body = validate(updateAppointmentStatusSchema, request.body)
  response.json({ data: await dataService.updateAppointmentStatus(salonId, id, body) })
}))

router.get('/salons/:salonId/availability', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(appointmentAvailabilityQuerySchema, request.query)
  response.json({ data: await dataService.getAppointmentAvailability(salonId, query) })
}))

router.get('/salons/:salonId/payments', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listPayments(salonId, query.appointmentId, query) })
}))

router.get('/salons/:salonId/invoices', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listInvoices(salonId, query.appointmentId, query) })
}))

router.get('/salons/:salonId/receipts', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(paginationSchema, request.query)
  response.json({ data: await dataService.listReceipts(salonId, query) })
}))

router.get('/salons/:salonId/sales-history', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({
    data: await dataService.listSalesHistory(salonId, query),
  })
}))

router.get('/salons/:salonId/sales-history/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getSalesHistoryDetail(salonId, id) })
}))

router.get('/salons/:salonId/notifications', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listNotifications(salonId, query.status, query) })
}))

router.get('/salons/:salonId/settings', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  response.json({ data: await dataService.getSettings(salonId) })
}))

router.get('/salons/:salonId/service-materials', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(serviceMaterialsQuerySchema, request.query)
  response.json({ data: await dataService.getServiceMaterials(salonId, query) })
}))

router.get('/salons/:salonId/settings/nails', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  response.json({ data: await dataService.getNailSettings(salonId) })
}))

router.put('/salons/:salonId/settings/nails', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(nailSettingsSchema, request.body)
  response.json({ data: await dataService.updateNailSettings(salonId, body) })
}))

router.patch('/salons/:salonId/settings', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(updateSalonSettingsSchema, request.body)
  response.json({ data: await dataService.updateSettings(salonId, body) })
}))

router.get('/salons/:salonId/reviews', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(listQuerySchema, request.query)
  response.json({ data: await dataService.listReviews(salonId, query.publicOnly, query) })
}))

export const apiRouter = router
