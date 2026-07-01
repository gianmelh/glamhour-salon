import { Eye, LockKeyhole, Mail } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { AuthCard, Button, Input } from '../../components'

export function LoginPage() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-dvh items-center bg-auth-gradient px-4 py-10">
      <AuthCard description="Enter your salon details and email to access your account." title="Log in to your salon">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); navigate('/app/home') }}>
          <Input label="Email" leadingIcon={<Mail className="size-4" />} placeholder="name@example.com" type="email" />
          <div>
            <div className="mb-1 text-right"><Link className="text-xs font-medium text-muted hover:text-primary" to="/forgot-password">Forgot password?</Link></div>
            <Input label="Password" leadingIcon={<LockKeyhole className="size-4" />} placeholder="Enter your password" trailingIcon={<Eye className="size-4" />} type="password" />
          </div>
          <Button fullWidth size="lg" type="submit">Log in</Button>
        </form>
        <p className="mt-6 text-center text-xs text-muted">Don't have an account? <Link className="font-semibold text-primary" to="/signup">Sign up</Link></p>
      </AuthCard>
    </div>
  )
}
