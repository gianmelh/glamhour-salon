import type { BookingCategoryCode } from './types'

export type YesNoAnswer = 'yes' | 'no' | ''

export type HealthQuestionnaireSection = {
  id: string
  title: string
  questions: Array<{ id: string; label: string }>
}

export type HealthQuestionnaireDefinition = {
  serviceLabel: string
  sections: HealthQuestionnaireSection[]
  consentItems: Array<{ id: string; label: string }>
  showPhototype?: boolean
}

const sharedConsentItems = [
  { id: 'explained', label: 'The procedure has been clearly explained to me.' },
  { id: 'adverse_reactions', label: 'I understand that adverse reactions may occur.' },
  { id: 'truthful', label: 'I confirm having answered the questionnaire truthfully.' },
  { id: 'habits_results', label: 'Results depend on my own habits and conditions.' },
  { id: 'aftercare', label: 'I commit to following post-procedure care instructions.' },
  { id: 'photography', label: 'I authorize photographs of the procedure ONLY if I decide to consent.' },
  { id: 'liability', label: 'I release the professional from liability if I concealed relevant information.' },
]

export const healthQuestionnaires: Record<BookingCategoryCode, HealthQuestionnaireDefinition> = {
  nails: {
    serviceLabel: 'Nail Technician Service',
    sections: [
      {
        id: 'medical_history',
        title: 'Medical History',
        questions: [
          { id: 'chemical_allergies', label: 'Do you have allergies to chemicals, polishes, gels, acrylics, or removers?' },
          { id: 'previous_reactions', label: 'Have you experienced allergic reactions during previous services?' },
          { id: 'skin_conditions', label: 'Do you suffer from dermatitis, psoriasis, eczema, or other skin conditions?' },
          { id: 'nail_infections', label: 'Do you have active nail infections, fungal infections, or inflammation?' },
          { id: 'extreme_sensitivity', label: 'Do you have extreme sensitivity in your skin or nails?' },
          { id: 'autoimmune', label: 'Do you have any autoimmune diseases?' },
          { id: 'coagulation_meds', label: 'Are you taking medications that affect coagulation or sensitivity?' },
          { id: 'diabetic', label: 'Are you diabetic?' },
          { id: 'latex_allergy', label: 'Do you have latex or nitrile allergies?' },
          { id: 'pregnant', label: 'Are you pregnant?' },
        ],
      },
      {
        id: 'habits_lifestyle',
        title: 'Habits & Lifestyle',
        questions: [
          { id: 'nail_biting', label: 'Do you bite your nails?' },
          { id: 'chemical_work', label: 'Do you work with chemical products?' },
          { id: 'recent_services', label: 'Have you had services performed within the last 30 days?' },
          { id: 'home_removers', label: 'Do you use at-home removers?' },
        ],
      },
    ],
    consentItems: sharedConsentItems,
  },
  lashes: {
    serviceLabel: 'Lash Technician Service',
    sections: [
      {
        id: 'medical_history',
        title: 'Medical History',
        questions: [
          { id: 'adhesive_allergies', label: 'Do you have allergies to adhesives, cyanoacrylate, dyes, or synthetic fibers?' },
          { id: 'previous_reactions', label: 'Have you experienced allergies during previous services?' },
          { id: 'ocular_problems', label: 'Do you have current ocular problems?' },
          { id: 'ocular_surgery', label: 'Have you had recent ocular surgeries?' },
          { id: 'contact_lenses', label: 'Do you wear contact lenses?' },
          { id: 'ocular_medications', label: 'Are you taking medications that affect ocular sensitivity?' },
          { id: 'fume_sensitivity', label: 'Do you have sensitivity to fumes or vapors?' },
          { id: 'ocular_irritation', label: 'Do you have current ocular irritation?' },
          { id: 'diabetes_healing', label: 'Do you have diabetes or wound healing issues?' },
          { id: 'pregnant', label: 'Are you pregnant?' },
        ],
      },
      {
        id: 'habits_lifestyle',
        title: 'Habits & Lifestyle',
        questions: [
          { id: 'sleep_prone', label: 'Do you sleep face down or prone?' },
          { id: 'oil_products', label: 'Do you use oil-based products?' },
          { id: 'eye_rubbing', label: 'Do you rub your eyes frequently?' },
        ],
      },
    ],
    consentItems: [
      { id: 'informed', label: 'I have been informed about the eyelash extension procedure and aftercare.' },
      { id: 'risks', label: 'I understand the risks: irritation, erythema, lacrimation, and allergic reaction.' },
      { id: 'truthful', label: 'I confirm having answered the health questionnaire truthfully.' },
      { id: 'no_infection', label: 'I do not have active ocular infections.' },
      { id: 'habits_results', label: 'I understand that my habits may affect the results and retention.' },
      { id: 'liability', label: 'I release the professional from liability if I concealed relevant information.' },
    ],
  },
  cosmetology: {
    serviceLabel: 'Cosmetology Service',
    showPhototype: true,
    sections: [
      {
        id: 'medical_history',
        title: 'Medical History',
        questions: [
          { id: 'endocrine', label: 'Do you have an endocrine condition?' },
          { id: 'cardiovascular', label: 'Do you have a cardiovascular condition?' },
          { id: 'systemic_neurological', label: 'Do you have a systemic or neurological condition?' },
          { id: 'oncology', label: 'Do you have an oncology history?' },
          { id: 'facial_procedures', label: 'Do you have facial fractures, implants, or recent procedures?' },
          { id: 'pregnancy_breastfeeding', label: 'Are you pregnant or breastfeeding?' },
          { id: 'allergies_reactions', label: 'Do you have allergies or previous reactions to skincare products?' },
          { id: 'medications', label: 'Are you taking current medications?' },
          { id: 'smoking_alcohol', label: 'Do you smoke or consume alcohol regularly?' },
          { id: 'skin_concerns', label: 'Do you have pigmentation, acne, scars, sensitivity, hives, or blisters?' },
        ],
      },
      {
        id: 'clinical_observations',
        title: 'Clinical Observations',
        questions: [
          { id: 'recent_peel', label: 'Have you had a chemical peel or laser treatment in the last 30 days?' },
          { id: 'sun_exposure', label: 'Have you had recent unprotected sun exposure?' },
          { id: 'retinoids', label: 'Are you currently using retinoids or acids?' },
          { id: 'facial_hair_removal', label: 'Have you had facial hair removal in the last 7 days?' },
        ],
      },
    ],
    consentItems: sharedConsentItems,
  },
  micropigmentation: {
    serviceLabel: 'Micropigmentation Service',
    showPhototype: true,
    sections: [
      {
        id: 'medical_history',
        title: 'Medical History',
        questions: [
          { id: 'first_time', label: 'Is this your first micropigmentation service?' },
          { id: 'endocrine_cardiovascular', label: 'Do you have endocrine or cardiovascular history?' },
          { id: 'systemic_neurological', label: 'Do you have a systemic or neurological condition?' },
          { id: 'pregnancy_breastfeeding', label: 'Are you pregnant or breastfeeding?' },
          { id: 'implants', label: 'Do you have implants in the treatment area?' },
          { id: 'allergies_reactions', label: 'Do you have allergies or previous reactions?' },
          { id: 'medications', label: 'Are you taking current medications?' },
          { id: 'smoking_alcohol', label: 'Do you smoke or consume alcohol regularly?' },
          { id: 'herpes', label: 'Do you have Herpes Simplex?' },
          { id: 'previous_removal', label: 'Have you had previous removal treatments?' },
        ],
      },
      {
        id: 'procedure_specific',
        title: 'Procedure Specific',
        questions: [
          { id: 'keloid_history', label: 'Do you have keloid or hypertrophic scarring history?' },
          { id: 'blood_thinners', label: 'Are you taking blood thinners?' },
          { id: 'recent_tattoo', label: 'Have you had a tattoo or PMU in the same area within 6 weeks?' },
        ],
      },
    ],
    consentItems: [
      ...sharedConsentItems,
      { id: 'design_approval', label: 'I approve the design sketch and pigment selection for this procedure.' },
    ],
  },
}

export function allQuestionIds(definition: HealthQuestionnaireDefinition) {
  return definition.sections.flatMap((section) => section.questions.map((question) => question.id))
}

export function getHealthQuestionnaireMissingItems(
  categoryCode: BookingCategoryCode,
  details: Record<string, unknown>,
) {
  const definition = healthQuestionnaires[categoryCode]
  const answers = (details.healthAnswers as Record<string, YesNoAnswer> | undefined) ?? {}
  const consents = (details.consentItems as Record<string, boolean> | undefined) ?? {}
  const missing: string[] = []

  const unanswered = allQuestionIds(definition).filter((id) => answers[id] !== 'yes' && answers[id] !== 'no')
  if (unanswered.length) {
    missing.push(`${unanswered.length} health question${unanswered.length === 1 ? '' : 's'} still need a Yes or No answer`)
  }

  const uncheckedConsent = definition.consentItems.filter((item) => !consents[item.id])
  if (uncheckedConsent.length) {
    missing.push(`${uncheckedConsent.length} consent item${uncheckedConsent.length === 1 ? '' : 's'} must be checked`)
  }

  if (!details.professionalSignature) {
    missing.push('Professional signature is required — draw in the box above')
  }
  if (!details.clientSignature) {
    missing.push('Client signature is required — draw in the box above')
  }

  if (definition.showPhototype && !details.phototype) {
    missing.push('Select a Fitzpatrick phototype')
  }

  return missing
}

export function isHealthQuestionnaireComplete(
  categoryCode: BookingCategoryCode,
  details: Record<string, unknown>,
) {
  return getHealthQuestionnaireMissingItems(categoryCode, details).length === 0
}
