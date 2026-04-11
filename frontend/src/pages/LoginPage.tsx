import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogo, SignIn, SpinnerGap, UserCirclePlus, WarningCircle } from '@phosphor-icons/react';
import { useAuthStore } from '../store/auth';
import { getAuthGoogleStartUrl } from '../api/client';

const glass = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '12px',
  backdropFilter: 'blur(20px)',
} as const;

const inputStyle: React.CSSProperties = {
  background: 'rgba(255,248,240,0.04)',
  border: '1px solid rgba(139,115,85,0.15)',
  borderRadius: '8px',
  color: '#f5f0e8',
  outline: 'none',
  fontWeight: 300,
};

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
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      navigate(nextPath, { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(typeof (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail === 'string'
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const returnTo = new URL(nextPath, window.location.origin).toString();
    window.location.assign(getAuthGoogleStartUrl(returnTo, true));
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#c4956a' : 'transparent',
    color: active ? '#1a1714' : 'rgba(245,240,232,0.5)',
    borderRadius: '8px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
  });

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

          <div className="flex items-center gap-3 mb-6" style={{ color: 'rgba(245,240,232,0.25)' }}>
            <div className="flex-1" style={{ height: 1, background: 'rgba(245,240,232,0.08)' }} />
            <span className="text-xs uppercase tracking-[0.2em]">or</span>
            <div className="flex-1" style={{ height: 1, background: 'rgba(245,240,232,0.08)' }} />
          </div>

          <div
            className="flex mb-6 p-1"
            style={{ background: 'rgba(255,248,240,0.04)', borderRadius: '8px' }}
          >
            <button
              onClick={() => setMode('login')}
              style={tabStyle(mode === 'login')}
              className="flex-1 py-2 text-sm transition-colors"
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              style={tabStyle(mode === 'register')}
              className="flex-1 py-2 text-sm transition-colors"
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm mb-1" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Your name"
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
                  className="w-full px-3 py-2.5"
                />
              </div>
            )}
            <div>
              <label className="block text-sm mb-1" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
                className="w-full px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm mb-1" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(196,149,106,0.6)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(139,115,85,0.15)'; }}
                className="w-full px-3 py-2.5"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'rgba(220,120,100,0.8)' }}>
                <WarningCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{ ...btnGold, opacity: loading ? 0.5 : 1 }}
              className="w-full px-4 py-3 flex items-center justify-center gap-2 transition-opacity"
            >
              {loading ? (
                <SpinnerGap className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <SignIn className="w-4 h-4" />
              ) : (
                <UserCirclePlus className="w-4 h-4" />
              )}
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

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
