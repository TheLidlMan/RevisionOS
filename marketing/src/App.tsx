import { Routes, Route } from 'react-router-dom'
import CookieBanner from './components/CookieBanner'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import ScreenshotsPage from './pages/ScreenshotsPage'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/screenshots" element={<ScreenshotsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
      </Routes>
      <CookieBanner />
    </>
  )
}
