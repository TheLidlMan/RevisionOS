import { motion } from 'framer-motion'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import HowItWorks from '../../components/HowItWorks'
import FeatureShowcase from '../../components/FeatureShowcase'
import FlashcardDemo from '../../components/FlashcardDemo'
import KnowledgeGraphDemo from '../../components/KnowledgeGraphDemo'
import ForgettingCurveDemo from '../../components/ForgettingCurveDemo'
import QuizDemo from '../../components/QuizDemo'
import { config } from '../../config'

export default function NeuralCanvas() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 64 }}>
        {/* ── Hero — spatial / graph-first ── */}
        <section style={{
          padding: '5rem 0 3rem', position: 'relative', overflow: 'hidden',
          background: 'radial-gradient(circle at 60% 40%, rgba(120,165,196,0.1) 0%, transparent 50%), radial-gradient(circle at 30% 70%, rgba(196,149,106,0.08) 0%, transparent 50%)',
        }}>
          <div className="container" style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center',
          }}>
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <p style={{
                color: '#7ba5c4', fontSize: '0.8125rem', fontWeight: 500,
                textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem',
              }}>
                Graph-first learning
              </p>
              <h1 style={{ fontSize: '3rem', lineHeight: 1.1, marginBottom: '1rem' }}>
                See the connections.<br />
                <span style={{ color: '#7ba5c4' }}>Map your mind.</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: '2rem', maxWidth: 460 }}>
                ReviseOS builds a living knowledge graph from your study materials. Watch concepts connect, discover hidden relationships, and navigate your understanding spatially.
              </p>
              <a href={config.loginUrl} className="btn-primary" style={{
                background: '#7ba5c4', fontSize: '1rem', padding: '0.875rem 2rem',
              }}>
                Explore Your Map →
              </a>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              style={{ display: 'flex', justifyContent: 'center' }}
            >
              <KnowledgeGraphDemo />
            </motion.div>
          </div>
        </section>

        {/* ── Concept clusters ── */}
        <section className="section" style={{
          background: 'var(--bg-warm)',
          borderTop: '1px solid var(--border)',
        }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
              Nodes, edges, understanding
            </h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2.5rem', maxWidth: 520, margin: '0 auto 2.5rem' }}>
              Each concept becomes a node. Each relationship becomes an edge. Your knowledge takes shape.
            </p>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem',
            }}>
              {[
                { title: 'Cluster detection', desc: 'Identify strongly connected concept groups within your material.', color: '#7ba5c4' },
                { title: 'Gap analysis', desc: 'Isolated nodes reveal concepts needing more context and connections.', color: '#c4956a' },
                { title: 'Importance scoring', desc: 'Central concepts surface automatically based on connection density.', color: '#a5c47b' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="glass-card"
                  style={{ padding: '1.5rem', borderLeft: `3px solid ${item.color}` }}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How It Works ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>The pipeline</h2>
            <HowItWorks cardStyle={{ borderLeft: '3px solid #7ba5c4' }} />
          </div>
        </section>

        {/* ── Memory science ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3rem', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <ForgettingCurveDemo />
              </div>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Memory is a graph too</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
                  Neural pathways strengthen with retrieval. The forgetting curve shows how memories decay — and how spaced repetition creates durable long-term traces.
                </p>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  ReviseOS schedules your reviews using FSRS to maximise retention with minimal effort.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Interactive demos ── */}
        <section className="section">
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '3rem' }}>Practice nodes</h2>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '2.5rem', alignItems: 'start',
            }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', color: '#7ba5c4' }}>Flashcard traversal</h3>
                <FlashcardDemo />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', marginBottom: '1rem', color: '#7ba5c4' }}>Concept quiz</h3>
                <QuizDemo />
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="section" style={{ background: 'var(--bg-warm)' }}>
          <div className="container">
            <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '2.5rem' }}>Tool palette</h2>
            <FeatureShowcase cardStyle={{ borderLeft: '2px solid #7ba5c4' }} />
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="section-lg" style={{ textAlign: 'center' }}>
          <div className="container">
            <h2 style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>
              Map your knowledge.{' '}
              <span style={{ color: '#7ba5c4' }}>Own your learning.</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto 2rem', lineHeight: 1.6 }}>
              Start building your concept map today. Every upload adds new nodes to your graph.
            </p>
            <a href={config.loginUrl} className="btn-primary" style={{
              background: '#7ba5c4', fontSize: '1rem', padding: '0.875rem 2rem',
            }}>
              Start Mapping →
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
