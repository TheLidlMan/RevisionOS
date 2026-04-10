import { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import UploadCenter from './pages/UploadCenter';
import FlashcardReview from './pages/FlashcardReview';
import QuizMode from './pages/QuizMode';
import SettingsPage from './pages/Settings';
import WeaknessMap from './pages/WeaknessMap';
import Analytics from './pages/Analytics';
import KnowledgeGraph from './pages/KnowledgeGraph';
import CurriculumPage from './pages/CurriculumPage';
import LoginPage from './pages/LoginPage';
import LeaderboardPage from './pages/LeaderboardPage';
import CollaborationPage from './pages/CollaborationPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ThemePreview from './pages/ThemePreview';
import FreeRecall from './pages/FreeRecall';
import TimedExam from './pages/TimedExam';
import WritingPractice from './pages/WritingPractice';
import SessionReplay from './pages/SessionReplay';
import ForgettingCurve from './pages/ForgettingCurve';
import { useAuthStore } from './store/auth';

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);
  const location = useLocation();
  const { loadFromStorage } = useAuthStore();

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

  // Full-screen pages without sidebar
  if (location.pathname === '/login') {
    return <LoginPage />;
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/modules/:id" element={<ModuleView />} />
          <Route path="/upload" element={<UploadCenter />} />
          <Route path="/flashcards/:moduleId" element={<FlashcardReview />} />
          <Route path="/quiz" element={<QuizMode />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/weakness-map" element={<WeaknessMap />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraph />} />
          <Route path="/curriculum" element={<CurriculumPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/collaboration" element={<CollaborationPage />} />
          <Route path="/integrations" element={<IntegrationsPage />} />
          <Route path="/themes" element={<ThemePreview />} />
          <Route path="/free-recall" element={<FreeRecall />} />
          <Route path="/timed-exam" element={<TimedExam />} />
          <Route path="/writing-practice" element={<WritingPractice />} />
          <Route path="/session-replay" element={<SessionReplay />} />
          <Route path="/session-replay/:sessionId" element={<SessionReplay />} />
          <Route path="/forgetting-curve" element={<ForgettingCurve />} />
          <Route path="/forgetting-curve/:cardId" element={<ForgettingCurve />} />
        </Routes>
      </main>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <KeyboardShortcuts />
    </div>
  );
}
