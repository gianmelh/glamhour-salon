import { useCallback, useEffect, useState } from 'react'

export interface ApiResource<T> {
  data: T | undefined
  loading: boolean
  error: Error | null
  isFallback: boolean
  retry: () => void
  setData: React.Dispatch<React.SetStateAction<T | undefined>>
}

export function useApiResource<T>(loader: () => Promise<T>, fallback?: T): ApiResource<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [isFallback, setIsFallback] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    loader()
      .then((result) => {
        if (!active) return
        setData(result)
        setError(null)
        setIsFallback(false)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setError(reason instanceof Error ? reason : new Error('API request failed'))
        setData(fallback)
        setIsFallback(fallback !== undefined)
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [attempt, fallback, loader])

  const retry = useCallback(() => {
    setLoading(true)
    setAttempt((value) => value + 1)
  }, [])
  return { data, loading, error, isFallback, retry, setData }
}
