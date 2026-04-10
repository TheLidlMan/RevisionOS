import { Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ModuleView from './pages/ModuleView';
import UploadCenter from './pages/UploadCenter';
import FlashcardReview from './pages/FlashcardReview';
import QuizMode from './pages/QuizMode';
import SettingsPage from './pages/Settings';

export default function App() {
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
        </Routes>
      </main>
    </div>
  );
}
