import { Link } from 'react-router-dom'
import { config } from '../config'

export default function Header() {
  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: 'rgba(15,15,15,0.85)', backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
          <img src="/logo.svg" alt="Revise OS" style={{ width: 36, height: 36, objectFit: 'contain' }} />
          <span style={{
            fontFamily: 'var(--heading)', fontSize: '1.25rem', fontWeight: 700,
            color: 'var(--text)', letterSpacing: '-0.02em',
          }}>
            ReviseOS
          </span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <a href="/#how-it-works" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>How it works</a>
          <a href="/#features" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>Features</a>
          <a href="/#planner" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>Planner</a>
          <Link to="/privacy" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Privacy</Link>
          <a
            href={config.loginUrl}
            className="btn-primary"
            style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
          >
            Get Started
          </a>
        </nav>
      </div>
    </header>
  )
}
