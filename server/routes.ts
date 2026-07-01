import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { config } from './config.js'
import { ApiError } from './errors.js'
import { asyncHandler, validate } from './http.js'
import { dataService } from './services/data-service.js'
import {
  appointmentQuerySchema,
  availabilityQuerySchema,
  createAppointmentSchema,
  createClientSchema,
  createServiceSchema,
  paginationSchema,
  registerGoogleSalonSchema,
  registerSalonSchema,
  salonParamsSchema,
  salonResourceParamsSchema,
  updateAppointmentStatusSchema,
  updateSalonSettingsSchema,
  uuidSchema,
} from './validation.js'
import { z } from 'zod'

const router = Router()
const googleOAuthClient = new OAuth2Client()

const listQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  appointmentId: uuidSchema.optional(),
  professionalId: uuidSchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z.string().trim().min(1).optional(),
  publicOnly: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
})

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
    data: await dataService.registerGoogleSalon({
      ...registration,
      email: payload.email,
      ownerFullName: payload.name ?? payload.email,
      googleSubject: payload.sub,
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

router.get('/salons/:salonId/professionals', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const query = validate(paginationSchema, request.query)
  response.json({ data: await dataService.listProfessionals(salonId, query) })
}))

router.get('/salons/:salonId/professionals/:id', asyncHandler(async (request, response) => {
  const { salonId, id } = validate(salonResourceParamsSchema, request.params)
  response.json({ data: await dataService.getProfessional(salonId, id) })
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

router.get('/service-categories', asyncHandler(async (request, response) => {
  const query = validate(z.object({ salonId: uuidSchema.optional() }), request.query)
  response.json({ data: await dataService.listServiceCategories(query.salonId) })
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

router.post('/salons/:salonId/appointments', asyncHandler(async (request, response) => {
  const { salonId } = validate(salonParamsSchema, request.params)
  const body = validate(createAppointmentSchema, request.body)
  response.status(201).json({ data: await dataService.createAppointment({ salonId, ...body }) })
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
  const query = validate(availabilityQuerySchema, request.query)
  response.json({ data: await dataService.getAvailability(salonId, query) })
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
    data: await dataService.listSalesHistory(salonId, query.professionalId, query.from, query.to, query),
  })
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
