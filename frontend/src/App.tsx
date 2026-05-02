import { useState, useEffect, lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import MobileTopBar from './components/MobileTopBar';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
// Eagerly loaded — always needed immediately after login
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import ModuleFlashcards from './pages/ModuleFlashcards';
import FlashcardReview from './pages/FlashcardReview';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/Settings';
// Lazily loaded — not needed on the critical path
const QuizMode = lazy(() => import('./pages/QuizMode'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const CurriculumPage = lazy(() => import('./pages/CurriculumPage'));
const ForgettingCurve = lazy(() => import('./pages/ForgettingCurve'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
import { useAuthStore } from './store/auth';
import Skeleton from './components/Skeleton';

function PageFallback() {
  return (
    <div className="p-6 flex flex-col gap-4 max-w-4xl mx-auto w-full">
      <Skeleton style={{ height: 40, width: '40%' }} />
      <Skeleton style={{ height: 24, width: '60%' }} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} style={{ height: 140 }} />
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { loadFromStorage, isAuthenticated, loading } = useAuthStore();
  const nextPath = `${location.pathname}${location.search}${location.hash}`;

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
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
    return <LoginPage />;
  }

  if (!isAuthenticated) {
    const loginUrl = nextPath && nextPath !== '/' ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
    return <Navigate to={loginUrl} replace />;
  }

  return (
    <div className="app-shell flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="hidden md:block shrink-0">
        <Sidebar onOpenSearch={() => setSearchOpen(true)} />
      </div>

      <div className="app-shell-main flex min-w-0 flex-1 flex-col" style={{ background: 'var(--bg)' }}>
        <MobileTopBar onOpenSearch={() => setSearchOpen(true)} />
        <main className="app-shell-content flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/modules/:id" element={<ModuleView />} />
            <Route path="/modules/:id/flashcards" element={<ModuleFlashcards />} />
            <Route path="/flashcards/:moduleId" element={<FlashcardReview />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/quiz" element={<Suspense fallback={<PageFallback />}><QuizMode /></Suspense>} />
            <Route path="/achievements" element={<Suspense fallback={<PageFallback />}><AchievementsPage /></Suspense>} />
            <Route path="/knowledge-graph" element={<Suspense fallback={<PageFallback />}><KnowledgeGraph /></Suspense>} />
            <Route path="/curriculum" element={<Suspense fallback={<PageFallback />}><CurriculumPage /></Suspense>} />
            <Route path="/forgetting-curve" element={<Suspense fallback={<PageFallback />}><ForgettingCurve /></Suspense>} />
            <Route path="/forgetting-curve/:cardId" element={<Suspense fallback={<PageFallback />}><ForgettingCurve /></Suspense>} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts />
    </div>
  );
}
