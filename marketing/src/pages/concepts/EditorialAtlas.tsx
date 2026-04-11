import { motion } from 'framer-motion'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import HowItWorks from '../../components/HowItWorks'
import FeatureShowcase from '../../components/FeatureShowcase'
import FlashcardDemo from '../../components/FlashcardDemo'
import QuizDemo from '../../components/QuizDemo'
import KnowledgeGraphDemo from '../../components/KnowledgeGraphDemo'
import ForgettingCurveDemo from '../../components/ForgettingCurveDemo'
import { config } from '../../config'

export default function EditorialAtlas() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>
        {/* ── Hero — editorial / magazine layout ── */}
        <section style={{
          padding: '7rem 0 5rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '0.6875rem',
                color: 'var(--text-tertiary)', marginBottom: '2rem', fontWeight: 500,
              }}
            >
              The Revise OS Journal · Issue 01
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                fontSize: '4rem', lineHeight: 1.05, fontWeight: 700,
                fontFamily: 'Georgia, "Times New Roman", serif',
                letterSpacing: '-0.03em', marginBottom: '1.5rem',
              }}
            >
              The Art of<br />Deliberate Study
            </motion.h1>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem',
                borderTop: '2px solid var(--text)', paddingTop: '1.5rem',
              }}
            >
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
                An AI-powered platform that transforms how students prepare for exams. Upload your lecture notes, textbooks, and slides — and receive a complete adaptive revision system built from your own material.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.7 }}>
                  Flashcards, quizzes, concept maps, forgetting curves, and personalised study plans. Scientifically grounded. Beautifully designed.
                </p>
                <a href={config.loginUrl} style={{
                  color: 'var(--text)', fontSize: '0.9375rem', fontWeight: 500,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  marginTop: '1rem',
                }}>
                  Begin your scholarship →
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── How It Works — editorial columns ── */}
        <section className="section" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <p style={{
              textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.6875rem',
              color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 500,
            }}>
              Method
            </p>
            <h2 style={{
              fontSize: '2rem', fontFamily: 'Georgia, "Times New Roman", serif',
              marginBottom: '2.5rem', fontWeight: 700,
            }}>
              Four steps to mastery
            </h2>
            <HowItWorks cardStyle={{
              background: 'transparent',
              border: 'none',
              borderTop: '1px solid var(--border)',
              borderRadius: 0,
              padding: '1.5rem 0',
            }} />
          </div>
        </section>

        {/* ── Feature article ── */}
        <section className="section" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <p style={{
              textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.6875rem',
              color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 500,
            }}>
              Featured
            </p>
            <h2 style={{
              fontSize: '2rem', fontFamily: 'Georgia, "Times New Roman", serif',
              marginBottom: '1.5rem', fontWeight: 700,
            }}>
              The Knowledge Graph
            </h2>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem',
              alignItems: 'start',
            }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.8, marginBottom: '1.25rem' }}>
                  Every concept in your study material is mapped into an interconnected graph. See how ideas relate, identify isolated knowledge, and discover the structure beneath your subject.
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: 1.8 }}>
                  The graph grows as you upload more material and complete reviews. Strong connections become visible. Weak links are surfaced for targeted study.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <KnowledgeGraphDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Exhibits ── */}
        <section className="section" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <p style={{
              textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.6875rem',
              color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 500,
            }}>
              Exhibits
            </p>
            <h2 style={{
              fontSize: '2rem', fontFamily: 'Georgia, "Times New Roman", serif',
              marginBottom: '2.5rem', fontWeight: 700,
            }}>
              Hands-on demonstrations
            </h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '3rem', alignItems: 'start',
            }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: '1rem' }}>
                  I. Flashcard Review
                </h3>
                <FlashcardDemo />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontFamily: 'Georgia, serif', fontWeight: 700, marginBottom: '1rem' }}>
                  II. Quiz Assessment
                </h3>
                <QuizDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Forgetting Curve ── */}
        <section className="section" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="container" style={{ maxWidth: 900 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center' }}>
              <div>
                <p style={{
                  textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.6875rem',
                  color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 500,
                }}>
                  Science
                </p>
                <h2 style={{
                  fontSize: '1.75rem', fontFamily: 'Georgia, "Times New Roman", serif',
                  marginBottom: '1rem', fontWeight: 700,
                }}>
                  The Ebbinghaus Curve,<br />conquered
                </h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  Without review, you forget 80% within a month. FSRS-powered spaced repetition keeps memories strong by scheduling reviews at precisely the right moment.
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ForgettingCurveDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section">
          <div className="container" style={{ maxWidth: 900 }}>
            <p style={{
              textTransform: 'uppercase', letterSpacing: '0.15em', fontSize: '0.6875rem',
              color: 'var(--text-tertiary)', marginBottom: '0.5rem', fontWeight: 500,
            }}>
              Toolkit
            </p>
            <h2 style={{
              fontSize: '2rem', fontFamily: 'Georgia, "Times New Roman", serif',
              marginBottom: '2.5rem', fontWeight: 700,
            }}>
              Complete feature suite
            </h2>
            <FeatureShowcase cardStyle={{
              background: 'transparent', border: 'none',
              borderTop: '1px solid var(--border)', borderRadius: 0,
              padding: '1.5rem 0',
            }} />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section-lg" style={{
          textAlign: 'center', borderTop: '2px solid var(--text)',
        }}>
          <div className="container" style={{ maxWidth: 600 }}>
            <h2 style={{
              fontSize: '2.5rem', fontFamily: 'Georgia, "Times New Roman", serif',
              marginBottom: '1rem', fontWeight: 700,
            }}>
              Join the academy
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              Your exam preparation deserves the rigour of scientific method and the elegance of editorial craft.
            </p>
            <a href={config.loginUrl} style={{
              color: 'var(--text)', fontSize: '1rem', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              borderBottom: '2px solid var(--accent)', paddingBottom: '0.25rem',
            }}>
              Begin →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
