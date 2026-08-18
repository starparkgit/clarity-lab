import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { Shell } from './components/Shell'
import { ArchivePage } from './pages/ArchivePage'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { PracticePage } from './pages/PracticePage'
import { RevisionsPage } from './pages/RevisionsPage'
import { SessionDetailPage } from './pages/SessionDetailPage'
import { SettingsPage } from './pages/SettingsPage'

function Gate({ children }: { children: ReactNode }) {
  const { ready, profile } = useApp()
  if (!ready) return <p style={{ padding: 40 }}>연습실을 열고 있습니다…</p>
  if (!profile) return <Navigate to="/auth" replace />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <Gate>
                <HomePage />
              </Gate>
            }
          />
          <Route
            path="/practice/:type/:id?"
            element={
              <Gate>
                <PracticePage />
              </Gate>
            }
          />
          <Route
            path="/archive"
            element={
              <Gate>
                <ArchivePage />
              </Gate>
            }
          />
          <Route
            path="/archive/:id"
            element={
              <Gate>
                <SessionDetailPage />
              </Gate>
            }
          />
          <Route
            path="/revisions"
            element={
              <Gate>
                <RevisionsPage />
              </Gate>
            }
          />
          <Route
            path="/settings"
            element={
              <Gate>
                <SettingsPage />
              </Gate>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
