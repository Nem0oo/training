import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { FCZone } from '../types'

export function FCZonesPage() {
  const [zones, setZones]       = useState<FCZone[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [nom, setNom]           = useState('')
  const [fcMin, setFcMin]       = useState('')
  const [fcMax, setFcMax]       = useState('')

  useEffect(() => {
    api.fcZones.list().then(setZones).catch(console.error)
  }, [])

  function resetForm() {
    setNom('')
    setFcMin('')
    setFcMax('')
    setEditingId(null)
    setShowForm(false)
  }

  function startEdit(zone: FCZone) {
    setEditingId(zone.id)
    setNom(zone.nom)
    setFcMin(String(zone.fc_min))
    setFcMax(String(zone.fc_max))
    setShowForm(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = parseInt(fcMin, 10)
    const max = parseInt(fcMax, 10)
    if (!nom || isNaN(min) || isNaN(max) || max < min) return

    if (editingId) {
      const updated = await api.fcZones.update(editingId, { nom, fc_min: min, fc_max: max })
      setZones(prev => prev.map(z => z.id === editingId ? updated : z).sort((a, b) => a.fc_min - b.fc_min))
    } else {
      const ordre = zones.length
      const created = await api.fcZones.create({ nom, fc_min: min, fc_max: max, ordre })
      setZones(prev => [...prev, created].sort((a, b) => a.fc_min - b.fc_min))
    }
    resetForm()
  }

  async function handleDelete(id: string) {
    await api.fcZones.delete(id)
    setZones(prev => prev.filter(z => z.id !== id))
    if (editingId === id) resetForm()
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-slate-100">Zones de FC</h1>
          <button
            onClick={() => { if (showForm) resetForm(); else setShowForm(true) }}
            className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            {showForm ? 'Annuler' : '+ Ajouter zone'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-300">
              {editingId ? 'Modifier la zone' : 'Nouvelle zone'}
            </h2>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Nom</label>
              <input
                type="text"
                value={nom}
                onChange={e => setNom(e.target.value)}
                placeholder="ex: Z1 Récupération"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">FC min (bpm)</label>
                <input
                  type="number"
                  min="0"
                  max="250"
                  value={fcMin}
                  onChange={e => setFcMin(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">FC max (bpm)</label>
                <input
                  type="number"
                  min="0"
                  max="250"
                  value={fcMax}
                  onChange={e => setFcMax(e.target.value)}
                  required
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 rounded-lg transition-colors">
                Enregistrer
              </button>
              <button type="button" onClick={resetForm} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm font-medium py-2 rounded-lg transition-colors">
                Annuler
              </button>
            </div>
          </form>
        )}

        {zones.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            Aucune zone de FC définie.<br />Ajoute tes zones pour que ton coach puisse les consulter.
          </div>
        ) : (
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h2 className="text-sm font-semibold text-slate-300">Zones définies</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-4 py-2 text-xs font-medium text-slate-500">Zone</th>
                  <th className="text-right px-2 py-2 text-xs font-medium text-slate-500">bpm</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500"></th>
                </tr>
              </thead>
              <tbody>
                {zones.map(zone => (
                  <tr key={zone.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-slate-200">{zone.nom}</td>
                    <td className="text-right px-2 py-2 text-slate-300 tabular-nums font-mono">
                      {zone.fc_min}–{zone.fc_max}
                    </td>
                    <td className="text-right px-4 py-2">
                      <button
                        onClick={() => startEdit(zone)}
                        className="text-slate-500 hover:text-orange-400 transition-colors p-1 mr-1"
                        aria-label="Modifier"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(zone.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                        aria-label="Supprimer"
                      >
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
