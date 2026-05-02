import { motion } from 'framer-motion'
import { Sparkle, Lightning, Crown } from '@phosphor-icons/react'
import { config } from '../config'

const plans = [
  {
    icon: Sparkle,
    name: 'Free',
    price: '£0',
    period: 'forever',
    tagline: 'Perfect for getting started',
    color: '#7ba5c4',
    features: [
      'Unlimited flashcard creation',
      'Basic quiz generation',
      'Spaced repetition (FSRS)',
      'Knowledge graph (up to 50 nodes)',
      '3 module uploads per month',
      'Community support',
    ],
    cta: 'Get Started Free',
    href: config.loginUrl,
    highlighted: false,
  },
  {
    icon: Lightning,
    name: 'Pro',
    price: '£5',
    period: '/month',
    tagline: 'Everything a serious student needs',
    color: '#c4956a',
    features: [
      'Everything in Free',
      'Unlimited module uploads',
      'Advanced AI quiz generation',
      'Full knowledge graph (unlimited)',
      'Adaptive study planner',
      'Priority support',
      'Export flashcards & quizzes',
    ],
    cta: 'Start Pro — £5/mo',
    href: config.loginUrl,
    highlighted: true,
  },
  {
    icon: Crown,
    name: 'Teams',
    price: 'Custom',
    period: '',
    tagline: 'For schools and study groups',
    color: '#a5c47b',
    features: [
      'Everything in Pro',
      'Shared class modules',
      'Teacher/admin dashboard',
      'Progress analytics',
      'SSO integration',
      'Priority onboarding',
      'Dedicated support',
    ],
    cta: 'Contact Us',
    href: 'mailto:hello@reviseos.co.uk?subject=Teams%20Plan%20Inquiry',
    highlighted: false,
  },
]

export default function Pricing() {
  return (
    <section id="pricing" className="section">
      <div className="container">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center', color: '#c4956a', fontSize: '0.8125rem', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem',
          }}
        >
          Simple, transparent pricing
        </motion.p>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Start free. Upgrade when you're ready.
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: 480, margin: '0 auto 3rem' }}>
          No hidden fees. No credit card required for free tier. Cancel anytime.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}>
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              className="glass-card"
              style={{
                padding: '2rem',
                border: plan.highlighted ? `2px solid ${plan.color}` : '1px solid var(--border)',
                position: 'relative',
                transform: plan.highlighted ? 'scale(1.02)' : 'none',
              }}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              {plan.highlighted && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: plan.color, color: '#1a1714',
                  fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 1rem',
                  borderRadius: 999, textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <plan.icon size={28} color={plan.color} weight="regular" />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{plan.name}</h3>
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'var(--heading)' }}>{plan.price}</span>
                {plan.period && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{plan.period}</span>
                )}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem', fontStyle: 'italic' }}>
                {plan.tagline}
              </p>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.625rem', marginBottom: '2rem' }}>
                {plan.features.map((f, j) => (
                  <li key={j} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem' }}>
                    <span style={{ color: '#a5c47b', marginTop: '0.125rem', flexShrink: 0 }}>✓</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={plan.href}
                style={{
                  display: 'block', textAlign: 'center', padding: '0.875rem 1.5rem',
                  background: plan.highlighted ? plan.color : 'transparent',
                  color: plan.highlighted ? '#1a1714' : 'var(--text)',
                  border: `1px solid ${plan.color}`,
                  borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem',
                  textDecoration: 'none', transition: 'all 0.2s',
                }}
              >
                {plan.cta}
              </a>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}
        >
          💡 <strong>Pro tip:</strong> Use your own Groq API key for free and get advanced AI features without a subscription.
        </motion.p>
      </div>
    </section>
  )
}
