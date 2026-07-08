import { useCallback } from 'react'
import {
  fallbackAppointments, fallbackCategories, fallbackClients, fallbackNotifications, fallbackProfessionals, fallbackSales,
  fallbackSalon, fallbackServices, fallbackSettings,
} from '../data/fallback-data'
import { glamhourApi } from '../services/glamhour-api'
import { useApiResource } from './useApiResource'

const activeSalonSessionKey = 'glamhour:active-salon-id'

function useResolvedSalonId(salonId?: string) {
  if (salonId) {
    return salonId
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return window.sessionStorage.getItem(activeSalonSessionKey) ?? undefined
}

export const useSalon = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salon(resolvedSalonId), [resolvedSalonId]), fallbackSalon)
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
export const useSalesHistory = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.salesHistory(resolvedSalonId), [resolvedSalonId]), fallbackSales)
}
export const useSettings = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.settings(resolvedSalonId), [resolvedSalonId]), fallbackSettings)
}
export const useNotifications = (salonId?: string) => {
  const resolvedSalonId = useResolvedSalonId(salonId)
  return useApiResource(useCallback(() => glamhourApi.notifications(resolvedSalonId), [resolvedSalonId]), fallbackNotifications)
}
