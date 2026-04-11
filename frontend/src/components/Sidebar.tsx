import { useQuery } from '@tanstack/react-query';
import { CardsThree, MagnifyingGlass } from '@phosphor-icons/react';
import { NavLink, useLocation } from 'react-router-dom';
import { getModules } from '../api/client';
import { isPrimaryNavActive, primaryNavItems } from '../navigation';
import { useAppStore } from '../store';
import ThemeToggle from './ThemeToggle';

interface Props {
  mode?: 'desktop' | 'mobile';
  onNavigate?: () => void;
  onOpenSearch?: () => void;
}

export default function Sidebar({ mode = 'desktop', onNavigate, onOpenSearch }: Props) {
  const location = useLocation();
  const { sidebarOpen } = useAppStore();
  const expanded = mode === 'mobile' ? true : sidebarOpen;

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  return (
    <aside
      className="min-h-0"
      style={{
        width: expanded ? 280 : 76,
        background: 'var(--bg-warm)',
        borderRight: '1px solid var(--border)',
        height: mode === 'mobile' ? '100%' : '100dvh',
        position: mode === 'mobile' ? 'relative' : 'sticky',
        top: mode === 'mobile' ? 'auto' : 0,
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        overflow: 'hidden',
      }}
    >
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/logo.svg"
            alt="Revise OS"
            style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
          />
          {expanded && (
            <div className="min-w-0">
              <p style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem' }}>ReviseOS</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                {mode === 'mobile' ? 'Everything important in one place' : 'Module-first revision'}
              </p>
            </div>
          )}
        </div>
        {expanded && <ThemeToggle />}
      </div>

      {mode === 'mobile' && onOpenSearch ? (
        <button
          type="button"
          className="scholar-btn-secondary w-full justify-center"
          onClick={onOpenSearch}
        >
          <MagnifyingGlass size={18} />
          Search
        </button>
      ) : null}

      <nav className="space-y-1">
        {primaryNavItems.map(({ to, label, icon: Icon }) => {
          const active = isPrimaryNavActive(location.pathname, to);
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              {expanded && <span style={{ fontSize: '0.92rem' }}>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />

      <div className="px-2 min-h-0 flex-1 flex flex-col">
        {expanded ? (
          <>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <CardsThree size={16} />
              Modules
            </div>
            <div className="space-y-1 overflow-y-auto pr-1 flex-1">
              {modules?.map((module) => {
                const active = location.pathname === `/modules/${module.id}` || location.pathname === `/modules/${module.id}/flashcards`;
                return (
                  <NavLink
                    key={module.id}
                    to={`/modules/${module.id}`}
                    onClick={onNavigate}
                    className="block px-3 py-2.5 rounded-xl transition-colors"
                    style={{
                      background: active ? 'var(--surface-hover)' : 'transparent',
                      color: active ? 'var(--text)' : 'var(--text-secondary)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: module.color, flexShrink: 0 }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ fontSize: '0.92rem' }}>{module.name}</p>
                        <p style={{ fontSize: '0.76rem', color: 'var(--text-tertiary)' }}>
                          {module.total_cards} cards · {module.total_documents} docs
                        </p>
                      </div>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <MagnifyingGlass size={20} style={{ color: 'var(--text-secondary)' }} />
          </div>
        )}
      </div>
    </aside>
  );
}
