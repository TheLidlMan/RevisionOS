import { motion } from 'framer-motion'
import { Star, Quotes } from '@phosphor-icons/react'

const testimonials = [
  {
    name: 'Sophie M.',
    role: 'Medical Student, Year 3',
    avatar: 'SM',
    avatarColor: '#7ba5c4',
    content: 'I was spending 6 hours a day on Anki and still failing my exams. ReviseOS cut my study time in half and my retention scores went through the roof. The knowledge graph alone changed how I think about medicine.',
    stars: 5,
  },
  {
    name: 'James T.',
    role: 'A-Level Chemistry Student',
    avatar: 'JT',
    avatarColor: '#a5c47b',
    content: 'The quiz generation is incredible — it picks up exactly the things examiners love to test. My predicted grade went from C to A in one term. Should have found this sooner.',
    stars: 5,
  },
  {
    name: 'Priya K.',
    role: 'University of Edinburgh',
    avatar: 'PK',
    avatarColor: '#c47bb3',
    content: 'The study planner is genuinely magical. I used to procrastinate constantly because I didn\'t know where to start. Now I just open the app and it tells me exactly what to do. Game changer.',
    stars: 5,
  },
  {
    name: 'Marcus L.',
    role: 'Law Student, Cambridge',
    avatar: 'ML',
    avatarColor: '#c4956a',
    content: 'I manage 12 modules across four papers. Before ReviseOS I was drowning. Now I actually have a life outside of studying and my grades have never been better.',
    stars: 5,
  },
  {
    name: 'Emma R.',
    role: 'GCSE Student',
    avatar: 'ER',
    avatarColor: '#e06050',
    content: 'I was skeptical — my teacher recommended it and I thought it would be just another app that doesn\'t work. Three weeks later I\'m top of my class in Biology. Absolutely recommend.',
    stars: 5,
  },
  {
    name: 'Daniel W.',
    role: 'PhD Researcher',
    avatar: 'DW',
    avatarColor: '#a5c47b',
    content: 'As a researcher I need to retain paper after paper. The spaced repetition schedule adapts to my performance automatically. I only study what I actually need to review.',
    stars: 5,
  },
]

export default function Testimonials() {
  return (
    <section id="testimonials" className="section" style={{
      background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(196,149,106,0.06) 0%, transparent 60%)',
    }}>
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
          Real results from real students
        </motion.p>
        <h2 style={{ textAlign: 'center', fontSize: '1.75rem', marginBottom: '0.5rem' }}>
          Loved by learners everywhere
        </h2>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: 480, margin: '0 auto 3rem' }}>
          Join thousands of students who've transformed their study habits with ReviseOS.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1.5rem',
        }}>
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              className="glass-card"
              style={{ padding: '1.75rem', position: 'relative' }}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Quotes
                size={24}
                color="var(--accent)"
                weight="fill"
                style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', opacity: 0.4 }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: t.avatarColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.875rem', color: '#fff',
                  flexShrink: 0,
                }}>
                  {t.avatar}
                </div>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{t.name}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{t.role}</p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.125rem', marginBottom: '0.75rem' }}>
                {Array.from({ length: t.stars }).map((_, j) => (
                  <Star key={j} size={14} color="#c4956a" weight="fill" />
                ))}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', lineHeight: 1.65 }}>
                "{t.content}"
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
