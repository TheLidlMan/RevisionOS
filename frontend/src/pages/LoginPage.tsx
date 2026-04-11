import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, SignIn, SpinnerGap, UserCirclePlus, WarningCircle } from '@phosphor-icons/react';
import { useAuthStore } from '../store/auth';

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
  const { login, register } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      navigate('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(typeof (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail === 'string'
        ? (err as { response: { data: { detail: string } } }).response.data.detail
        : msg);
    } finally {
      setLoading(false);
    }
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
          <BookOpen className="w-12 h-12 mx-auto mb-3" style={{ color: '#c4956a' }} />
          <h1
            className="text-3xl"
            style={{ fontFamily: "'Clash Display', sans-serif", color: '#f5f0e8', fontWeight: 700 }}
          >
            Revise OS
          </h1>
          <p className="mt-1" style={{ color: 'rgba(245,240,232,0.5)', fontWeight: 300 }}>
            AI-Powered Adaptive Study Platform
          </p>
        </div>

        <div className="p-8" style={glass}>
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
