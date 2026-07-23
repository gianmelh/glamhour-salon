import { useCallback } from 'react'
import { glamhourApi } from '../services/glamhour-api'
import { useApiResource } from './useApiResource'

export function useServiceMaterials(params: {
  categoryId?: string
  categoryCode?: string
  serviceId?: string
}) {
  const enabled = Boolean(params.categoryId || params.categoryCode)
  return useApiResource(
    useCallback(async () => {
      if (!enabled) return []
      return glamhourApi.serviceMaterials({
        categoryId: params.categoryId,
        categoryCode: params.categoryCode,
        serviceId: params.serviceId,
      })
    }, [enabled, params.categoryCode, params.categoryId, params.serviceId]),
    [],
  )
}

export function useNailsServiceMaterials(serviceId?: string, categoryId?: string) {
  return useServiceMaterials({
    categoryCode: 'nails',
    categoryId,
    serviceId,
  })
}
