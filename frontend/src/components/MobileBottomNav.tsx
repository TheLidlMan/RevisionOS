import { NavLink, useLocation } from 'react-router-dom';
import { isPrimaryNavActive, primaryNavItems } from '../navigation';

export default function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="mobile-bottom-nav" aria-label="Primary navigation">
      {primaryNavItems.map(({ to, label, icon: Icon }) => {
        const active = isPrimaryNavActive(location.pathname, to);
        return (
          <NavLink
            key={to}
            to={to}
            className="mobile-bottom-nav-item"
            style={{
              color: active ? 'var(--accent)' : 'var(--text-secondary)',
              background: active ? 'rgba(196,149,106,0.12)' : 'transparent',
            }}
          >
            <Icon size={20} weight={active ? 'fill' : 'regular'} />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}