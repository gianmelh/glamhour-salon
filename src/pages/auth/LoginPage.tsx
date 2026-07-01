import { Eye, LockKeyhole, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, Button, Input } from '../../components'
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const nextEmailError = /^\S+@\S+\.\S+$/.test(email.trim()) ? '' : 'Enter a valid email address.'
    const nextPasswordError = password ? '' : 'Enter your password.'
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
    <div className="flex min-h-dvh items-center bg-auth-gradient px-4 py-10">
      <AuthCard description="Enter your salon details and email to access your account." title="Log in to your salon">
        <form className="space-y-4" noValidate onSubmit={handleSubmit}>
          <Input
            autoComplete="email"
            error={emailError}
            label="Email"
            leadingIcon={<Mail className="size-4" />}
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailError('')
              setLoginError('')
            }}
            placeholder="name@example.com"
            type="email"
            value={email}
          />
          <div>
            <div className="mb-1 text-right"><Link className="text-xs font-medium text-muted hover:text-primary" to="/forgot-password">Forgot password?</Link></div>
            <Input
              autoComplete="current-password"
              error={passwordError}
              label="Password"
              leadingIcon={<LockKeyhole className="size-4" />}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordError('')
                setLoginError('')
              }}
              placeholder="Enter your password"
              trailingIcon={<Eye className="size-4" />}
              type="password"
              value={password}
            />
          </div>
          {loginError && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{loginError}</p>}
          <Button fullWidth loading={isSubmitting} size="lg" type="submit">Log in</Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">Don't have an account? <Link className="font-semibold text-primary" to="/signup">Sign up</Link></p>
      </AuthCard>
    </div>
  )
}
