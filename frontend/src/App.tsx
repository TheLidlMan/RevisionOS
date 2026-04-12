import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import MobileTopBar from './components/MobileTopBar';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { useAuthStore } from './store/auth';
import { isEditableTarget } from './utils/browser';
import { buildLoginRedirectPath } from './utils/routes';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ModuleView = lazy(() => import('./pages/ModuleView'));
const ModuleFlashcards = lazy(() => import('./pages/ModuleFlashcards'));
const FlashcardReview = lazy(() => import('./pages/FlashcardReview'));
const QuizMode = lazy(() => import('./pages/QuizMode'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const CurriculumPage = lazy(() => import('./pages/CurriculumPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ForgettingCurve = lazy(() => import('./pages/ForgettingCurve'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const location = useLocation();
  const { checkSession, isAuthenticated, loading } = useAuthStore();
  const nextPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShortcutsOpen(false);
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (loading) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  if (location.pathname === '/login') {
    if (isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    return (
      <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
        <LoginPage />
      </Suspense>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={buildLoginRedirectPath(nextPath)} replace />;
  }

  return (
    <div className="app-shell flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="hidden md:block shrink-0">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      </div>

      <div className="app-shell-main flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg)' }}>
        <MobileTopBar onOpenSearch={() => setSearchOpen(true)} />
        <main className="app-shell-content flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <Suspense fallback={<div style={{ minHeight: '100%', background: 'var(--bg)' }} />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/modules/:id" element={<ModuleView />} />
              <Route path="/modules/:id/flashcards" element={<ModuleFlashcards />} />
              <Route path="/flashcards/:moduleId" element={<FlashcardReview />} />
              <Route path="/quiz" element={<QuizMode />} />
              <Route path="/achievements" element={<AchievementsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
              <Route path="/curriculum" element={<CurriculumPage />} />
              <Route path="/forgetting-curve" element={<ForgettingCurve />} />
              <Route path="/forgetting-curve/:cardId" element={<ForgettingCurve />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
        <MobileBottomNav />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
      />
    </div>
  );
}
