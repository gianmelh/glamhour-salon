import { useCallback } from 'react'
import {
  fallbackAppointments, fallbackCategories, fallbackClients, fallbackNotifications, fallbackProfessionals,
  fallbackSalon, fallbackServices, fallbackSettings,
} from '../data/fallback-data'
import { glamhourApi, resolveSalonId, type SalesHistoryFilters } from '../services/glamhour-api'
import { useApiResource } from './useApiResource'

function useResolvedSalonId(salonId?: string) {
  return resolveSalonId(salonId)
}

export const useSalon = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salon(resolvedSalonId), [resolvedSalonId]), fallbackSalon)
}
export const useDashboard = (date?: string, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.dashboard(resolvedSalonId, date), [date, resolvedSalonId]))
}
export const useAppointments = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.appointments(resolvedSalonId), [resolvedSalonId]), fallbackAppointments)
}
export const useAppointment = (id: string, salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.appointment(id, resolvedSalonId), [id, resolvedSalonId]), fallbackAppointments.find((item) => item.id === id))
}
export const useClients = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.clients(resolvedSalonId), [resolvedSalonId]), fallbackClients)
}
export const useServices = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.services(resolvedSalonId), [resolvedSalonId]), fallbackServices)
}
export const useServiceCategories = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.categories(resolvedSalonId), [resolvedSalonId]), fallbackCategories)
}
export const useProfessionals = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.professionals(resolvedSalonId), [resolvedSalonId]), fallbackProfessionals)
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
  return useApiResource(useCallback(() => glamhourApi.settings(resolvedSalonId), [resolvedSalonId]), fallbackSettings)
}
export const useNotifications = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.notifications(resolvedSalonId), [resolvedSalonId]), fallbackNotifications)
}
