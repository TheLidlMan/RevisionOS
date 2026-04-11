import { motion } from 'framer-motion'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import HowItWorks from '../../components/HowItWorks'
import FeatureShowcase from '../../components/FeatureShowcase'
import FlashcardDemo from '../../components/FlashcardDemo'
import ForgettingCurveDemo from '../../components/ForgettingCurveDemo'
import QuizDemo from '../../components/QuizDemo'
import { config } from '../../config'
import { demoStudyPlan, demoModules } from '../../data/demo'

const typeColors: Record<string, string> = {
  review: '#a5c47b',
  new: '#c47bb3',
  mixed: 'var(--accent)',
}

export default function StudioPlanner() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>
        {/* ── Hero — calm / planning aesthetic ── */}
        <section style={{
          padding: '6rem 0 4rem',
          background: 'linear-gradient(180deg, rgba(165,196,123,0.06) 0%, transparent 60%)',
        }}>
          <div className="container" style={{ maxWidth: 700, textAlign: 'center' }}>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                color: '#a5c47b', fontSize: '0.8125rem', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem',
              }}
            >
              Plan · Study · Repeat
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontSize: '3rem', lineHeight: 1.15, marginBottom: '1.25rem' }}
            >
              Your study week,<br />designed by science
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: '2.5rem' }}
            >
              ReviseOS doesn't just create revision materials — it plans when and how you study. A calm, structured approach that balances new learning with spaced review.
            </motion.p>
            <motion.a
              href={config.loginUrl}
              className="btn-primary"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              style={{ background: '#a5c47b', color: '#1a1714', fontSize: '1rem', padding: '0.875rem 2rem' }}
            >
              Plan Your Week →
            </motion.a>
          </div>
        </section>

        {/* ── Weekly planner ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Weekly study plan</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
              Automatically balanced for optimal retention
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem',
            }}>
              {demoStudyPlan.map((day, i) => (
                <motion.div
                  key={i}
                  className="glass-card"
                  style={{ padding: '1rem', minHeight: 160 }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                >
                  <p style={{
                    fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: typeColors[day.type],
                    marginBottom: '0.5rem',
                  }}>
                    {day.day}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    {day.duration} min
                  </p>
                  {day.modules.map((mod, j) => (
                    <p key={j} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {mod}
                    </p>
                  ))}
                  <div style={{
                    marginTop: '0.5rem', fontSize: '0.625rem',
                    color: typeColors[day.type],
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {day.type}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>The method</h2>
            <HowItWorks cardStyle={{ borderLeft: '3px solid #a5c47b' }} />
          </div>
        </section>

        {/* ── Forgetting curve + routine ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center',
            }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Why timing matters</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
                  The planner isn't random. It's built on the science of forgetting. Each review session is scheduled to catch memories just before they fade — maximising retention with minimum time.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  New material is introduced gradually. Review sessions keep existing knowledge fresh. The balance adapts to your performance.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ForgettingCurveDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Interactive demos ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Today's session</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
              A taste of your daily study routine
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2.5rem', alignItems: 'start',
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#a5c47b' }}>Review cards</h3>
                <FlashcardDemo />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#a5c47b' }}>Quick quiz</h3>
                <QuizDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Your toolkit</h2>
            <FeatureShowcase cardStyle={{ borderLeft: '2px solid #a5c47b' }} />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section-lg" style={{ textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>
              Study with intention
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 460, margin: '0 auto 2rem', lineHeight: 1.6 }}>
              Let the planner handle the scheduling. You focus on learning.
            </p>
            <a href={config.loginUrl} className="btn-primary" style={{
              background: '#a5c47b', color: '#1a1714', fontSize: '1rem', padding: '0.875rem 2rem',
            }}>
              Start Planning →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
