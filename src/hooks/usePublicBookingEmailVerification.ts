import { useEffect, useRef, useState } from 'react'
import { glamhourApi } from '../services/glamhour-api'
import { deferTask } from '../lib/defer'
import { ApiClientError } from '../lib/api'

type Phase = 'idle' | 'checking' | 'unverified' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'
type VerificationState = {
  identity: string
  phase: Phase
  codeSent: boolean
  expiresAt: number | null
  resendAt: number
  error: string | null
}

const initialState = (identity: string): VerificationState => ({ identity, phase: 'idle', codeSent: false, expiresAt: null, resendAt: 0, error: null })

export function validPublicBookingEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function usePublicBookingEmailVerification(salonSlug: string, email: string, enabled: boolean) {
  const normalizedEmail = email.trim().toLowerCase()
  const valid = validPublicBookingEmail(normalizedEmail)
  const identity = `${salonSlug}\0${normalizedEmail}`
  const [state, setState] = useState<VerificationState>(() => initialState(identity))
  const [code, setCode] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const requestVersion = useRef(0)
  const previousIdentity = useRef(identity)
  // A response for an earlier email or salon never grants verification to this one.
  const current = state.identity === identity ? state : initialState(identity)

  useEffect(() => {
    const requests = requestVersion
    const version = ++requestVersion.current
    const identityChanged = previousIdentity.current !== identity
    previousIdentity.current = identity
    deferTask(() => {
      if (version !== requestVersion.current) return
      setState((previous) => {
        const sameEmail = previous.identity === identity ? previous : initialState(identity)
        return enabled && valid ? { ...sameEmail, phase: 'checking', error: null } : sameEmail
      })
      if (identityChanged) setCode('')
    })
    const timer = enabled && valid ? window.setTimeout(async () => {
      if (version !== requestVersion.current) return
      try {
        const result = await glamhourApi.publicBookingEmailStatus(salonSlug, normalizedEmail)
        if (version !== requestVersion.current) return
        setState((previous) => {
          const sameEmail = previous.identity === identity ? previous : initialState(identity)
          return result.verified
            ? { ...initialState(identity), phase: 'verified' }
            : { ...sameEmail, phase: sameEmail.codeSent ? 'sent' : 'unverified', error: null }
        })
      } catch (error) {
        if (version !== requestVersion.current) return
        setState((previous) => ({ ...(previous.identity === identity ? previous : initialState(identity)), phase: 'error', error: error instanceof Error ? error.message : 'Email verification could not be checked. Please try again.' }))
      }
    }, 500) : undefined
    return () => {
      ++requests.current
      window.clearTimeout(timer)
    }
  }, [enabled, identity, normalizedEmail, salonSlug, valid])

  const countdownActive = current.phase !== 'verified' && (current.resendAt > now || (current.codeSent && current.expiresAt !== null && current.expiresAt > now))
  useEffect(() => {
    if (!countdownActive) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [countdownActive])

  const invalidate = () => {
    ++requestVersion.current
    setState(initialState(identity))
    setCode('')
  }

  const checkStatus = async () => {
    if (!enabled || !valid) return false
    const version = ++requestVersion.current
    setState({ ...current, identity, phase: 'checking', error: null })
    try {
      const result = await glamhourApi.publicBookingEmailStatus(salonSlug, normalizedEmail)
      if (version !== requestVersion.current) return false
      setState(result.verified
        ? { ...initialState(identity), phase: 'verified' }
        : { ...current, identity, phase: current.codeSent ? 'sent' : 'unverified', error: null })
      return result.verified === true
    } catch (error) {
      if (version === requestVersion.current) {
        setState({ ...current, identity, phase: 'error', error: error instanceof Error ? error.message : 'Email verification could not be checked. Please try again.' })
      }
      return false
    }
  }

  const requestCode = async () => {
    if (!enabled || !valid || current.resendAt > Date.now()) return
    const version = ++requestVersion.current
    setState({ ...current, identity, phase: 'sending', error: null })
    try {
      const result = await glamhourApi.requestPublicBookingEmailCode(salonSlug, normalizedEmail)
      if (version !== requestVersion.current) return
      const sentAt = Date.now()
      setNow(sentAt)
      setCode('')
      setState({
        identity,
        phase: result.verified ? 'verified' : 'sent',
        codeSent: !result.verified,
        expiresAt: result.expiresInSeconds === undefined ? null : sentAt + Math.max(0, result.expiresInSeconds) * 1000,
        resendAt: sentAt + Math.max(0, result.resendAfterSeconds ?? 0) * 1000,
        error: null,
      })
    } catch (error) {
      if (version !== requestVersion.current) return
      const failedAt = Date.now()
      const retrySeconds = error instanceof ApiClientError && error.details && typeof error.details === 'object' && 'resendAfterSeconds' in error.details
        ? Number(error.details.resendAfterSeconds)
        : 0
      setNow(failedAt)
      setState({
        ...current, identity, phase: current.codeSent ? 'sent' : 'error',
        resendAt: Number.isFinite(retrySeconds) && retrySeconds > 0 ? failedAt + retrySeconds * 1000 : current.resendAt,
        error: error instanceof Error ? error.message : 'The verification code could not be sent. Please try again.',
      })
    }
  }

  const verifyCode = async () => {
    if (!enabled || !valid || !/^\d{6}$/.test(code) || !current.codeSent || (current.expiresAt !== null && current.expiresAt <= Date.now())) return
    const version = ++requestVersion.current
    setState({ ...current, identity, phase: 'verifying', error: null })
    try {
      const result = await glamhourApi.verifyPublicBookingEmailCode(salonSlug, normalizedEmail, code)
      if (version !== requestVersion.current) return
      if (result.verified !== true) throw new Error('Email could not be verified. Request a new code and try again.')
      setState({ ...initialState(identity), phase: 'verified' })
      setCode('')
    } catch (error) {
      if (version !== requestVersion.current) return
      setState({ ...current, identity, phase: 'sent', error: error instanceof Error ? error.message : 'The code could not be verified. Please try again.' })
    }
  }

  return {
    normalizedEmail, valid, phase: current.phase, code, codeSent: current.codeSent, error: current.error,
    verified: current.phase === 'verified',
    expiresInSeconds: current.expiresAt === null ? null : Math.max(0, Math.ceil((current.expiresAt - now) / 1000)),
    resendInSeconds: Math.max(0, Math.ceil((current.resendAt - now) / 1000)),
    invalidate, checkStatus, requestCode, verifyCode,
    setCode: (value: string) => {
      setCode(value.replace(/\D/g, '').slice(0, 6))
      setState((previous) => ({ ...previous, error: null }))
    },
  }
}
