export type SignaturePayload = {
  type: string
  signerName: string
  data: string
}

export function mergeSignature(
  existing: SignaturePayload[] | undefined,
  signature: SignaturePayload,
): SignaturePayload[] {
  const list = (existing ?? []).filter((item) => item.type !== signature.type)
  if (signature.data) list.push(signature)
  return list
}

export function buildSignaturesFromDetails(
  details: Record<string, unknown>,
  clientName: string,
): SignaturePayload[] {
  const signatures: SignaturePayload[] = []
  if (details.professionalSignature) {
    signatures.push({
      type: 'professional_signature',
      signerName: String(details.professionalSignerName ?? 'Provider'),
      data: String(details.professionalSignature),
    })
  }
  if (details.clientSignature) {
    signatures.push({
      type: 'client_signature',
      signerName: clientName,
      data: String(details.clientSignature),
    })
  }
  if (details.clientDesignSignature) {
    signatures.push({
      type: 'design_approval',
      signerName: clientName,
      data: String(details.clientDesignSignature),
    })
  }
  if (details.photoConsent && details.photoConsentSignature) {
    signatures.push({
      type: 'photography_consent',
      signerName: clientName,
      data: String(details.photoConsentSignature),
    })
  }
  return signatures
}

export function buildConsentsFromDetails(
  details: Record<string, unknown>,
  categoryCode: string,
): Array<{ type: string; version: number; accepted: boolean; text: string }> {
  const consents = Array.isArray(details.consents) ? [...details.consents] : []
  if (details.photoConsent) {
    consents.push({
      type: `${categoryCode}_photography_consent`,
      version: 1,
      accepted: true,
      text: 'Client authorizes photo storage for this appointment.',
    })
  }
  return consents.filter(
    (item): item is { type: string; version: number; accepted: boolean; text: string } =>
      Boolean(item && typeof item === 'object' && (item as { accepted?: boolean }).accepted === true),
  )
}
