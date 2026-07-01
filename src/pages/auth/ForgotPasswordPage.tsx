import { Check, ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiClientError } from '../../lib/api'
import { glamhourApi } from '../../services/glamhour-api'

type ResetStep = 'email' | 'code' | 'password' | 'success'

export function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<ResetStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [emailError, setEmailError] = useState('')
  const [codeError, setCodeError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [confirmPasswordError, setConfirmPasswordError] = useState('')
  const [formError, setFormError] = useState('')
  const [devCode, setDevCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = !email.trim()
      ? 'Email is required'
      : /^\S+@\S+\.\S+$/.test(email.trim())
        ? ''
        : 'Enter a valid email address.'

    setEmailError(nextEmailError)
    setFormError('')
    setDevCode('')

    if (nextEmailError) return

    setIsSubmitting(true)
    try {
      const result = await glamhourApi.requestPasswordReset({ email: email.trim() })
      setEmail(result.email)
      setDevCode(result.devCode ?? '')
      setStep('code')
    } catch (error) {
      setFormError(errorMessage(error, 'Verification code could not be sent. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedCode = code.trim()
    const nextCodeError = !normalizedCode
      ? 'Verification code is required'
      : /^\d{6}$/.test(normalizedCode)
        ? ''
        : 'Code must be 6 digits'

    setCodeError(nextCodeError)
    setFormError('')

    if (nextCodeError) return

    setIsSubmitting(true)
    try {
      await glamhourApi.verifyPasswordResetCode({ email: email.trim(), code: normalizedCode })
      setCode(normalizedCode)
      setStep('password')
    } catch (error) {
      setFormError(errorMessage(error, 'Verification code could not be validated. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextPasswordError = !password
      ? 'Password is required'
      : password.length >= 6
        ? ''
        : 'Password must be at least 6 characters'
    const nextConfirmPasswordError = !confirmPassword
      ? 'Confirm password is required'
      : confirmPassword === password
        ? ''
        : 'Passwords do not match'

    setPasswordError(nextPasswordError)
    setConfirmPasswordError(nextConfirmPasswordError)
    setFormError('')

    if (nextPasswordError || nextConfirmPasswordError) return

    setIsSubmitting(true)
    try {
      await glamhourApi.confirmPasswordReset({
        email: email.trim(),
        code: code.trim(),
        password,
      })
      setStep('success')
    } catch (error) {
      setFormError(errorMessage(error, 'Password could not be updated. Please request a new code.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-dvh bg-[linear-gradient(180deg,#fffafc_0%,#f8f0ff_43%,#a77aff_100%)] px-4 py-10">
      <section className="mx-auto flex min-h-[calc(100dvh-80px)] w-full max-w-[340px] flex-col justify-center">
        <button
          className="mb-7 flex w-fit items-center gap-1 text-[15px] font-medium text-[#12192d] transition hover:text-[#7a3fe0]"
          onClick={() => navigate('/login')}
          type="button"
        >
          <ChevronLeft className="size-10 stroke-[1.9]" />
          Back
        </button>

        {step === 'success' ? (
          <SuccessCard onLogin={() => navigate('/login')} />
        ) : (
          <div className="w-full rounded-xl bg-[#f7f8ff] px-5 py-8 shadow-[0_18px_42px_rgb(68_43_132_/_0.25)] ring-1 ring-white/75">
            {step === 'email' && (
              <>
                <ResetHeader
                  description="Enter your salon details and email to access your account"
                  title="Reset password"
                />
                <form className="mt-7 space-y-5" noValidate onSubmit={handleEmailSubmit}>
                  <ResetField
                    autoComplete="email"
                    error={emailError}
                    label="Email"
                    onChange={(value) => {
                      setEmail(value)
                      setEmailError('')
                      setFormError('')
                    }}
                    placeholder="name@example.com"
                    type="email"
                    value={email}
                  />
                  <SubmitButton disabled={!email.trim()} isSubmitting={isSubmitting} label="Send verification code" loadingLabel="Sending..." />
                  <FormError message={formError} />
                </form>
              </>
            )}

            {step === 'code' && (
              <>
                <ResetHeader
                  description="We sent a code to the email"
                  detail={email}
                  title="Enter verification code"
                />
                <form className="mt-7 space-y-5" noValidate onSubmit={handleCodeSubmit}>
                  <ResetField
                    autoComplete="one-time-code"
                    error={codeError}
                    inputMode="numeric"
                    label="Code"
                    maxLength={6}
                    onChange={(value) => {
                      setCode(value.replace(/\D/g, '').slice(0, 6))
                      setCodeError('')
                      setFormError('')
                    }}
                    placeholder="000000"
                    type="text"
                    value={code}
                  />
                  {devCode && (
                    <p className="rounded-md bg-[#f1eaff] px-3 py-2 text-center text-[11px] font-medium text-[#6530bd]">
                      Development code: {devCode}
                    </p>
                  )}
                  <SubmitButton disabled={code.trim().length !== 6} isSubmitting={isSubmitting} label="Verify code" loadingLabel="Verifying..." />
                  <button
                    className="mx-auto block text-center text-[12px] leading-5 text-[#7c8394]"
                    disabled={isSubmitting}
                    onClick={() => {
                      setStep('email')
                      setCode('')
                      setCodeError('')
                      setFormError('')
                    }}
                    type="button"
                  >
                    <span>Wrong email?</span>
                    <span className="block font-semibold text-[#7a3fe0]">Change it</span>
                  </button>
                  <FormError message={formError} />
                </form>
              </>
            )}

            {step === 'password' && (
              <>
                <ResetHeader
                  description="Create a new password for your salon account"
                  title="New password"
                />
                <form className="mt-7 space-y-4" noValidate onSubmit={handlePasswordSubmit}>
                  <ResetField
                    autoComplete="new-password"
                    error={passwordError}
                    label="Password"
                    onChange={(value) => {
                      setPassword(value)
                      setPasswordError('')
                      setFormError('')
                    }}
                    placeholder="Enter your password"
                    trailingIcon={(
                      <EyeButton
                        isVisible={showPassword}
                        onClick={() => setShowPassword((value) => !value)}
                      />
                    )}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                  />
                  <ResetField
                    autoComplete="new-password"
                    error={confirmPasswordError}
                    label="Confirm password"
                    onChange={(value) => {
                      setConfirmPassword(value)
                      setConfirmPasswordError('')
                      setFormError('')
                    }}
                    placeholder="Confirm your password"
                    trailingIcon={(
                      <EyeButton
                        isVisible={showConfirmPassword}
                        onClick={() => setShowConfirmPassword((value) => !value)}
                      />
                    )}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                  />
                  <SubmitButton
                    disabled={!password || !confirmPassword}
                    isSubmitting={isSubmitting}
                    label="Reset password"
                    loadingLabel="Updating..."
                  />
                  <FormError message={formError} />
                </form>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  )
}

function ResetHeader({ description, detail, title }: { description: string; detail?: string; title: string }) {
  return (
    <header className="text-center">
      <h1 className="text-[26px] font-semibold leading-tight text-[#12192d]">{title}</h1>
      <p className="mx-auto mt-2 max-w-[280px] text-[14px] leading-5 text-[#7c8394]">
        {description}
      </p>
      {detail && (
        <p className="mx-auto mt-1 max-w-[280px] break-words text-[14px] font-medium leading-5 text-[#12192d]">
          {detail}
        </p>
      )}
    </header>
  )
}

function ResetField({
  autoComplete,
  error,
  inputMode,
  label,
  maxLength,
  onChange,
  placeholder,
  trailingIcon,
  type,
  value,
}: {
  autoComplete: string
  error?: string
  inputMode?: 'numeric'
  label: string
  maxLength?: number
  onChange: (value: string) => void
  placeholder: string
  trailingIcon?: ReactNode
  type: string
  value: string
}) {
  return (
    <label className="block text-[14px] font-medium text-[#242a39]">
      {label}
      <span className="relative mt-1 block">
        <input
          aria-invalid={Boolean(error)}
          autoComplete={autoComplete}
          className={[
            'h-11 w-full rounded-lg border bg-white px-3 text-[13px] text-[#1b2133] outline-none transition placeholder:text-[#8f98aa]',
            trailingIcon ? 'pr-12' : '',
            error
              ? 'border-[#ff5964] focus:border-[#ff5964] focus:ring-3 focus:ring-[#ff5964]/10'
              : 'border-[#2f384c] focus:border-[#232735] focus:ring-3 focus:ring-[#232735]/10',
          ].join(' ')}
          inputMode={inputMode}
          maxLength={maxLength}
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

function SubmitButton({
  disabled,
  isSubmitting,
  label,
  loadingLabel,
}: {
  disabled: boolean
  isSubmitting: boolean
  label: string
  loadingLabel: string
}) {
  const isDisabled = disabled || isSubmitting

  return (
    <button
      className={[
        'min-h-12 w-full rounded-lg text-[14px] font-medium transition',
        isDisabled
          ? 'bg-[#d9d9d9] text-[#676767] shadow-[0_10px_18px_rgb(68_68_68_/_0.18)]'
          : 'bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] hover:brightness-105',
      ].join(' ')}
      disabled={isDisabled}
      type="submit"
    >
      {isSubmitting ? loadingLabel : label}
    </button>
  )
}

function EyeButton({ isVisible, onClick }: { isVisible: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={isVisible ? 'Hide password' : 'Show password'}
      className="grid size-8 place-items-center text-[#6f7788] transition hover:text-[#242a39]"
      onClick={onClick}
      type="button"
    >
      {isVisible ? <EyeOff className="size-6 stroke-[2.4]" /> : <Eye className="size-6 stroke-[2.4]" />}
    </button>
  )
}

function FormError({ message }: { message: string }) {
  if (!message) return null

  return (
    <p className="rounded-md bg-[#fff0f0] px-3 py-2 text-center text-[11px] text-[#e05252]">
      {message}
    </p>
  )
}

function SuccessCard({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="w-full rounded-xl bg-[#f7f8ff] px-5 py-8 text-center shadow-[0_18px_42px_rgb(68_43_132_/_0.25)] ring-1 ring-white/75">
      <div className="mx-auto grid size-16 place-items-center rounded-full bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-white shadow-[0_12px_24px_rgb(70_31_139_/_0.35)]">
        <Check className="size-9 stroke-[2.8]" />
      </div>
      <h1 className="mt-6 text-[26px] font-semibold leading-tight text-[#12192d]">Password changed!</h1>
      <p className="mx-auto mt-2 max-w-[250px] text-[14px] leading-5 text-[#7c8394]">
        You can now log in with your new password.
      </p>
      <button
        className="mt-7 min-h-12 w-full rounded-lg bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-[14px] font-medium text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] transition hover:brightness-105"
        onClick={onLogin}
        type="button"
      >
        Go back to login
      </button>
    </div>
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback
}
