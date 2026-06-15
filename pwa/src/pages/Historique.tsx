import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Seance } from '../types'
import { SeanceCard } from '../components/SeanceCard'

export function Historique() {
  const [seances, setSeances] = useState<Seance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.seances.list({ etat: 'terminee', limit: 100 })
      .then(data => { setSeances(data.sort((a, b) => b.date.localeCompare(a.date))); setLoading(false) })
      .catch(console.error)
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <h1 className="text-lg font-semibold text-slate-100 max-w-lg mx-auto">Historique</h1>
      </header>
      <div className="max-w-lg mx-auto px-4 py-4 space-y-3">
        {loading && <p className="text-slate-400 text-sm text-center py-8">Chargement…</p>}
        {!loading && seances.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-8">Aucune séance terminée</p>
        )}
        {seances.map(s => (
          <div key={s.id}>
            <p className="text-xs text-slate-500 mb-1">
              {new Date(s.date).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <SeanceCard seance={s} />
          </div>
        ))}
      </div>
    </div>
  )
}
