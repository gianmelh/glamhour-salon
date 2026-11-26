import { CalendarDays, Check, ChevronDown, Clock3, Link2, Menu, Sparkles, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import salonIllustration from '../../assets/salon-illustration.png'
import { businessDetails } from './businessDetails'
import './landing.css'

const features = [
  { icon: CalendarDays, title: 'A little more order. A lot more calm.', description: 'Keep appointments, service durations and provider availability together in one calendar.' },
  { icon: UsersRound, title: 'Every client, remembered.', description: 'Bring client profiles, treatment notes and service history into one place, ready for the next visit.' },
  { icon: Link2, title: 'Your next booking starts with a link.', description: 'Share your salon’s booking page so clients can choose a service, a professional and an available time.' },
]

const plans = [
  { name: 'Free', price: '$0', period: 'to get started', description: 'Make room for your first clients.', features: ['Up to 15 registered clients', 'Appointment management', 'Shareable salon booking link', 'Service history & team dashboard'], cta: 'Start for free', featured: false },
  { name: 'Monthly Premium', price: '$14.99', period: '/ month', description: 'More room for a growing salon.', features: ['Unlimited clients', 'Everything in Free', 'All current Premium features', 'Priority support'], cta: 'Create your account', featured: true },
  { name: 'Annual Premium', price: '$119.99', period: '/ year', description: 'A full year of beautifully organized.', features: ['Unlimited clients', 'Everything in Monthly Premium', 'One annual subscription', 'Priority support'], cta: 'Create your account', featured: false },
]

const questions = [
  { question: 'Who is GLAMHOUR for?', answer: 'GLAMHOUR is salon management software for beauty professionals and teams offering nails, lashes, cosmetology and micropigmentation services. Customize your services, providers and schedules around the way your salon works.' },
  { question: 'What am I paying for?', answer: 'You are subscribing to GLAMHOUR’s salon management software. The Free plan supports up to 15 registered clients. Premium adds unlimited clients and the Premium features listed above. These subscription prices are separate from the beauty services your salon offers its clients.' },
  { question: 'How does Premium billing work?', answer: 'Premium is a recurring subscription, billed monthly at US$14.99 or annually at US$119.99. Create an account first, then choose a Premium plan in your subscription settings. Review the payment details before confirming your purchase.' },
  { question: 'Can I cancel my subscription?', answer: 'You can cancel Premium from your subscription settings. Premium access continues until the end of the current billing period, then your account returns to the Free plan. See the Terms & Conditions for the existing payment and refund policy.' },
]

function Brand() {
  return (
    <Link className="landing-brand" to="/" aria-label="GLAMHOUR home">
      <img className="landing-brand-logo" src="/brand/glamhour-logo.jpg" width="40" height="40" alt="" />
      <span>GLAMHOUR<sup className="landing-brand-trademark">™</sup></span>
    </Link>
  )
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    // Returning from a footer policy should show the homepage from the top.
    if (!window.location.hash) window.scrollTo(0, 0)
  }, [])

  return (
    <div className="landing">
      <a className="landing-skip" href="#main">Skip to content</a>
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Brand />
          <button aria-controls="landing-navigation" aria-expanded={menuOpen} aria-label={menuOpen ? 'Close menu' : 'Open menu'} className="landing-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} type="button">{menuOpen ? <X /> : <Menu />}</button>
          <nav aria-label="Main navigation" className={`landing-navigation${menuOpen ? ' is-open' : ''}`} id="landing-navigation" onClick={() => setMenuOpen(false)}>
            <a href="#features">Why GLAMHOUR</a><a href="#pricing">Pricing</a><a href="#questions">FAQs</a>
            <Link className="landing-login" to="/login">Log in</Link><Link className="landing-button landing-button-small" to="/signup">Get started</Link>
          </nav>
        </div>
      </header>

      <main id="main">
        <section className="landing-hero landing-container" aria-labelledby="hero-title">
          <div className="landing-hero-copy">
            <p className="landing-eyebrow"><Sparkles size={16} aria-hidden="true" /> A little less admin. A lot more beauty.</p>
            <h1 id="hero-title">Your salon.<br />Your rhythm.<br /><em>All in one place.</em></h1>
            <p className="landing-lead">Meet GLAMHOUR, the salon management app that brings your appointments, clients and team together. More time for the work you love.</p>
            <div className="landing-actions"><Link className="landing-button" to="/signup">Start your salon’s next chapter</Link><a className="landing-text-link" href="#pricing">Explore the plans</a></div>
            <p className="landing-hero-note"><Check size={16} aria-hidden="true" /> Free plan available · Built for beauty professionals</p>
          </div>
          <div className="landing-hero-visual">
            <span className="landing-visual-label">A beautiful day at your salon</span>
            <div className="landing-salon-scene"><img src={salonIllustration} alt="Illustrated lavender salon with a welcoming entrance and outdoor seating" width="385" height="344" fetchPriority="high" /></div>
            <div className="landing-appointment-preview" aria-label="Illustrative appointment preview">
              <div className="landing-preview-heading"><span className="landing-icon"><CalendarDays size={20} aria-hidden="true" /></span><div><strong>Your day, organized</strong><span>Example schedule</span></div><span className="landing-preview-sparkle"><Sparkles size={20} aria-hidden="true" /></span></div>
              <div className="landing-preview-appointment"><span>10:00</span><div><strong>A little nail care</strong><span>Gel manicure · 60 min</span></div><Check size={17} aria-label="Scheduled" /></div>
              <div className="landing-preview-appointment"><span>11:30</span><div><strong>A fresh lash look</strong><span>Lash extensions · 90 min</span></div><Check size={17} aria-label="Scheduled" /></div>
            </div>
            <span className="landing-visual-caption">Your craft deserves a little more headspace.</span>
          </div>
        </section>

        <section className="landing-specialties" aria-label="Beauty specialties"><div className="landing-container"><span>Made for your kind of beauty</span><p>Nails <i aria-hidden="true">✳</i> Lashes <i aria-hidden="true">✳</i> Cosmetology <i aria-hidden="true">✳</i> Micropigmentation</p></div></section>

        <section className="landing-section landing-container" id="features" aria-labelledby="features-title">
          <div className="landing-section-heading"><p className="landing-eyebrow">Less juggling. More creating.</p><h2 id="features-title">The details, handled.<br />The day, yours.</h2><p>From the first booking to the next visit, keep the moving parts of your salon connected.</p></div>
          <div className="landing-feature-grid">{features.map(({ icon: Icon, title, description }) => <article className="landing-feature" key={title}><span className="landing-icon"><Icon size={25} strokeWidth={1.7} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p></article>)}</div>
          <div className="landing-workflow"><div><p className="landing-eyebrow">Your salon, your setup</p><h3>Built around the way you work.</h3><p>Add your services and prices. Set your team’s availability. Keep track of appointments, treatment records and sales from one workspace.</p></div><div className="landing-workflow-items"><span><Check aria-hidden="true" /> Custom services & schedules</span><span><Check aria-hidden="true" /> Client & treatment records</span><span><Check aria-hidden="true" /> Sales & provider earnings</span></div></div>
        </section>

        <section className="landing-pricing landing-section" id="pricing" aria-labelledby="pricing-title"><div className="landing-container">
          <div className="landing-section-heading"><p className="landing-eyebrow">Simple plans. Space to grow.</p><h2 id="pricing-title">A plan for your next chapter.</h2><p>Start with Free. Choose a monthly or annual Premium subscription when you need room for more clients.</p></div>
          <div className="landing-plan-grid">{plans.map((plan) => <article className={`landing-plan${plan.featured ? ' landing-plan-featured' : ''}`} key={plan.name}>{plan.featured && <span className="landing-plan-label">Room to grow</span>}<h3>{plan.name}</h3><p>{plan.description}</p><div className="landing-price"><strong>{plan.price}</strong><span>{plan.period}</span></div><p className="landing-billing">{plan.name === 'Free' ? 'No subscription payment' : plan.featured ? 'US$14.99 billed every month' : 'US$119.99 billed every year'}</p><Link className={`landing-button${plan.featured ? '' : ' landing-button-outline'}`} to="/signup">{plan.cta}</Link><ul>{plan.features.map((feature) => <li key={feature}><Check size={17} aria-hidden="true" />{feature}</li>)}</ul></article>)}</div>
          <p className="landing-pricing-note">All prices in USD. Premium renews on your selected billing cycle until canceled. Manage or cancel your plan in subscription settings. <Link to="/terms?from=home">Payment terms</Link></p>
        </div></section>

        <section className="landing-section landing-container landing-faq" id="questions" aria-labelledby="questions-title"><div className="landing-section-heading"><p className="landing-eyebrow">Good to know</p><h2 id="questions-title">A few details,<br />before you begin.</h2><p>Get to know your new salon workspace.</p></div><div className="landing-faq-list">{questions.map(({ question, answer }) => <details key={question}><summary>{question}<ChevronDown size={19} aria-hidden="true" /></summary><p>{answer}</p></details>)}</div></section>

        <section className="landing-closing landing-container" aria-labelledby="closing-title"><Sparkles size={30} aria-hidden="true" /><h2 id="closing-title">Make room for<br />your best work.</h2><p>Your next beautifully organized day starts here.</p><Link className="landing-button" to="/signup">Get started with GLAMHOUR</Link><span><Clock3 size={15} aria-hidden="true" /> Your salon. On your terms.</span></section>
      </main>

      <footer className="landing-footer"><div className="landing-container"><div className="landing-footer-top"><div><Brand /><p>Salon management,<br />beautifully organized.</p></div><div className="landing-company"><h2>Company & contact</h2><p>{businessDetails.legalName}</p><address>{businessDetails.usBusinessAddress}</address><a href={`mailto:${businessDetails.contactEmail}`}>{businessDetails.contactEmail}</a></div><nav aria-label="Legal information"><h2>Legal</h2><Link to="/privacy?from=home">Privacy Policy</Link><Link to="/terms?from=home">Terms & Conditions</Link></nav></div><div className="landing-footer-bottom"><p>© {new Date().getFullYear()} {businessDetails.legalName}. All rights reserved.</p><span>Made for the business of beauty.</span></div></div></footer>
    </div>
  )
}
