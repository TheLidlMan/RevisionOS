import { House, MagnifyingGlass } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div
      className="flex flex-col items-center justify-center min-h-full p-8"
      style={{ background: 'var(--bg)' }}
    >
      <div className="text-center max-w-md space-y-6">
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-full"
          style={{ background: 'rgba(196,149,106,0.1)', border: '1px solid rgba(196,149,106,0.2)' }}
        >
          <span style={{ color: 'var(--accent)', fontSize: '2.5rem', fontFamily: 'var(--heading)' }}>
            404
          </span>
        </div>

        <div>
          <h1
            style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.5rem' }}
          >
            Page not found
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{
              background: 'rgba(196,149,106,0.15)',
              color: 'var(--accent)',
              border: '1px solid rgba(196,149,106,0.25)',
            }}
          >
            <House size={18} />
            Go home
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{
              background: 'var(--surface)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <MagnifyingGlass size={18} />
            Search modules
          </Link>
        </div>
      </div>
    </div>
  );
}
