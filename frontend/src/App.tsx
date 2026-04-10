import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import SearchModal from './components/SearchModal';
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

export default function App() {
  const [searchOpen, setSearchOpen] = useState(false);

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

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
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
        </Routes>
      </main>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
