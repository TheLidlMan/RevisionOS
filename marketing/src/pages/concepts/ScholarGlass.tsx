import { motion } from 'framer-motion'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import HowItWorks from '../../components/HowItWorks'
import FeatureShowcase, { ModulePreview } from '../../components/FeatureShowcase'
import FlashcardDemo from '../../components/FlashcardDemo'
import QuizDemo from '../../components/QuizDemo'
import KnowledgeGraphDemo from '../../components/KnowledgeGraphDemo'
import ForgettingCurveDemo from '../../components/ForgettingCurveDemo'
import { config } from '../../config'

export default function ScholarGlass() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>
        {/* ── Hero ── */}
        <section className="section-lg" style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(196,149,106,0.08) 0%, transparent 70%)',
          textAlign: 'center',
        }}>
          <div className="container">
            <motion.p
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}
            >
              AI-Powered Adaptive Revision
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{ fontSize: '3.5rem', lineHeight: 1.1, maxWidth: 700, margin: '0 auto 1.25rem' }}
            >
              Study smarter, not harder
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ color: 'var(--text-secondary)', fontSize: '1.125rem', maxWidth: 560, margin: '0 auto 2.5rem', lineHeight: 1.6 }}
            >
              Upload your notes and textbooks. ReviseOS generates flashcards, quizzes, knowledge maps, and an adaptive study plan — all tuned to how you learn.
            </motion.p>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
              <a href={config.loginUrl} className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
                Get Started Free →
              </a>
            </motion.div>
          </div>
        </section>

        {/* ── Module Preview ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>Your study dashboard</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: 500, margin: '0 auto 2.5rem' }}>
              Everything you need in one place. Track progress across all your modules.
            </p>
            <ModulePreview />
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>How it works</h2>
            <HowItWorks />
          </div>
        </section>

        {/* ── Interactive Demos ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
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

        {/* ── Visualisations ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '3rem' }}>Visualise your knowledge</h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2.5rem', alignItems: 'start',
            }}>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Knowledge Graph</h3>
                <KnowledgeGraphDemo />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Forgetting Curve</h3>
                <ForgettingCurveDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Everything you need</h2>
            <FeatureShowcase />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section-lg" style={{ textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>Ready to ace your exams?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.6 }}>
              Join thousands of students using AI-powered spaced repetition to study more effectively.
            </p>
            <a href={config.loginUrl} className="btn-primary" style={{ fontSize: '1rem', padding: '0.875rem 2rem' }}>
              Start Revising Free →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
