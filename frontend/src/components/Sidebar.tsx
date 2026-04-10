import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Upload,
  Settings,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { useAppStore } from '../store';
import { getModules } from '../api/client';

export default function Sidebar() {
  const { sidebarOpen, toggleSidebar } = useAppStore();
  const location = useLocation();

  const { data: modules } = useQuery({
    queryKey: ['modules'],
    queryFn: getModules,
  });

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/upload', icon: Upload, label: 'Upload Center' },
    { to: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside
      className={`${
        sidebarOpen ? 'w-64' : 'w-16'
      } bg-navy-light border-r border-gray-800 flex flex-col transition-all duration-300 shrink-0 h-screen sticky top-0`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-gray-800">
        <BookOpen className="w-7 h-7 text-teal shrink-0" />
        {sidebarOpen && (
          <span className="text-lg font-bold tracking-tight whitespace-nowrap">
            RevisionOS
          </span>
        )}
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-teal/10 text-teal'
                  : 'text-gray-400 hover:text-white hover:bg-navy-lighter'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </NavLink>
          );
        })}

        {/* Module list */}
        {sidebarOpen && modules && modules.length > 0 && (
          <div className="mt-6">
            <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Modules
            </p>
            {modules.map((mod) => {
              const active = location.pathname === `/modules/${mod.id}`;
              return (
                <NavLink
                  key={mod.id}
                  to={`/modules/${mod.id}`}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-teal/10 text-teal'
                      : 'text-gray-400 hover:text-white hover:bg-navy-lighter'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: mod.color }}
                  />
                  <span className="truncate flex-1">{mod.name}</span>
                  {mod.due_cards > 0 && (
                    <span className="text-xs bg-teal/20 text-teal px-1.5 py-0.5 rounded-full">
                      {mod.due_cards}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        )}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center h-12 border-t border-gray-800 text-gray-400 hover:text-white transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-5 h-5" />
        ) : (
          <ChevronRight className="w-5 h-5" />
        )}
      </button>
    </aside>
  );
}
