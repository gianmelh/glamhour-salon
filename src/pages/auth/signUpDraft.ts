export type SignUpForm = {
  salonName: string
  email: string
  password: string
  confirmPassword: string
  acceptedTerms: boolean
  authProvider: 'email' | 'google' | 'facebook' | 'apple'
  socialCredential: string
  ownerFullName: string
}

export const initialSignUpForm: SignUpForm = {
  salonName: '',
  email: '',
  password: '',
  confirmPassword: '',
  acceptedTerms: false,
  authProvider: 'email',
  socialCredential: '',
  ownerFullName: '',
}

const signUpDraftKey = 'glamhour:sign-up-draft'

function isBrowser() {
  return typeof window !== 'undefined'
}

export function readSignUpDraft(): SignUpForm {
  if (!isBrowser()) {
    return initialSignUpForm
  }

  const rawDraft = window.sessionStorage.getItem(signUpDraftKey)
  if (!rawDraft) {
    return initialSignUpForm
  }

  try {
    const draft = JSON.parse(rawDraft) as Partial<SignUpForm>

    return {
      salonName: typeof draft.salonName === 'string' ? draft.salonName : '',
      email: typeof draft.email === 'string' ? draft.email : '',
      password: typeof draft.password === 'string' ? draft.password : '',
      confirmPassword: typeof draft.confirmPassword === 'string' ? draft.confirmPassword : '',
      acceptedTerms: draft.acceptedTerms === true,
      authProvider: draft.authProvider === 'google' || draft.authProvider === 'facebook' || draft.authProvider === 'apple'
        ? draft.authProvider
        : 'email',
      socialCredential: typeof draft.socialCredential === 'string'
        ? draft.socialCredential
        : typeof (draft as { googleCredential?: unknown }).googleCredential === 'string'
          ? (draft as { googleCredential: string }).googleCredential
          : '',
      ownerFullName: typeof draft.ownerFullName === 'string' ? draft.ownerFullName : '',
    }
  } catch {
    return initialSignUpForm
  }
}

export function saveSignUpDraft(form: SignUpForm) {
  if (isBrowser()) {
    window.sessionStorage.setItem(signUpDraftKey, JSON.stringify(form))
  }
}

export function clearSignUpDraft() {
  if (isBrowser()) {
    window.sessionStorage.removeItem(signUpDraftKey)
  }
}

export function acceptSignUpTerms() {
  saveSignUpDraft({ ...readSignUpDraft(), acceptedTerms: true })
}
