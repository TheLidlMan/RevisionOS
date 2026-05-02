import { motion } from 'framer-motion'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import HowItWorks from '../../components/HowItWorks'
import FeatureShowcase from '../../components/FeatureShowcase'
import FlashcardDemo from '../../components/FlashcardDemo'
import QuizDemo from '../../components/QuizDemo'
import ForgettingCurveDemo from '../../components/ForgettingCurveDemo'
import { config } from '../../config'
import { demoModules } from '../../data/demo'

export default function ExamWarRoom() {
  const totalCards = demoModules.reduce((s, m) => s + m.flashcardCount, 0)
  const avgMastery = Math.round(demoModules.reduce((s, m) => s + m.masteryPct, 0) / demoModules.length)

  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>
        {/* ── Hero — dashboard energy ── */}
        <section style={{
          padding: '5rem 0 4rem',
          background: 'linear-gradient(170deg, rgba(220,80,60,0.06) 0%, transparent 40%), var(--bg)',
        }}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              style={{ maxWidth: 680 }}
            >
              <p style={{
                color: '#e06050', fontSize: '0.8125rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.75rem',
              }}>
                🔥 Exam Countdown Mode
              </p>
              <h1 style={{ fontSize: '3rem', lineHeight: 1.1, marginBottom: '1rem' }}>
                Every point counts.<br />Every minute matters.
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: 520, marginBottom: '2rem' }}>
                Turn your revision into a performance machine. Track scores, eliminate weaknesses, and push your mastery higher every day.
              </p>
              <a href={config.loginUrl} className="btn-primary" style={{
                background: '#e06050', fontSize: '1rem', padding: '0.875rem 2rem',
              }}>
                Enter the War Room →
              </a>
            </motion.div>

            {/* Scoreboard */}
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
                marginTop: '3rem',
              }}
            >
              {[
                { label: 'Cards Due', value: '23', color: '#e06050' },
                { label: 'Total Cards', value: totalCards.toString(), color: 'var(--accent)' },
                { label: 'Avg Mastery', value: `${avgMastery}%`, color: '#78b478' },
                { label: 'Streak', value: '12 days', color: '#7ba5c4' },
              ].map((stat, i) => (
                <div key={i} className="glass-card" style={{
                  padding: '1.25rem', textAlign: 'center',
                  borderTop: `3px solid ${stat.color}`,
                }}>
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--heading)', color: stat.color }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {stat.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Progress arcs ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Module Performance</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
              Track mastery across every subject
            </p>
            {demoModules.map((m) => (
              <div key={m.id} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{m.name}</span>
                  <span style={{ fontSize: '0.875rem', color: m.masteryPct >= 70 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {m.masteryPct}%
                  </span>
                </div>
                <div style={{
                  height: 8, borderRadius: 4, background: 'var(--surface)',
                  overflow: 'hidden',
                }}>
                  <motion.div
                    style={{
                      height: '100%', borderRadius: 4,
                      background: m.masteryPct >= 70 ? m.color : '#e06050',
                    }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${m.masteryPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Battle plan</h2>
            <HowItWorks cardStyle={{ borderTop: '2px solid var(--accent)' }} />
          </div>
        </section>

        {/* ── Drills ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Drill station</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
              Rapid-fire practice to sharpen your recall
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2.5rem', alignItems: 'start',
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#e06050' }}>⚡ Speed Cards</h3>
                <FlashcardDemo />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#e06050' }}>🎯 Target Quiz</h3>
                <QuizDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Retention Chart ── */}
        <section className="section">
          <div className="container" style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '1rem' }}>Memory decay vs. your training</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: 480, margin: '0 auto 2.5rem' }}>
              Spaced repetition keeps your knowledge above the pass line.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <ForgettingCurveDemo />
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Your arsenal</h2>
            <FeatureShowcase />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section-lg" style={{ textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>
              Don't just study. <span style={{ color: '#e06050' }}>Dominate.</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 2rem', lineHeight: 1.6 }}>
              Start your exam preparation with military-grade revision tools.
            </p>
            <a href={config.loginUrl} className="btn-primary" style={{
              background: '#e06050', fontSize: '1rem', padding: '0.875rem 2rem',
            }}>
              Start Training →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
