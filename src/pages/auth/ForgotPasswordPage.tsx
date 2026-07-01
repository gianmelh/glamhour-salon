import { Mail } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AuthCard, Button, Input } from '../../components'

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh items-center bg-auth-gradient px-4 py-10">
      <AuthCard description="Enter your salon account email and we'll send a verification code." title="Reset password">
        <form className="space-y-4">
          <Input label="Email" leadingIcon={<Mail className="size-4" />} placeholder="name@example.com" type="email" />
          <Button fullWidth size="lg" type="button">Send verification code</Button>
        </form>
        <Link className="mt-6 block text-center text-xs font-semibold text-primary" to="/login">Back to log in</Link>
      </AuthCard>
    </div>
  )
}
