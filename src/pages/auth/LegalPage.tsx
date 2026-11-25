import { ChevronLeft, FileText, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { acceptSignUpTerms } from './signUpDraft'

type LegalKind = 'terms' | 'privacy'

const legalContent: Record<
  LegalKind,
  {
    title: string
    updated: string
    icon: typeof FileText
    cta: string
    sections: Array<{ title: string; body: string }>
  }
> = {
  terms: {
    title: 'Terms & Conditions',
    updated: 'Last updated: March 1, 2026',
    icon: FileText,
    cta: 'I accept the terms',
    sections: [
      {
        title: '1. Acceptance of Terms',
        body: 'By accessing or using the Glamour app management platform, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you may not use the service.',
      },
      {
        title: '2. Account Responsibilities',
        body: 'You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use.',
      },
      {
        title: '3. Service Description',
        body: 'Our platform provides salon management tools including appointment scheduling, client records management, service documentation, and sales history tracking. Features may be updated or modified at any time.',
      },
      {
        title: '4. Acceptable Use',
        body: 'You agree to use the platform only for lawful purposes related to salon management. You shall not use the service to store or transmit harmful content, infringe on intellectual property rights, or violate any applicable laws.',
      },
      {
        title: '5. Payment & Billing',
        body: 'Subscription fees are billed according to the plan you select. All fees are non-refundable except as required by law. We reserve the right to modify pricing with 30 days prior notice.',
      },
      {
        title: '6. Limitation of Liability',
        body: 'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the platform, including loss of revenue or data.',
      },
      {
        title: '7. Termination',
        body: 'Either party may terminate this agreement at any time. Upon termination, your access will be revoked and your data will be handled according to our Privacy Policy.',
      },
      {
        title: '8. Governing Law',
        body: 'These terms shall be governed by and construed in accordance with the laws of the jurisdiction where the company is registered, without regard to conflict of law principles.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: 'Last updated: March 1, 2026',
    icon: ShieldCheck,
    cta: 'I accept the privacy policy',
    sections: [
      {
        title: '1. Information We Collect',
        body: 'We collect information you provide directly when creating your account, such as your name, email address, and salon details. We also collect service records, appointment history, and provider information you input into the platform.',
      },
      {
        title: '2. How We Use Your Information',
        body: 'Your information is used to provide and improve our services, manage your salon operations, facilitate appointment scheduling, and communicate with you about your account. We do not sell your personal information to third parties.',
      },
      {
        title: '3. Data Storage & Security',
        body: 'We employ industry-standard security measures to protect your data, including encryption in transit and at rest. Your data is stored on secure servers and access is restricted to authorized personnel only.',
      },
      {
        title: '4. Client Data',
        body: 'Client information entered into the platform is stored solely for the purpose of managing salon operations. You are responsible for obtaining appropriate consent from your clients.',
      },
      {
        title: '5. Data Retention',
        body: 'We retain your data for as long as your account is active. Upon account deletion, your data will be permanently removed within 30 days, except where retention is required by law.',
      },
      {
        title: '6. Your Rights',
        body: 'You have the right to access, correct, or delete your personal data at any time through your account settings. You may also request a full export of your data in a machine-readable format.',
      },
      {
        title: '7. Changes to This Policy',
        body: 'We may update this privacy policy from time to time. We will notify you of any material changes via email or through the application.',
      },
    ],
  },
}

export function LegalPage({ kind }: { kind: LegalKind }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isPublicReading = searchParams.get('from') === 'home'
  const content = legalContent[kind]
  const Icon = content.icon

  useEffect(() => {
    if (isPublicReading) window.scrollTo(0, 0)
  }, [isPublicReading, kind])

  function handleAccept() {
    acceptSignUpTerms()
    navigate('/signup')
  }

  return (
    <main className={`min-h-dvh bg-white text-[#172033]${isPublicReading ? ' [&_article_h2]:text-lg [&_article_p]:text-base [&_article_p]:leading-relaxed' : ''}`}>
      <header className="border-b border-[#eef0f6] bg-white px-5 pb-6 pt-7">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-[#efe7ff] text-[#7a3fe0]">
            <Icon className="size-5" strokeWidth={1.8} />
          </span>
          <div>
            <h1 className="text-[18px] font-semibold leading-tight">{content.title}</h1>
            <p className="mt-1 text-[11px] text-[#8b92a1]">{content.updated}</p>
          </div>
        </div>
      </header>

      <section className="px-5 pb-8 pt-6">
        <Link className="inline-flex min-h-11 items-center gap-1.5 text-sm text-[#172033]" to={isPublicReading ? '/' : '/signup'}>
          <ChevronLeft className="size-4" />
          {isPublicReading ? 'Back to Glamhour' : 'Back to sign up'}
        </Link>

        <div className="mt-6 space-y-6">
          {content.sections.map((section) => (
            <article key={section.title}>
              <h2 className="text-[15px] font-semibold leading-snug">{section.title}</h2>
              <p className="mt-3 text-[12px] leading-[1.45] text-[#5d6678]">{section.body}</p>
            </article>
          ))}
        </div>

        {isPublicReading ? (
          <nav aria-label="Legal documents" className="mt-8 flex flex-wrap gap-6 border-t border-[#eef0f6] pt-6 text-sm text-primary">
            <Link to="/privacy?from=home">Privacy Policy</Link>
            <Link to="/terms?from=home">Terms & Conditions</Link>
          </nav>
        ) : (
          <button
            className="mt-7 min-h-12 w-full rounded-lg bg-[linear-gradient(180deg,#8f4df2_0%,#4f1d92_100%)] text-[13px] font-medium text-white shadow-[0_10px_18px_rgb(70_31_139_/_0.42)] transition hover:brightness-105"
            onClick={handleAccept}
            type="button"
          >
            {content.cta}
          </button>
        )}
      </section>
    </main>
  )
}
