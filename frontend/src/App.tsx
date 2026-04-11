import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import MobileBottomNav from './components/MobileBottomNav';
import MobileTopBar from './components/MobileTopBar';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import ModuleFlashcards from './pages/ModuleFlashcards';
import FlashcardReview from './pages/FlashcardReview';
import QuizMode from './pages/QuizMode';
import SettingsPage from './pages/Settings';
import KnowledgeGraph from './pages/KnowledgeGraph';
import CurriculumPage from './pages/CurriculumPage';
import LoginPage from './pages/LoginPage';
import ForgettingCurve from './pages/ForgettingCurve';
import { useAuthStore } from './store/auth';

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
            <Route path="/quiz" element={<QuizMode />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
            <Route path="/curriculum" element={<CurriculumPage />} />
            <Route path="/forgetting-curve" element={<ForgettingCurve />} />
            <Route path="/forgetting-curve/:cardId" element={<ForgettingCurve />} />
          </Routes>
        </main>
        <MobileBottomNav />
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts />
    </div>
  );
}
