import { Routes, Route } from 'react-router-dom'
import CookieBanner from './components/CookieBanner'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import ScreenshotsPage from './pages/ScreenshotsPage'
import ConceptIndex from './pages/ConceptIndex'
import ScholarGlass from './pages/concepts/ScholarGlass'
import ExamWarRoom from './pages/concepts/ExamWarRoom'
import EditorialAtlas from './pages/concepts/EditorialAtlas'
import NeuralCanvas from './pages/concepts/NeuralCanvas'
import StudioPlanner from './pages/concepts/StudioPlanner'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/screenshots" element={<ScreenshotsPage />} />
        <Route path="/concepts" element={<ConceptIndex />} />
        <Route path="/concepts/scholar-glass" element={<ScholarGlass />} />
        <Route path="/concepts/exam-war-room" element={<ExamWarRoom />} />
        <Route path="/concepts/editorial-atlas" element={<EditorialAtlas />} />
        <Route path="/concepts/neural-canvas" element={<NeuralCanvas />} />
        <Route path="/concepts/studio-planner" element={<StudioPlanner />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
      <CookieBanner />
    </>
  )
}
