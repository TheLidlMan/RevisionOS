import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  CalendarDots,
  CardsThree,
  GearSix,
  GraduationCap,
  Graph,
  MagnifyingGlass,
  SquaresFour,
  TrendDown,
} from '@phosphor-icons/react';
import { NavLink, useLocation } from 'react-router-dom';
import { getModules } from '../api/client';
import { useAppStore } from '../store';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { to: '/', label: 'Dashboard', icon: SquaresFour },
  { to: '/quiz', label: 'Quiz', icon: BookOpen },
  { to: '/knowledge-graph', label: 'Knowledge Graph', icon: Graph },
  { to: '/curriculum', label: 'Study Plan', icon: CalendarDots },
  { to: '/forgetting-curve', label: 'Forgetting Curve', icon: TrendDown },
  { to: '/settings', label: 'Settings', icon: GearSix },
];

export default function Sidebar() {
  const location = useLocation();
  const { sidebarOpen } = useAppStore();

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  return (
    <aside
      style={{
        width: sidebarOpen ? 280 : 76,
        background: 'var(--bg-warm)',
        borderRight: '1px solid var(--border)',
        height: '100vh',
        position: 'sticky',
        top: 0,
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div className="flex items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-3 min-w-0">
          <GraduationCap size={28} weight="duotone" style={{ color: 'var(--accent)', flexShrink: 0 }} />
          {sidebarOpen && (
            <div className="min-w-0">
              <p style={{ fontFamily: 'var(--heading)', color: 'var(--text)', fontSize: '1.1rem' }}>Revise OS</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Module-first revision</p>
            </div>
          )}
        </div>
        {sidebarOpen && <ThemeToggle />}
      </div>

      <nav className="space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors"
              style={{
                background: active ? 'var(--accent-soft)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Icon size={20} weight={active ? 'fill' : 'regular'} />
              {sidebarOpen && <span style={{ fontSize: '0.92rem' }}>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} />

      <div className="px-2">
        {sidebarOpen ? (
          <>
            <div className="flex items-center gap-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              <CardsThree size={16} />
              Modules
            </div>
            <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {modules?.map((module) => {
                const active = location.pathname === `/modules/${module.id}` || location.pathname === `/modules/${module.id}/flashcards`;
                return (
                  <NavLink
                    key={module.id}
                    to={`/modules/${module.id}`}
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
