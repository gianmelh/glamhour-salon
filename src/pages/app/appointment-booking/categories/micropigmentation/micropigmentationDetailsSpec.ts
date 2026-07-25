export const micropigmentationProcedureGroups = {
  Eyebrows: ['Microblading', 'Microshading', 'Hybrid', 'Removal'],
  Lips: ['Lip Liner', 'Micropigmentation', 'Hydragloss'],
  Eyes: ['Eyeliner'],
} as const

export const micropigmentationUndertones = ['Warm', 'Cool', 'Neutral'] as const

export const micropigmentationSessionTypes = ['Initial session', 'Touch-up'] as const

export function getMicropigmentationDetailsMissingItems(details: Record<string, unknown>) {
  const missing: string[] = []
  if (!details.area || !details.procedure) missing.push('Procedure area and type')
  if (!details.undertone) missing.push('Skin undertone')
  if (!details.session_type) missing.push('Session type')
  if (!details.pigment_brand) missing.push('Pigment brand')
  if (!details.needle) missing.push('Needle')
  return missing
}
