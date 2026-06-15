import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Stats as StatsType, SeanceType } from '../types'

const typeLabels: Record<SeanceType, string> = {
  endurance:    'Endurance',
  fractionne:   'Fractionné',
  cotes:        'Côtes',
  recuperation: 'Récupération',
  competition:  'Compétition',
  autre:        'Autre',
}

const typeColors: Record<SeanceType, string> = {
  endurance:    'bg-blue-500',
  fractionne:   'bg-red-500',
  cotes:        'bg-orange-500',
  recuperation: 'bg-green-500',
  competition:  'bg-purple-500',
  autre:        'bg-slate-500',
}

export function Stats() {
  const [stats, setStats] = useState<StatsType | null>(null)
  const [weeks, setWeeks] = useState(4)

  useEffect(() => {
    api.stats.get(weeks).then(setStats).catch(console.error)
  }, [weeks])

  const termineeCount = stats?.par_etat?.terminee ?? 0
  const planifieeCount = stats?.par_etat?.planifiee ?? 0

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-slate-100">Statistiques</h1>
          <select
            value={weeks}
            onChange={e => setWeeks(Number(e.target.value))}
            className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-sm"
          >
            <option value={2}>2 sem.</option>
            <option value={4}>4 sem.</option>
            <option value={8}>8 sem.</option>
            <option value={12}>12 sem.</option>
          </select>
        </div>
      </header>

      {stats && (
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-orange-400">{stats.total_seances}</p>
              <p className="text-xs text-slate-400 mt-1">Total</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-400">{termineeCount}</p>
              <p className="text-xs text-slate-400 mt-1">Terminées</p>
            </div>
            <div className="bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-slate-300">{stats.seances_cette_semaine}</p>
              <p className="text-xs text-slate-400 mt-1">Cette sem.</p>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Par type ({weeks} semaines)</h2>
            <div className="space-y-2">
              {(Object.keys(typeLabels) as SeanceType[]).map(t => {
                const count = stats.par_type[t] ?? 0
                const total = Object.values(stats.par_type).reduce((a, b) => a + (b ?? 0), 0)
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={t} className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 w-24">{typeLabels[t]}</span>
                    <div className="flex-1 bg-slate-700 rounded-full h-2">
                      <div className={`${typeColors[t]} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-300 w-8 text-right">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Par état</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'planifiee',  label: 'Planifiées', color: 'text-slate-300' },
                { key: 'terminee',   label: 'Terminées',  color: 'text-green-400' },
                { key: 'en_cours',   label: 'En cours',   color: 'text-yellow-400' },
                { key: 'annulee',    label: 'Annulées',   color: 'text-red-400' },
              ].map(({ key, label, color }) => (
                <div key={key} className="bg-slate-700 rounded-lg p-3">
                  <p className={`text-xl font-bold ${color}`}>
                    {stats.par_etat[key as keyof typeof stats.par_etat] ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
