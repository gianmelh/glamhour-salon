import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { readSignUpDraft, saveSignUpDraft, type SignUpForm } from './signUpDraft'

type SignUpErrors = Partial<Record<keyof Omit<SignUpForm, 'acceptedTerms'> | 'acceptedTerms', string>>
type GoogleCredentialResponse = { credential?: string }

type GoogleAccountsWindow = Window & {
  google?: {
    accounts: {
      id: {
        initialize: (options: {
          client_id: string
          callback: (response: GoogleCredentialResponse) => void
          ux_mode?: 'popup' | 'redirect'
        }) => void
        prompt: () => void
      }
    }
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()
let googleIdentityScriptPromise: Promise<void> | undefined

function validateSignUp(form: SignUpForm) {
  const errors: SignUpErrors = {}

  if (!form.salonName.trim()) {
    errors.salonName = 'Salon name is required'
  }

  if (form.authProvider === 'email' && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
    errors.email = 'Please enter a valid email address'
  }

  if (form.authProvider === 'email' && form.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  }

  if (form.authProvider === 'email' && form.confirmPassword.length < 6) {
    errors.confirmPassword = 'Password must be at least 6 characters'
  } else if (form.authProvider === 'email' && form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }

  if (!form.acceptedTerms) {
    errors.acceptedTerms = 'Please agree to the terms and conditions'
  }

  return errors
}

function loadGoogleIdentityScript() {
  const googleWindow = window as GoogleAccountsWindow
  if (googleWindow.google?.accounts.id) {
    return Promise.resolve()
  }

  googleIdentityScriptPromise ??= new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Google Identity Services could not load.')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.addEventListener('load', () => resolve(), { once: true })
    script.addEventListener('error', () => reject(new Error('Google Identity Services could not load.')), { once: true })
    document.head.appendChild(script)
  })

  return googleIdentityScriptPromise
}

function parseGoogleCredential(credential: string) {
  try {
    const payload = credential.split('.')[1]
    if (!payload) {
      return {}
    }

    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/')
    const decodedPayload = atob(normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '='))
    return JSON.parse(decodedPayload) as { email?: string; name?: string }
  } catch {
    return {}
  }
}

export function SignUpPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState<SignUpForm>(() => readSignUpDraft())
  const [submitted, setSubmitted] = useState(false)
  const [socialError, setSocialError] = useState('')
  const formRef = useRef(form)

  const errors = useMemo(() => (submitted ? validateSignUp(form) : {}), [form, submitted])
  const hasStarted = Boolean(
    form.salonName || form.email || form.password || form.confirmPassword || form.acceptedTerms,
  )

  function updateField<Field extends keyof SignUpForm>(field: Field, value: SignUpForm[Field]) {
    setForm((current) => {
      const nextForm = { ...current, authProvider: 'email' as const, googleCredential: '', ownerFullName: '', [field]: value }
      saveSignUpDraft(nextForm)
      formRef.current = nextForm
      return nextForm
    })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitted(true)

    const nextErrors = validateSignUp(form)
    if (Object.keys(nextErrors).length === 0) {
      navigate('/register', { state: { salonName: form.salonName.trim(), email: form.email.trim() } })
    }
  }

  async function handleGoogleSignUp() {
    setSocialError('')

    if (!googleClientId) {
      setSocialError('Google sign up is not configured yet.')
      return
    }

    try {
      await loadGoogleIdentityScript()
      const googleWindow = window as GoogleAccountsWindow
      googleWindow.google?.accounts.id.initialize({
        client_id: googleClientId,
        ux_mode: 'popup',
        callback: (response) => {
          if (!response.credential) {
            setSocialError('Google did not return a sign up credential.')
            return
          }

          const googleProfile = parseGoogleCredential(response.credential)
          const nextForm: SignUpForm = {
            ...formRef.current,
            email: googleProfile.email ?? formRef.current.email,
            password: '',
            confirmPassword: '',
            authProvider: 'google',
            googleCredential: response.credential,
            ownerFullName: googleProfile.name ?? '',
          }

          saveSignUpDraft(nextForm)
          formRef.current = nextForm
          setForm(nextForm)
          navigate('/register', {
            state: { salonName: nextForm.salonName.trim(), email: nextForm.email.trim(), authProvider: 'google' },
          })
        },
      })
      googleWindow.google?.accounts.id.prompt()
    } catch {
      setSocialError('Google sign up could not be started. Please try again.')
    }
  }

  function handleUnsupportedSocialSignUp(provider: 'Facebook' | 'Apple') {
    setSocialError(`${provider} sign up is not configured yet.`)
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#fffafc_0%,#f8f0ff_43%,#a77aff_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[320px] items-center">
        <div className="w-full rounded-xl bg-[#f7f8ff] px-5 py-6 shadow-[0_18px_42px_rgb(68_43_132_/_0.25)] ring-1 ring-white/75">
          <header className="text-center">
            <h1 className="text-[24px] font-semibold leading-tight text-[#12192d]">Create an account</h1>
            <p className="mt-1 text-[11px] text-[#7c8394]">Enter your details to get started</p>
          </header>

          <form className="mt-7 space-y-3" noValidate onSubmit={handleSubmit}>
            <SignUpField
              error={errors.salonName}
              label="Salon name"
              onChange={(value) => updateField('salonName', value)}
              placeholder="e.g. Beauty salon"
              value={form.salonName}
            />
            <SignUpField
              error={errors.email}
              label="Email"
              onChange={(value) => updateField('email', value)}
              placeholder="name@example.com"
              type="email"
              value={form.email}
            />
            <SignUpField
              error={errors.password}
              label="Password"
              onChange={(value) => updateField('password', value)}
              placeholder="Enter your password"
              type="password"
              value={form.password}
            />
            <SignUpField
              error={errors.confirmPassword}
              label="Confirm password"
              onChange={(value) => updateField('confirmPassword', value)}
              placeholder="Enter your password"
              type="password"
              value={form.confirmPassword}
            />

            <label className="flex items-start gap-2 pt-1 text-[11px] leading-4 text-[#6f7788]">
              <input
                checked={form.acceptedTerms}
                className="mt-0.5 size-3.5 rounded border-[#d8dceb] accent-[#7a3fe0]"
                onChange={(event) => updateField('acceptedTerms', event.target.checked)}
                type="checkbox"
              />
              <span>
                I have already read the{' '}
                <Link className="font-medium text-[#7a3fe0]" to="/terms">
                  terms and conditions
                </Link>{' '}
                and{' '}
                <Link className="font-medium text-[#7a3fe0]" to="/privacy">
                  privacy policy
                </Link>
              </span>
            </label>
            {errors.acceptedTerms && <p className="-mt-1 text-[11px] text-[#ff3b4f]">{errors.acceptedTerms}</p>}

            <button
              className="mt-4 min-h-12 w-full rounded-lg bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-[13px] font-medium text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] transition hover:brightness-105 disabled:bg-none disabled:bg-[#d9d9d9] disabled:text-[#676767] disabled:shadow-none"
              disabled={!hasStarted}
              type="submit"
            >
              {hasStarted ? 'Submit' : 'Continue'}
            </button>
          </form>

          <div className="mt-5">
            <div className="flex items-center gap-3 text-[10px] font-medium text-[#9aa1b1]">
              <span className="h-px flex-1 bg-[#e6e8f1]" />
              <span>OR SIGN UP WITH</span>
              <span className="h-px flex-1 bg-[#e6e8f1]" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <SocialButton icon={<FacebookIcon />} label="Facebook" onClick={() => handleUnsupportedSocialSignUp('Facebook')} />
              <SocialButton icon={<GoogleIcon />} label="Google" onClick={handleGoogleSignUp} />
              <SocialButton icon={<AppleIcon />} label="Apple" onClick={() => handleUnsupportedSocialSignUp('Apple')} />
            </div>
            {socialError && <p className="mt-2 text-center text-[11px] text-[#ff3b4f]">{socialError}</p>}
          </div>

          <p className="mt-5 text-center text-[11px] text-[#8b92a1]">
            Already have an account?
            <Link className="font-medium text-[#7a3fe0]" to="/login">
              Log in
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function SignUpField({
  error,
  label,
  onChange,
  placeholder,
  type = 'text',
  value,
}: {
  error?: string
  label: string
  onChange: (value: string) => void
  placeholder: string
  type?: string
  value: string
}) {
  return (
    <label className="block text-[11px] font-medium text-[#242a39]">
      {label}
      <input
        aria-invalid={Boolean(error)}
        className={[
          'mt-1 h-11 w-full rounded-lg border bg-white px-3 text-[12px] text-[#1b2133] outline-none transition placeholder:text-[#a5acbb]',
          error
            ? 'border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10'
            : 'border-[#c9ceda] focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10',
        ].join(' ')}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        value={value}
      />
      {error && <span className="mt-1 block text-[11px] font-normal text-[#ff3b4f]">{error}</span>}
    </label>
  )
}

function SocialButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick?: () => void }) {
  return (
    <button
      aria-label={`Continue with ${label}`}
      className="flex h-9 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-[#eef0f6] transition hover:-translate-y-0.5"
      onClick={onClick}
      type="button"
    >
      {icon}
    </button>
  )
}

function FacebookIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path
        d="M15.12 8.25h2.38V4.41A30.1 30.1 0 0 0 14.03 4c-3.44 0-5.8 2.04-5.8 5.76v3.21H4.5v4.3h3.73V24h4.52v-6.73h3.74l.6-4.3h-4.34V10.2c0-1.25.34-1.95 2.37-1.95Z"
        fill="#1877F2"
      />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path d="M21.6 12.23c0-.78-.07-1.53-.2-2.23H12v4.22h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.52Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.96-.9 6.62-2.25l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.76-5.59-4.12H3.07v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.41 14.08A6 6 0 0 1 6.1 12c0-.72.12-1.42.31-2.08v-2.6H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.68l3.34-2.6Z" fill="#FBBC05" />
      <path d="M12 5.8c1.47 0 2.78.5 3.82 1.5l2.87-2.87C16.95 2.8 14.7 2 12 2a10 10 0 0 0-8.93 5.32l3.34 2.6C7.2 7.56 9.4 5.8 12 5.8Z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" className="size-5" viewBox="0 0 24 24">
      <path
        d="M17.05 12.62c-.02-2.24 1.84-3.32 1.92-3.37-1.05-1.54-2.67-1.75-3.24-1.78-1.38-.14-2.7.81-3.4.81-.7 0-1.78-.79-2.93-.77-1.5.02-2.89.87-3.66 2.22-1.56 2.7-.4 6.7 1.12 8.89.74 1.07 1.63 2.28 2.8 2.24 1.12-.04 1.54-.72 2.9-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.09 2.7-2.17.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.32-.9-2.34-3.55ZM14.82 6.02c.62-.75 1.03-1.8.92-2.84-.9.04-1.98.6-2.62 1.34-.58.66-1.08 1.72-.95 2.73 1 .08 2.03-.51 2.65-1.23Z"
        fill="#111827"
      />
    </svg>
  )
}
