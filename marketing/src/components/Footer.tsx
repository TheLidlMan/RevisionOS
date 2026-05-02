import { Link } from 'react-router-dom'
import { TwitterLogo, LinkedinLogo, GithubLogo } from '@phosphor-icons/react'
import { config } from '../config'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      padding: '3rem 0 2rem',
      background: 'var(--bg-warm)',
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '2rem',
          marginBottom: '2rem',
        }}>
          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <img src="/logo.svg" alt="ReviseOS" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span style={{
                fontFamily: 'var(--heading)', fontSize: '1.125rem', fontWeight: 700,
                color: 'var(--text)',
              }}>
                ReviseOS
              </span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 280 }}>
              AI-powered adaptive study platform. Upload your material, let AI build your revision assets, and learn smarter.
            </p>
            <div style={{ display: 'flex', gap: '0.875rem', marginTop: '1rem' }}>
              <a href="https://twitter.com/reviseos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <TwitterLogo size={20} />
              </a>
              <a href="https://linkedin.com/company/reviseos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <LinkedinLogo size={20} />
              </a>
              <a href="https://github.com/reviseos" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <GithubLogo size={20} />
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="/#features" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Features</a></li>
              <li><a href="/#pricing" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Pricing</a></li>
              <li><a href="/#why-reviseos" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Why ReviseOS?</a></li>
              <li><a href="/#testimonials" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Student Stories</a></li>
              <li><a href={config.loginUrl} style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Launch App</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Resources
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="/concepts" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Concepts</a></li>
              <li><a href="/#how-it-works" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>How It Works</a></li>
              <li><a href="/#planner" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Study Planner</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Legal
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><Link to="/privacy" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Privacy Policy</Link></li>
              <li><Link to="/terms" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Terms of Service</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Contact
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="mailto:hello@reviseos.co.uk" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>hello@reviseos.co.uk</a></li>
              <li><a href="/#pricing" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Teams & Schools</a></li>
            </ul>
          </div>
        </div>

        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: '1.5rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '0.5rem',
        }}>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8125rem' }}>
              © {new Date().getFullYear()} ReviseOS. All rights reserved.
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem' }}>
            Built for students, by students. 🚀
          </p>
        </div>
      </div>
    </footer>
  )
}
