import { ArrowLeft, MagnifyingGlass } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getResolvedAppPage } from '../navigation';

interface Props {
  onOpenSearch: () => void;
}

export default function MobileTopBar({ onOpenSearch }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = getResolvedAppPage(location.pathname);
  const hasBackAction = Boolean(page.backTo);

  return (
    <header className="mobile-topbar">
      {hasBackAction ? (
        <button
          type="button"
          className="mobile-chrome-button"
          onClick={() => navigate(page.backTo!)}
          aria-label={`Back to ${page.backLabel || 'previous page'}`}
        >
          <ArrowLeft size={20} />
        </button>
      ) : (
        <div className="mobile-brand-chip">
          <img src="/logo.svg" alt="ReviseOS" style={{ width: 22, height: 22, objectFit: 'contain' }} />
          <span>ReviseOS</span>
        </div>
      )}

      <div className="min-w-0 flex-1 text-center px-3">
        <p className="truncate" style={{ color: 'var(--text)', fontFamily: 'var(--heading)', fontSize: '1rem' }}>
          {page.title}
        </p>
      </div>

      <button
        type="button"
        className="mobile-chrome-button"
        onClick={onOpenSearch}
        aria-label="Open search"
      >
        <MagnifyingGlass size={20} />
      </button>
    </header>
  );
}