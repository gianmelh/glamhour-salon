import { Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../../lib/api'
import { glamhourApi } from '../../services/glamhour-api'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const hasCredentials = Boolean(email.trim() && password)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = !email.trim()
      ? 'Email is required'
      : /^\S+@\S+\.\S+$/.test(email.trim())
        ? ''
        : 'Enter a valid email address.'
    const nextPasswordError = password ? '' : 'Password is required'
    setEmailError(nextEmailError)
    setPasswordError(nextPasswordError)
    setLoginError('')

    if (nextEmailError || nextPasswordError) {
      return
    }

    setIsSubmitting(true)
    try {
      const session = await glamhourApi.login({
        email: email.trim(),
        password,
      })
      const salon = session.salons[0]

      if (salon) {
        window.sessionStorage.setItem('glamhour:active-salon-id', salon.id)
      }

      navigate('/app/home', { state: { salonId: salon?.id, userId: session.user.id } })
    } catch (error) {
      setLoginError(
        error instanceof ApiClientError
          ? error.message
          : 'Login failed. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#fffafc_0%,#f8f0ff_43%,#a77aff_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[320px] items-center">
        <div className="w-full rounded-xl bg-[#f7f8ff] px-5 py-8 shadow-[0_18px_42px_rgb(68_43_132_/_0.25)] ring-1 ring-white/75">
          <header className="text-center">
            <h1 className="text-[24px] font-semibold leading-tight text-[#12192d]">Log in to your salon</h1>
            <p className="mx-auto mt-1 max-w-[250px] text-[14px] leading-5 text-[#7c8394]">
              Enter your salon details and email to access your account
            </p>
          </header>

          <form className="mt-7 space-y-4" noValidate onSubmit={handleSubmit}>
            <LoginField
              autoComplete="email"
              error={emailError}
              label="Email"
              onChange={(value) => {
                setEmail(value)
                setEmailError('')
                setLoginError('')
              }}
              placeholder="name@example.com"
              type="email"
              value={email}
            />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[14px] font-medium text-[#242a39]">Password</span>
                <Link className="text-[12px] font-semibold text-[#7c8394] hover:text-[#7a3fe0]" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <LoginField
                autoComplete="current-password"
                error={passwordError}
                hideLabel
                label="Password"
                onChange={(value) => {
                  setPassword(value)
                  setPasswordError('')
                  setLoginError('')
                }}
                placeholder="Enter your password"
                trailingIcon={(
                  <button
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="grid size-8 place-items-center text-[#6f7788] transition hover:text-[#242a39]"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="size-6 stroke-[2.4]" /> : <Eye className="size-6 stroke-[2.4]" />}
                  </button>
                )}
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
            </div>

            {loginError && <p className="rounded-md bg-[#fff0f0] px-3 py-2 text-[11px] text-[#e05252]">{loginError}</p>}

            <button
              className={[
                'min-h-12 w-full rounded-lg text-[14px] font-medium transition',
                hasCredentials
                  ? 'bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] hover:brightness-105'
                  : 'bg-[#d9d9d9] text-[#676767] shadow-[0_10px_18px_rgb(68_68_68_/_0.18)]',
              ].join(' ')}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="mt-5">
            <div className="flex items-center gap-3 text-[10px] font-medium text-[#7c8394]">
              <span className="h-px flex-1 bg-[#e6e8f1]" />
              <span>OR CONTINUE WITH</span>
              <span className="h-px flex-1 bg-[#e6e8f1]" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <SocialButton icon={<FacebookIcon />} label="Facebook" />
              <SocialButton icon={<GoogleIcon />} label="Google" />
              <SocialButton icon={<AppleIcon />} label="Apple" />
            </div>
          </div>

          <p className="mt-5 text-center text-[12px] text-[#7c8394]">
            Don&apos;t have an account?
            <Link className="font-semibold text-[#7a3fe0]" to="/signup">
              {' '}Sign up
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function LoginField({
  autoComplete,
  error,
  hideLabel = false,
  label,
  onChange,
  placeholder,
  trailingIcon,
  type,
  value,
}: {
  autoComplete: string
  error?: string
  hideLabel?: boolean
  label: string
  onChange: (value: string) => void
  placeholder: string
  trailingIcon?: ReactNode
  type: string
  value: string
}) {
  return (
    <label className="block text-[14px] font-medium text-[#242a39]">
      {!hideLabel && label}
      <span className={['relative block', hideLabel ? 'mt-0' : 'mt-1'].join(' ')}>
        <input
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={[
            'h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-[#1b2133] outline-none transition placeholder:text-[#8f98aa]',
            trailingIcon ? 'pr-11' : '',
            error
              ? 'border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10'
              : 'border-[#d3d8e4] focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10',
          ].join(' ')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailingIcon && <span className="absolute right-4 top-1/2 -translate-y-1/2">{trailingIcon}</span>}
      </span>
      {error && <span className="mt-1 block text-[11px] font-normal text-[#ff3b4f]">{error}</span>}
    </label>
  )
}

function SocialButton({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <button
      aria-label={`Continue with ${label}`}
      className="flex h-10 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-[#eef0f6] transition hover:-translate-y-0.5"
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
