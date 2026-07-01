import crypto from 'node:crypto'
import type { JsonWebKey } from 'node:crypto'
import { config } from '../config.js'
import { ApiError } from '../errors.js'

type SocialProfile = {
  email: string
  emailVerified: boolean
  name: string
  subject: string
}

type FacebookDebugTokenResponse = {
  data?: {
    app_id?: string
    is_valid?: boolean
    user_id?: string
  }
}

type FacebookMeResponse = {
  id?: string
  email?: string
  name?: string
}

type AppleJwk = JsonWebKey & {
  alg?: string
  kid?: string
  use?: string
}

type AppleJwksResponse = {
  keys?: AppleJwk[]
}

type AppleTokenPayload = {
  aud?: string
  email?: string
  email_verified?: string | boolean
  exp?: number
  iss?: string
  sub?: string
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='), 'base64')
}

function parseJwtPart<T>(value: string): T {
  return JSON.parse(base64UrlDecode(value).toString('utf8')) as T
}

async function fetchJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new ApiError(401, 'Social account could not be verified.')
  }

  return await response.json() as T
}

export async function verifyFacebookAccessToken(accessToken: string): Promise<SocialProfile> {
  if (!config.FACEBOOK_APP_ID || !config.FACEBOOK_APP_SECRET) {
    throw new ApiError(500, 'Facebook sign up is not configured.')
  }

  const appAccessToken = `${config.FACEBOOK_APP_ID}|${config.FACEBOOK_APP_SECRET}`
  const debugUrl = new URL('https://graph.facebook.com/debug_token')
  debugUrl.searchParams.set('input_token', accessToken)
  debugUrl.searchParams.set('access_token', appAccessToken)

  const debug = await fetchJson<FacebookDebugTokenResponse>(debugUrl)
  const userId = debug.data?.user_id

  if (!debug.data?.is_valid || debug.data.app_id !== config.FACEBOOK_APP_ID || !userId) {
    throw new ApiError(401, 'Facebook account could not be verified.')
  }

  const meUrl = new URL('https://graph.facebook.com/me')
  meUrl.searchParams.set('fields', 'id,name,email')
  meUrl.searchParams.set('access_token', accessToken)
  const profile = await fetchJson<FacebookMeResponse>(meUrl)

  if (profile.id !== userId || !profile.email) {
    throw new ApiError(401, 'Facebook account did not return a verified email.')
  }

  return {
    email: profile.email,
    emailVerified: true,
    name: profile.name ?? profile.email,
    subject: userId,
  }
}

export async function verifyAppleIdentityToken(identityToken: string): Promise<SocialProfile> {
  if (!config.APPLE_CLIENT_ID) {
    throw new ApiError(500, 'Apple sign up is not configured.')
  }

  const [encodedHeader, encodedPayload, encodedSignature] = identityToken.split('.')
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new ApiError(401, 'Apple account could not be verified.')
  }

  const header = parseJwtPart<{ alg?: string; kid?: string }>(encodedHeader)
  const payload = parseJwtPart<AppleTokenPayload>(encodedPayload)

  if (header.alg !== 'RS256' || !header.kid) {
    throw new ApiError(401, 'Apple account could not be verified.')
  }

  const jwks = await fetchJson<AppleJwksResponse>('https://appleid.apple.com/auth/keys')
  const jwk = jwks.keys?.find((key) => key.kid === header.kid)
  if (!jwk) {
    throw new ApiError(401, 'Apple account could not be verified.')
  }

  const verifier = crypto.createVerify('RSA-SHA256')
  verifier.update(`${encodedHeader}.${encodedPayload}`)
  verifier.end()

  const isValidSignature = verifier.verify(
    crypto.createPublicKey({ key: jwk, format: 'jwk' }),
    base64UrlDecode(encodedSignature),
  )

  const now = Math.floor(Date.now() / 1000)
  const emailVerified = payload.email_verified === true || payload.email_verified === 'true'

  if (
    !isValidSignature
    || payload.iss !== 'https://appleid.apple.com'
    || payload.aud !== config.APPLE_CLIENT_ID
    || !payload.exp
    || payload.exp < now
    || !payload.sub
    || !payload.email
    || !emailVerified
  ) {
    throw new ApiError(401, 'Apple account could not be verified.')
  }

  return {
    email: payload.email,
    emailVerified,
    name: payload.email,
    subject: payload.sub,
  }
}
