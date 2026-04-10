import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Map,
  BarChart3,
  Share2,
  Calendar,
  Trophy,
  Users,
  Link2,
  Palette,
  LogIn,
  LogOut,
  User,
  Brain,
  PenTool,
  Clock,
  History,
  TrendingUp,
} from 'lucide-react';
import { useAppStore } from '../store';
import { useAuthStore } from '../store/auth';
import { getModules } from '../api/client';

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const { user, logout } = useAuthStore();
  const location = useLocation();

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/upload', icon: Upload, label: 'Upload Center' },
    { to: '/weakness-map', icon: Map, label: 'Weakness Map' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/knowledge-graph', icon: Share2, label: 'Knowledge Graph' },
    { to: '/curriculum', icon: Calendar, label: 'Study Plan' },
    { to: '/free-recall', icon: Brain, label: 'Free Recall' },
    { to: '/timed-exam', icon: Clock, label: 'Timed Exam' },
    { to: '/writing-practice', icon: PenTool, label: 'Writing Practice' },
    { to: '/session-replay', icon: History, label: 'Session Replay' },
    { to: '/forgetting-curve', icon: TrendingUp, label: 'Forgetting Curve' },
    { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
    { to: '/collaboration', icon: Users, label: 'Study Rooms' },
    { to: '/integrations', icon: Link2, label: 'Integrations' },
    { to: '/themes', icon: Palette, label: 'Theme Preview' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside
      style={{
        width: sidebarOpen ? 256 : 64,
        background: 'var(--bg-warm)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 16px',
          height: 64,
          borderBottom: '1px dashed var(--border)',
        }}
      >
        <BookOpen
          style={{ width: 28, height: 28, color: 'var(--accent)', flexShrink: 0 }}
        />
        {sidebarOpen && (
          <span
            style={{
              fontFamily: 'var(--serif)',
              fontSize: 18,
              fontWeight: 400,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            RevisionOS
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav
        style={{
          flex: 1,
          padding: '16px 8px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 12px',
                borderRadius: 'var(--radius)',
                fontSize: 13,
                fontWeight: 300,
                fontFamily: 'var(--sans)',
                textDecoration: 'none',
                transition: 'background 0.15s ease, color 0.15s ease',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--surface-hover)';
                  e.currentTarget.style.color = 'var(--text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <Icon style={{ width: 18, height: 18, flexShrink: 0 }} />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          );
        })}

        {/* Module list */}
        {sidebarOpen && modules && modules.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <p
              style={{
                padding: '0 12px',
                marginBottom: 8,
                fontSize: 10,
                fontWeight: 500,
                color: 'var(--text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                fontFamily: 'var(--sans)',
              }}
            >
              Modules
            </p>
            {modules.map((mod) => {
              const active = location.pathname === `/modules/${mod.id}`;
              return (
                <NavLink
                  key={mod.id}
                  to={`/modules/${mod.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 12px',
                    borderRadius: 'var(--radius)',
                    fontSize: 13,
                    fontWeight: 300,
                    textDecoration: 'none',
                    transition: 'background 0.15s ease, color 0.15s ease',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    background: active ? 'var(--accent-soft)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--surface-hover)';
                      e.currentTarget.style.color = 'var(--text)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      backgroundColor: mod.color,
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mod.name}
                  </span>
                  {mod.due_cards > 0 && (
                    <span
                      style={{
                        fontSize: 11,
                        background: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontWeight: 400,
                      }}
                    >
                      {mod.due_cards}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* User section */}
      {sidebarOpen && (
        <div
          style={{
            padding: '12px',
            borderTop: '1px dashed var(--border)',
          }}
        >
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <User
                style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0 }}
              />
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 300,
                }}
              >
                {user.display_name}
              </span>
              <button
                onClick={logout}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: 4,
                  display: 'flex',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--danger)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                }}
                title="Sign out"
              >
                <LogOut style={{ width: 16, height: 16 }} />
              </button>
            </div>
          ) : (
            <NavLink
              to="/login"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 13,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                fontWeight: 300,
              }}
            >
              <LogIn style={{ width: 18, height: 18 }} />
              Sign In
            </NavLink>
          )}
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 48,
          borderTop: '1px solid var(--border)',
          color: 'var(--text-tertiary)',
          background: 'none',
          border: 'none',
          borderTopStyle: 'solid',
          borderTopWidth: 1,
          borderTopColor: 'var(--border)',
          cursor: 'pointer',
          transition: 'color 0.15s',
          width: '100%',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
        }}
      >
        {sidebarOpen ? (
          <ChevronLeft style={{ width: 18, height: 18 }} />
        ) : (
          <ChevronRight style={{ width: 18, height: 18 }} />
        )}
      </button>
    </aside>
  );
}
