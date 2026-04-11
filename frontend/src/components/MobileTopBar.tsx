import { ArrowLeft, List, MagnifyingGlass } from '@phosphor-icons/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getResolvedAppPage } from '../navigation';

interface Props {
  onOpenNav: () => void;
  onOpenSearch: () => void;
}

export default function MobileTopBar({ onOpenNav, onOpenSearch }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const page = getResolvedAppPage(location.pathname);
  const hasBackAction = Boolean(page.backTo);

  return (
    <header className="mobile-topbar">
      <button
        type="button"
        className="mobile-chrome-button"
        onClick={() => {
          if (page.backTo) {
            navigate(page.backTo);
            return;
          }
          onOpenNav();
        }}
        aria-label={hasBackAction ? `Back to ${page.backLabel || 'previous page'}` : 'Open navigation'}
      >
        {hasBackAction ? <ArrowLeft size={20} /> : <List size={20} />}
      </button>

      <div className="min-w-0 flex-1 text-center px-3">
        <p className="truncate" style={{ color: 'var(--text)', fontFamily: 'var(--heading)', fontSize: '1rem' }}>
          {page.title}
        </p>
      </div>

      <button
        type="button"
        className="mobile-chrome-button"
        onClick={hasBackAction ? onOpenNav : onOpenSearch}
        aria-label={hasBackAction ? 'Open navigation' : 'Open search'}
      >
        {hasBackAction ? <List size={20} /> : <MagnifyingGlass size={20} />}
      </button>
    </header>
  );
}