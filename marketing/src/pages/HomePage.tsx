import { motion } from 'framer-motion'
import Header from '../components/Header'
import Footer from '../components/Footer'
import HowItWorks from '../components/HowItWorks'
import FeatureShowcase, { ModulePreview } from '../components/FeatureShowcase'
import FlashcardDemo from '../components/FlashcardDemo'
import QuizDemo from '../components/QuizDemo'
import KnowledgeGraphDemo from '../components/KnowledgeGraphDemo'
import ForgettingCurveDemo from '../components/ForgettingCurveDemo'
import { config } from '../config'
import { demoModules, demoStudyPlan } from '../data/demo'

const typeColors: Record<string, string> = {
  review: '#a5c47b',
  new: '#c47bb3',
  mixed: 'var(--accent)',
}

export default function HomePage() {
  const totalCards = demoModules.reduce((s, m) => s + m.flashcardCount, 0)
  const avgMastery = Math.round(demoModules.reduce((s, m) => s + m.masteryPct, 0) / demoModules.length)

  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>

        {/* ── Hero ── */}
        <section className="section-lg" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(196,149,106,0.09) 0%, transparent 70%), radial-gradient(circle at 85% 70%, rgba(165,196,123,0.04) 0%, transparent 40%)',
          textAlign: 'center',
        }}>
          <div className="container">
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{
                color: '#a5c47b', fontSize: '0.8125rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '1rem',
              }}
            >
              Plan · Study · Repeat
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.08, maxWidth: 760, margin: '0 auto 1.25rem' }}
            >
              Study smarter, not harder.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.65 }}
            >
              Upload your notes and textbooks. ReviseOS generates flashcards, quizzes, knowledge maps, and an adaptive study plan — all tuned to how you learn.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <a href={config.loginUrl} className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
                Get Started Free →
              </a>
              <a href="#how-it-works" className="btn-secondary" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
                See how it works
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── Stats Scoreboard (ExamWarRoom) ── */}
        <section style={{ padding: '2.5rem 0', background: 'var(--bg-warm)', borderTop: '1px solid var(--border)' }}>
          <div className="container">
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}
            >
              {[
                { label: 'Cards Due Today', value: '23', color: '#e06050' },
                { label: 'Total Flashcards', value: totalCards.toString(), color: 'var(--accent)' },
                { label: 'Avg Mastery', value: `${avgMastery}%`, color: '#a5c47b' },
                { label: 'Day Streak', value: '12', color: '#7ba5c4' },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  className="glass-card"
                  style={{ padding: '1.25rem', textAlign: 'center', borderTop: `3px solid ${stat.color}` }}
                  initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <p style={{ fontSize: '1.75rem', fontWeight: 700, fontFamily: 'var(--heading)', color: stat.color }}>
                    {stat.value}
                  </p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.25rem' }}>
                    {stat.label}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Knowledge Graph (NeuralCanvas animated pop-in) ── */}
        <section className="section" style={{
          position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(circle at 65% 50%, rgba(123,165,196,0.07) 0%, transparent 55%)',
        }}>
          <div className="container" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center',
          }}>
            <motion.div
              initial={{ opacity: 0, x: -24 }} whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.7 }}
            >
              <p style={{
                color: '#7ba5c4', fontSize: '0.8125rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem',
              }}>
                Graph-first learning
              </p>
              <h2 style={{ fontSize: '2rem', lineHeight: 1.15, marginBottom: '1rem' }}>
                See the connections.<br />
                <span style={{ color: '#7ba5c4' }}>Map your mind.</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.25rem' }}>
                ReviseOS builds a living knowledge graph from your study materials. Watch concepts connect, discover hidden relationships, and identify the gaps in your understanding — spatially.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[
                  { title: 'Cluster detection', desc: 'Strongly connected concept groups surface automatically.', color: '#7ba5c4' },
                  { title: 'Gap analysis', desc: 'Isolated nodes reveal concepts that need more context.', color: '#c4956a' },
                  { title: 'Importance scoring', desc: 'Central concepts rank higher based on connection density.', color: '#a5c47b' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                    initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }} transition={{ delay: i * 0.12 + 0.3 }}
                  >
                    <div style={{ width: 3, borderRadius: 2, background: item.color, alignSelf: 'stretch', flexShrink: 0 }} />
                    <div>
                      <p style={{ fontSize: '0.9375rem', fontWeight: 500, marginBottom: '0.125rem' }}>{item.title}</p>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>

            {/* Slow animated graph */}
            <motion.div
              initial={{ opacity: 0, scale: 0.82 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, ease: 'easeOut', delay: 0.2 }}
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              <KnowledgeGraphDemo />
            </motion.div>
          </div>

          {/* Blue pullquote */}
          <div className="container" style={{ marginTop: '3rem' }}>
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              style={{
                textAlign: 'center', fontSize: '1.5rem', fontFamily: 'var(--heading)',
                color: '#7ba5c4', fontWeight: 600, letterSpacing: '-0.01em',
              }}
            >
              Map your knowledge.{' '}
              <span style={{ color: 'var(--text)' }}>Own your learning.</span>
            </motion.p>
          </div>
        </section>

        {/* ── Module Performance (ExamWarRoom) ── */}
        <section id="performance" className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container-narrow">
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>Module Performance</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9375rem' }}>
              Track mastery across every subject at a glance
            </p>
            {demoModules.map((m, i) => (
              <motion.div
                key={m.id}
                style={{ marginBottom: '1.25rem' }}
                initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{m.name}</span>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: 600,
                    color: m.masteryPct >= 70 ? 'var(--success)' : '#e06050',
                  }}>
                    {m.masteryPct}%
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--surface)', overflow: 'hidden' }}>
                  <motion.div
                    style={{ height: '100%', borderRadius: 4, background: m.masteryPct >= 70 ? m.color : '#e06050' }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${m.masteryPct}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, delay: i * 0.08 + 0.2 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{m.flashcardCount} cards</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{m.lastStudied}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ── Your Dashboard ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Your study dashboard</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 2.5rem' }}>
              Everything you need in one place. Track progress across all your modules.
            </p>
            <ModulePreview />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section id="how-it-works" className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              style={{
                textAlign: 'center', color: '#a5c47b', fontSize: '0.8125rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem',
              }}
            >
              Your study week, designed by science
            </motion.p>
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>How it works</h2>
            <HowItWorks />
          </div>
        </section>

        {/* ── Interactive Demos ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Try it yourself</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem' }}>
              Interactive demos — no account required
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2.5rem', alignItems: 'start',
            }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Flashcard Review</h3>
                <FlashcardDemo />
              </div>
              <div>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Quiz Mode</h3>
                <QuizDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Weekly Study Plan (StudioPlanner) ── */}
        <section id="planner" className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <motion.p
              initial={{ opacity: 0 }} whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              style={{
                textAlign: 'center', color: '#a5c47b', fontSize: '0.8125rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem',
              }}
            >
              Plan · Study · Repeat
            </motion.p>
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
              Your study week, designed by science
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem', fontSize: '0.9375rem' }}>
              Automatically balanced for optimal retention — new material, review sessions, and rest days.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.75rem', marginBottom: '3rem' }}>
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
                    fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.06em', color: typeColors[day.type], marginBottom: '0.5rem',
                  }}>
                    {day.day}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text)', marginBottom: '0.375rem', fontWeight: 500 }}>
                    {day.duration} min
                  </p>
                  {day.modules.map((mod, j) => (
                    <p key={j} style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
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

            {/* Forgetting curve side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }} transition={{ duration: 0.6 }}
              >
                <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Why timing matters</h3>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
                  The planner isn't random — it's built on the science of forgetting. Each review session is
                  scheduled to catch memories just before they fade, maximising retention with minimum time invested.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  New material is introduced gradually. Review sessions keep existing knowledge fresh. The balance
                  adapts dynamically to your performance.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }} whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.15 }}
                style={{ display: 'flex', justifyContent: 'center' }}
              >
                <ForgettingCurveDemo />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Everything you need</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem' }}>
              One platform. Every tool you need to go from uploaded notes to exam-ready.
            </p>
            <FeatureShowcase />
          </div>
        </section>

        {/* ── Triple CTA ── */}
        <section className="section-lg" style={{
          background: 'var(--bg-warm)',
          borderTop: '1px solid var(--border)',
        }}>
          <div className="container" style={{ textAlign: 'center' }}>
            {/* Red: Don't just study. Dominate. */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ marginBottom: '3.5rem' }}
            >
              <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)', marginBottom: '1rem', lineHeight: 1.15 }}>
                Don't just study.{' '}
                <span style={{ color: '#e06050' }}>Dominate.</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 2rem', lineHeight: 1.65 }}>
                Stop passive reading. Start active recall. ReviseOS turns every upload into an exam performance machine.
              </p>
              <a href={config.loginUrl} className="btn-primary" style={{
                background: '#e06050', fontSize: '1rem', padding: '0.875rem 2rem',
              }}>
                Start Training →
              </a>
            </motion.div>

            <div style={{ width: 1, height: 48, background: 'var(--border)', margin: '0 auto 3.5rem' }} />

            {/* Blue: Map your knowledge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              style={{ marginBottom: '3.5rem' }}
            >
              <p style={{ fontSize: '1.625rem', fontFamily: 'var(--heading)', fontWeight: 600, color: '#7ba5c4', lineHeight: 1.2, marginBottom: '0.5rem' }}>
                Map your knowledge.
              </p>
              <p style={{ fontSize: '1.625rem', fontFamily: 'var(--heading)', fontWeight: 600, color: 'var(--text)', lineHeight: 1.2 }}>
                Own your learning.
              </p>
            </motion.div>

            <div style={{ width: 1, height: 48, background: 'var(--border)', margin: '0 auto 3.5rem' }} />

            {/* Green: Study with intention */}
            <motion.div
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: '1rem', lineHeight: 1.15 }}>
                Study with intention.
              </h2>
              <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 2rem', lineHeight: 1.65 }}>
                Let the planner handle the scheduling. You focus on learning. Calm, structured, science-backed.
              </p>
              <a href={config.loginUrl} className="btn-primary" style={{
                background: '#a5c47b', color: '#1a1714', fontSize: '1rem', padding: '0.875rem 2rem',
              }}>
                Start Planning →
              </a>
            </motion.div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  )
}
