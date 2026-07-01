import { useCallback } from 'react'
import {
  fallbackAppointments, fallbackCategories, fallbackClients, fallbackNotifications, fallbackProfessionals, fallbackSales,
  fallbackSalon, fallbackServices, fallbackSettings,
} from '../data/fallback-data'
import { glamhourApi } from '../services/glamhour-api'
import { useApiResource } from './useApiResource'

export const useSalon = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.salon(salonId), [salonId]), fallbackSalon)
export const useAppointments = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.appointments(salonId), [salonId]), fallbackAppointments)
export const useAppointment = (id: string, salonId?: string) => useApiResource(useCallback(() => glamhourApi.appointment(id, salonId), [id, salonId]), fallbackAppointments.find((item) => item.id === id))
export const useClients = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.clients(salonId), [salonId]), fallbackClients)
export const useServices = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.services(salonId), [salonId]), fallbackServices)
export const useServiceCategories = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.categories(salonId), [salonId]), fallbackCategories)
export const useProfessionals = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.professionals(salonId), [salonId]), fallbackProfessionals)
export const useSalesHistory = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.salesHistory(salonId), [salonId]), fallbackSales)
export const useSettings = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.settings(salonId), [salonId]), fallbackSettings)
export const useNotifications = (salonId?: string) => useApiResource(useCallback(() => glamhourApi.notifications(salonId), [salonId]), fallbackNotifications)
