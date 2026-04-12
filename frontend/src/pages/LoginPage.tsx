import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogo, SpinnerGap, WarningCircle } from '@phosphor-icons/react';
import { getAuthGoogleStartUrl } from '../api/client';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const btnGold: React.CSSProperties = {
  background: '#c4956a',
  color: '#1a1714',
  borderRadius: '8px',
  fontWeight: 500,
  border: 'none',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/')) {
      return '/';
    }
    return next;
  }, [searchParams]);

  const oauthError = searchParams.get('error');

  const oauthErrorMessage = useMemo(() => {
    if (!oauthError) {
      return '';
    }

    const messages: Record<string, string> = {
      invalid_state: 'Login session expired. Please try again.',
      token_exchange_failed: 'Could not complete sign-in with Google. Please retry.',
      userinfo_failed: 'Could not retrieve your Google profile.',
      google_request_failed: 'Network error contacting Google. Please check your connection.',
      missing_google_info: 'Google did not provide the required account info.',
      missing_params: 'Incomplete login response. Please try again.',
    };

    return messages[oauthError] || `Login failed: ${oauthError}`;
  }, [oauthError]);

  const handleGoogleLogin = () => {
    setLoading(true);
    const returnTo = new URL(nextPath, window.location.origin).toString();
    window.location.assign(getAuthGoogleStartUrl(returnTo, true));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0f0f0f' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.svg" alt="Revise OS" style={{ width: 52, height: 52, objectFit: 'contain', margin: '0 auto 0.75rem' }} />
          <h1
            className="text-3xl"
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 700 }}
          >
            ReviseOS
          </h1>
          <p className="mt-1" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
            AI-Powered Adaptive Study Platform
          </p>
        </div>

        <div className="p-8" style={glass}>
          {oauthErrorMessage && (
            <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'rgba(220,120,100,0.8)' }}>
              <WarningCircle className="w-4 h-4" />
              {oauthErrorMessage}
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ ...btnGold, opacity: loading ? 0.5 : 1, background: '#f5f0e8', color: '#1a1714' }}
            className="w-full px-4 py-3 flex items-center justify-center gap-2 transition-opacity mb-6"
          >
            {loading ? (
              <SpinnerGap className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleLogo className="w-4 h-4" weight="bold" />
            )}
            Continue with Google
          </button>

          <p className="text-sm text-center mb-6" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
            Sign in is available only with your Google account.
          </p>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm transition-colors"
              style={{ color: 'rgba(245,240,232,0.25)', background: 'none', border: 'none', cursor: 'pointer' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(245,240,232,0.5)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(245,240,232,0.25)'; }}
            >
              Continue without account →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
