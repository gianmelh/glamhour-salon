import type { Client } from '../../../types/api'
import { buildLashesTreatmentPayload } from '../lashes-booking/buildLashesTreatmentPayload'
import { sanitizeDetailsForCategory } from './categoryDetails'
import { buildConsentsFromDetails, buildSignaturesFromDetails } from './components/signatureHelpers'

export function buildTreatmentPayload(
  categoryCode: string,
  details: Record<string, unknown>,
  client: Client,
) {
  const signatures = buildSignaturesFromDetails(details, client.full_name)
  const consents = buildConsentsFromDetails(details, categoryCode)
  const extras = {
    signatures,
    consents: consents.length ? consents : details.consents,
    consentAccepted: details.consentAccepted ?? consents.length > 0,
  }

  const sanitized = sanitizeDetailsForCategory(categoryCode, details)

  if (categoryCode === 'lashes') {
    return buildLashesTreatmentPayload(sanitized, extras)
  }

  return {
    category: categoryCode,
    ...sanitized,
    ...extras,
  }
}
