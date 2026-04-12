import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { replaceBrowserLocation } from '../utils/browser'
import { buildAppLoginUrl } from '../utils/routes'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const redirectUrl = useMemo(() => {
    return buildAppLoginUrl(`?${searchParams.toString()}`)
  }, [searchParams])

  useEffect(() => {
    replaceBrowserLocation(redirectUrl)
  }, [redirectUrl])

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', background: 'var(--bg)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/logo.svg" alt="ReviseOS" style={{ width: 52, height: 52, objectFit: 'contain', margin: '0 auto 0.75rem', display: 'block' }} />
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--heading)', fontWeight: 700 }}>
            ReviseOS
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginTop: '0.25rem' }}>
            AI-Powered Adaptive Study Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.25rem', textAlign: 'center' }}>
            Redirecting to app sign-in
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            Authentication now lives in the main app for a single, consistent sign-in flow.
          </p>

          <a
            href={redirectUrl}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.875rem 1.5rem', background: '#fff', color: '#1a1714',
              border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '1rem',
              fontWeight: 500, fontFamily: 'var(--sans)', textDecoration: 'none',
            }}
          >
            Continue to app login
          </a>

          <p style={{
            marginTop: '1.25rem', textAlign: 'center',
            color: 'var(--text-tertiary)', fontSize: '0.75rem', lineHeight: 1.5,
          }}>
            By signing in you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--accent)' }}>Terms</a>
            {' and '}
            <a href="/privacy" style={{ color: 'var(--accent)' }}>Privacy Policy</a>.
          </p>
        </div>
      </div>

    </div>
  )
}
