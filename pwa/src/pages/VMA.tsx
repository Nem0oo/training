import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { VMA } from '../types'

const ZONES = [
  { label: 'Récupération',      pcts: [50, 55, 60],      color: 'text-slate-400' },
  { label: 'Endurance fond.',   pcts: [60, 65, 70, 75],  color: 'text-blue-400' },
  { label: 'Seuil aérobie',     pcts: [75, 80, 85],      color: 'text-green-400' },
  { label: 'Seuil anaérobie',   pcts: [85, 90, 95],      color: 'text-yellow-400' },
  { label: 'VO2max / VMA',      pcts: [95, 100, 105],    color: 'text-orange-400' },
  { label: 'Survitesse',        pcts: [105, 110, 115, 120], color: 'text-red-400' },
]

function toPace(kmh: number): string {
  const secPerKm = 3600 / kmh
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

export function VMAPage() {
  const [vmas, setVmas]           = useState<VMA[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)
  const [valeur, setValeur]       = useState('')
  const [dateTest, setDateTest]   = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote]           = useState('')
  const [customPct, setCustomPct] = useState(80)

  useEffect(() => {
    api.vma.list().then(data => {
      setVmas(data)
      if (data.length > 0) setSelectedId(data[0].id)
    }).catch(console.error)
  }, [])

  const selected = vmas.find(v => v.id === selectedId) ?? vmas[0] ?? null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const v = parseFloat(valeur)
    if (!v || v <= 0) return
    const created = await api.vma.create({ valeur: v, date_test: dateTest, note })
    const next = [...vmas, created].sort((a, b) => b.date_test.localeCompare(a.date_test))
    setVmas(next)
    setSelectedId(created.id)
    setValeur('')
    setNote('')
    setShowForm(false)
  }

  async function handleDelete(id: string) {
    await api.vma.delete(id)
    const next = vmas.filter(v => v.id !== id)
    setVmas(next)
    if (selectedId === id) setSelectedId(next[0]?.id ?? null)
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-slate-100">VMA & Allures</h1>
          <button
            onClick={() => setShowForm(s => !s)}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            + Ajouter test
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {showForm && (
          <form onSubmit={handleAdd} className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">Nouveau test VMA</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">VMA (km/h)</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="30"
                  value={valeur}
                  onChange={e => setValeur(e.target.value)}
                  placeholder="ex: 15.5"
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Date du test</label>
                <input
                  type="date"
                  value={dateTest}
                  onChange={e => setDateTest(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Note (optionnel)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="ex: test demi-cooper, piste..."
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Enregistrer
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-2 rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}

        {vmas.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Aucun test VMA enregistré.<br />Ajoute ton premier test pour calculer tes allures.
          </div>
        ) : (
          <>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-300">VMA utilisée</h2>
                {vmas.length > 1 && (
                  <select
                    value={selectedId ?? ''}
                    onChange={e => setSelectedId(e.target.value)}
                    className="bg-slate-700 border border-slate-600 rounded-lg px-2 py-1 text-slate-200 text-xs"
                  >
                    {vmas.map((v, i) => (
                      <option key={v.id} value={v.id}>
                        {v.valeur} km/h — {v.date_test}{i === 0 ? ' (récent)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selected && (
                <div className="flex items-center gap-4">
                  <div className="text-4xl font-bold text-orange-400">{selected.valeur}</div>
                  <div>
                    <div className="text-xs text-slate-400">km/h</div>
                    <div className="text-xs text-slate-400">{selected.date_test}</div>
                    {selected.note && <div className="text-xs text-slate-500 mt-0.5">{selected.note}</div>}
                  </div>
                </div>
              )}
            </div>

            {selected && (
              <>
                <div className="bg-slate-800 rounded-xl p-4 space-y-3">
                  <h2 className="text-sm font-semibold text-slate-300">Calcul rapide</h2>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={50}
                      max={120}
                      value={customPct}
                      onChange={e => setCustomPct(Number(e.target.value))}
                      className="flex-1 accent-orange-500"
                    />
                    <span className="text-orange-400 font-bold w-10 text-center">{customPct}%</span>
                  </div>
                  <div className="flex gap-4 text-center">
                    <div className="flex-1 bg-slate-700 rounded-lg p-3">
                      <div className="text-xl font-bold text-slate-100">
                        {(selected.valeur * customPct / 100).toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-400">km/h</div>
                    </div>
                    <div className="flex-1 bg-slate-700 rounded-lg p-3">
                      <div className="text-xl font-bold text-slate-100">
                        {toPace(selected.valeur * customPct / 100)}
                      </div>
                      <div className="text-xs text-slate-400">min/km</div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-700">
                    <h2 className="text-sm font-semibold text-slate-300">Zones d'entraînement</h2>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Zone</th>
                        <th className="text-right px-2 py-2 text-xs font-medium text-slate-500">%</th>
                        <th className="text-right px-2 py-2 text-xs font-medium text-slate-500">km/h</th>
                        <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">Allure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ZONES.flatMap(zone =>
                        zone.pcts.map((pct, i) => {
                          const speed = selected.valeur * pct / 100
                          return (
                            <tr key={`${zone.label}-${pct}`} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                              <td className={`px-4 py-1.5 text-xs ${zone.color}`}>
                                {i === 0 ? zone.label : ''}
                              </td>
                              <td className="text-right px-2 py-1.5 text-slate-300 tabular-nums">{pct}%</td>
                              <td className="text-right px-2 py-1.5 text-slate-300 tabular-nums">{speed.toFixed(1)}</td>
                              <td className="text-right px-4 py-1.5 font-mono text-slate-100 tabular-nums">{toPace(speed)}</td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-800 rounded-xl p-4 space-y-2">
                  <h2 className="text-sm font-semibold text-slate-300 mb-3">Historique des tests</h2>
                  {vmas.map((v, i) => (
                    <div key={v.id} className="flex items-center gap-3 py-1">
                      <div className={`flex-1 ${v.id === selectedId ? 'text-orange-400' : 'text-slate-300'}`}>
                        <span className="font-semibold">{v.valeur} km/h</span>
                        <span className="text-xs text-slate-500 ml-2">{v.date_test}</span>
                        {i === 0 && <span className="text-xs text-slate-500 ml-1">(le plus récent)</span>}
                        {v.note && <div className="text-xs text-slate-500">{v.note}</div>}
                      </div>
                      <button
                        onClick={() => handleDelete(v.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        aria-label="Supprimer"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
