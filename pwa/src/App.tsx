import { Routes, Route, Navigate } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Planning } from './pages/Planning'
import { SeanceNew } from './pages/SeanceNew'
import { SeanceDetail } from './pages/SeanceDetail'
import { Historique } from './pages/Historique'
import { Stats } from './pages/Stats'
import { VMAPage } from './pages/VMA'

export function App() {
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
