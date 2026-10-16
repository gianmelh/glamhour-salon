import { useCallback } from 'react'
import {
  fallbackAppointments, fallbackCategories, fallbackClients, fallbackNotifications, fallbackProfessionals,
  fallbackSalon, fallbackServices, fallbackSettings,
} from '../data/fallback-data'
import { glamhourApi, resolveSalonId, type SalesHistoryFilters } from '../services/glamhour-api'
import { applySubscriptionPreview } from '../lib/subscription-preview'
import { useApiResource } from './useApiResource'

function useResolvedSalonId(salonId?: string) {
  return resolveSalonId(salonId)
}

function fallbackForSalon<T>(resolvedSalonId: string, fallback: T) {
  return resolvedSalonId === fallbackSalon.id || resolvedSalonId.startsWith('local-salon-') ? fallback : undefined
}

export const useSalon = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salon(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackSalon))
}
export const useOnboarding = (salonId?: string, enabled = true) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => enabled && !resolvedSalonId.startsWith('local-salon-')
    ? glamhourApi.onboarding(resolvedSalonId)
    : Promise.resolve(null), [enabled, resolvedSalonId]))
}
export const useDashboard = (date?: string, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.dashboard(resolvedSalonId, date), [date, resolvedSalonId]))
}
export const useAppointments = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.appointments(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackAppointments))
}
export const useAppointment = (id: string, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.appointment(id, resolvedSalonId), [id, resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackAppointments.find((item) => item.id === id)))
}
export const useClients = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.clients(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackClients))
}
export const useServices = (salonId?: string, options?: { includeInactive?: boolean }) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  const includeInactive = options?.includeInactive
  return useApiResource(useCallback(() => glamhourApi.services(resolvedSalonId, { includeInactive }), [resolvedSalonId, includeInactive]), fallbackForSalon(resolvedSalonId, fallbackServices))
}
export const useServiceCategories = (salonId?: string, options?: { includeAll?: boolean }) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.categories(resolvedSalonId, options), [options?.includeAll, resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackCategories))
}
export const useProfessionals = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.professionals(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackProfessionals))
}
export const useNailSettings = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.nailSettings(resolvedSalonId), [resolvedSalonId]))
}
export const useSalesHistory = (filters: SalesHistoryFilters = {}, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salesHistory(resolvedSalonId, filters), [filters, resolvedSalonId]))
}
export const useSalesHistoryDetail = (recordId: string, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salesHistoryDetail(recordId, resolvedSalonId), [recordId, resolvedSalonId]))
}
export const useSettings = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.settings(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackSettings))
}
export const useSubscription = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.subscription(resolvedSalonId).then(applySubscriptionPreview), [resolvedSalonId]))
}
export const useNotifications = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.notifications(resolvedSalonId), [resolvedSalonId]), fallbackForSalon(resolvedSalonId, fallbackNotifications))
}
