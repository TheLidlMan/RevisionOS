import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import Header from '../components/Header'
import Footer from '../components/Footer'

const concepts = [
  {
    slug: 'scholar-glass',
    title: 'Scholar Glass',
    tagline: 'Cinematic, warm, premium',
    desc: 'The flagship concept — closest to the live app. Frosted glass surfaces, warm gold accents, and an academic aesthetic that feels like a private library.',
    color: '#c4956a',
    gradient: 'rgba(196,149,106,0.12)',
  },
  {
    slug: 'exam-war-room',
    title: 'Exam War Room',
    tagline: 'Dashboard energy, urgency, scoreboards',
    desc: 'Performance-oriented. Scoreboards, progress arcs, countdown timers, and red urgency accents that push you to study harder.',
    color: '#e06050',
    gradient: 'rgba(220,80,60,0.1)',
  },
  {
    slug: 'editorial-atlas',
    title: 'Editorial Atlas',
    tagline: 'Magazine layout, typographic drama',
    desc: 'Academic prestige meets editorial craft. Serif headings, column layouts, and a design language borrowed from the finest journals.',
    color: '#f5f0e8',
    gradient: 'rgba(245,240,232,0.06)',
  },
  {
    slug: 'neural-canvas',
    title: 'Neural Canvas',
    tagline: 'Graph-driven, spatial, experimental',
    desc: 'Concept-map-first approach. The knowledge graph takes centre stage with spatial navigation and network-inspired visuals.',
    color: '#7ba5c4',
    gradient: 'rgba(120,165,196,0.12)',
  },
  {
    slug: 'studio-planner',
    title: 'Studio Planner',
    tagline: 'Calm planning, study routines',
    desc: 'A productivity-focused aesthetic centred on study plans, weekly calendars, and the gentle discipline of consistent daily revision.',
    color: '#a5c47b',
    gradient: 'rgba(165,196,123,0.1)',
  },
]

export default function ConceptIndex() {
  return (
    <>
      <Header />
      <main style={{ paddingTop: 96 }}>
        <section className="section">
          <div className="container">
            <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
              <h1 style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>Concept Lab</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
                Five distinct landing page concepts for Revise OS. Each explores a different art direction while sharing the same product story and interactive demos.
              </p>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '1.5rem',
            }}>
              {concepts.map((c, i) => (
                <motion.div
                  key={c.slug}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Link
                    to={`/concepts/${c.slug}`}
                    style={{ textDecoration: 'none', display: 'block' }}
                  >
                    <div
                      className="glass-card"
                      style={{
                        padding: '2rem',
                        background: `linear-gradient(135deg, ${c.gradient} 0%, transparent 60%), var(--surface)`,
                        cursor: 'pointer',
                        minHeight: 220,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color }} />
                          <h2 style={{ fontSize: '1.25rem' }}>{c.title}</h2>
                        </div>
                        <p style={{
                          color: c.color, fontSize: '0.8125rem', fontWeight: 500,
                          marginBottom: '0.75rem',
                        }}>
                          {c.tagline}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
                          {c.desc}
                        </p>
                      </div>
                      <p style={{
                        color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 500,
                        marginTop: '1.25rem',
                      }}>
                        View concept →
                      </p>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
