import { useState } from 'react'

export function useMutation<TInput, TResult>(mutation: (input: TInput) => Promise<TResult>) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const mutate = async (input: TInput) => {
    setLoading(true)
    setError(null)
    try {
      return await mutation(input)
    } catch (reason) {
      const nextError = reason instanceof Error ? reason : new Error('Request failed')
      setError(nextError)
      throw nextError
    } finally {
      setLoading(false)
    }
  }

  return { mutate, loading, error }
}
