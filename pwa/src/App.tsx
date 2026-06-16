import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Login } from './pages/Login'
import { Planning } from './pages/Planning'
import { SeanceNew } from './pages/SeanceNew'
import { SeanceDetail } from './pages/SeanceDetail'
import { Historique } from './pages/Historique'
import { Stats } from './pages/Stats'
import { VMAPage } from './pages/VMA'

export function App() {
  const [token, setToken] = useState(() => localStorage.getItem('auth_token'))

  useEffect(() => {
    const handler = () => setToken(null)
    window.addEventListener('auth-expired', handler)
    return () => window.removeEventListener('auth-expired', handler)
  }, [])

  function handleLogin(t: string) {
    localStorage.setItem('auth_token', t)
    setToken(t)
  }

  if (!token) {
    return <Login onLogin={handleLogin} />
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/planning" replace />} />
        <Route path="/planning" element={<Planning />} />
        <Route path="/seances/new" element={<SeanceNew />} />
        <Route path="/seances/:id" element={<SeanceDetail />} />
        <Route path="/historique" element={<Historique />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/vma" element={<VMAPage />} />
      </Routes>
      <BottomNav />
    </>
  )
}
