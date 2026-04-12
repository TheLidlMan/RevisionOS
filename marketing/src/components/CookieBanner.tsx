import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Cookie, X } from '@phosphor-icons/react'
import { browserStorage } from '../utils/browser'

const CONSENT_KEY = 'reviseos_cookie_consent'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = browserStorage.getItem(CONSENT_KEY)
    if (!consent) setVisible(true)
  }, [])

  const accept = () => {
    browserStorage.setItem(CONSENT_KEY, 'essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
      background: 'rgba(26, 23, 20, 0.95)', backdropFilter: 'blur(12px)',
      borderTop: '1px solid var(--border)',
      padding: '1rem 0',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 240 }}>
          <Cookie size={24} color="var(--accent)" />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.5 }}>
            We use essential cookies to keep you signed in. No tracking or marketing cookies.{' '}
            <Link to="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</Link>
            {' · '}
            <Link to="/terms" style={{ color: 'var(--accent)' }}>Terms</Link>
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={accept} className="btn-primary" style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}>
            Got it
          </button>
          <button
            onClick={accept}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: '0.5rem' }}
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
