import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GoogleLogo, SpinnerGap, WarningCircle, CheckCircle } from '@phosphor-icons/react'
import { config } from '../config'

type LoginState = 'idle' | 'redirecting' | 'success' | 'error'

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<LoginState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const err = searchParams.get('error')
    if (err) {
      setState('error')
      const msgs: Record<string, string> = {
        invalid_state: 'Login session expired. Please try again.',
        token_exchange_failed: 'Could not complete sign-in with Google. Please retry.',
        userinfo_failed: 'Could not retrieve your Google profile.',
        google_request_failed: 'Network error contacting Google. Please check your connection.',
        missing_google_info: 'Google did not provide the required account info.',
        missing_params: 'Incomplete login response. Please try again.',
      }
      setErrorMsg(msgs[err] || `Login failed: ${err}`)
    }
  }, [searchParams])

  const startGoogleLogin = async () => {
    setState('redirecting')
    try {
      const resp = await fetch(
        `${config.apiBaseUrl}/auth/google/start?return_to=${encodeURIComponent(config.appUrl)}`,
        { credentials: 'include' },
      )
      const data = await resp.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setState('error')
        setErrorMsg('Could not start Google login. Please try again.')
      }
    } catch {
      setState('error')
      setErrorMsg('Network error. Please check your connection and try again.')
    }
  }

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
            Sign in to continue
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', marginBottom: '1.5rem' }}>
            Use your Google account to get started
          </p>

          {state === 'error' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', marginBottom: '1.25rem',
              background: 'rgba(220,120,100,0.08)', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(220,120,100,0.2)',
            }}>
              <WarningCircle size={18} color="var(--danger)" />
              <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{errorMsg}</p>
            </div>
          )}

          {state === 'success' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1rem', marginBottom: '1.25rem',
              background: 'rgba(120,180,120,0.08)', borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(120,180,120,0.2)',
            }}>
              <CheckCircle size={18} color="var(--success)" />
              <p style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
                Signed in! Redirecting…
              </p>
            </div>
          )}

          <button
            onClick={startGoogleLogin}
            disabled={state === 'redirecting'}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: '0.75rem', padding: '0.875rem 1.5rem',
              background: '#fff', color: '#1a1714', border: 'none',
              borderRadius: 'var(--radius-sm)', fontSize: '1rem', fontWeight: 500,
              fontFamily: 'var(--sans)', cursor: state === 'redirecting' ? 'wait' : 'pointer',
              opacity: state === 'redirecting' ? 0.6 : 1,
              transition: 'opacity 0.2s, transform 0.15s',
            }}
          >
            {state === 'redirecting' ? (
              <SpinnerGap size={20} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <GoogleLogo size={20} weight="bold" />
            )}
            {state === 'redirecting' ? 'Redirecting to Google…' : 'Continue with Google'}
          </button>

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

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}
