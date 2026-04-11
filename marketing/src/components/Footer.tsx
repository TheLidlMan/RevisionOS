import { Link } from 'react-router-dom'

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
          </div>

          {/* Product */}
          <div>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Product
            </h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <li><a href="/#features" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Features</a></li>
              <li><a href="https://app.reviseos.co.uk" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Launch App</a></li>
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
              <li><span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>hello@reviseos.co.uk</span></li>
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
            Built for students, by students.
          </p>
        </div>
      </div>
    </footer>
  )
}
