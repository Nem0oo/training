import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Seance } from '../types'
import { TypeBadge } from './TypeBadge'
import { EtatBadge } from './EtatBadge'
import { api } from '../lib/api'

export function SeanceCard({ seance, onUpdated }: { seance: Seance; onUpdated?: (seance: Seance) => void }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const isTerminee = seance.etat === 'terminee'

  async function toggleTerminee(e: React.MouseEvent) {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      const updated = await api.seances.update(seance.id, { etat: isTerminee ? 'planifiee' : 'terminee' })
      onUpdated?.(updated)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={() => navigate(`/seances/${seance.id}`)}
      className="bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700 flex gap-3"
    >
      <button
        onClick={toggleTerminee}
        disabled={saving}
        aria-label={isTerminee ? 'Marquer comme non terminée' : 'Marquer comme terminée'}
        className={`shrink-0 w-6 h-6 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${
          isTerminee ? 'bg-green-600 border-green-600' : 'border-slate-500 hover:border-orange-400'
        } ${saving ? 'opacity-50' : ''}`}
      >
        {isTerminee && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium text-slate-100 text-sm leading-tight">{seance.nom}</p>
          <EtatBadge etat={seance.etat} />
        </div>
        <div className="mt-2">
          <TypeBadge type={seance.type} />
        </div>
        {seance.contenu && (
          <p className="mt-2 text-xs text-slate-400 line-clamp-2">{seance.contenu}</p>
        )}
      </div>
    </div>
  )
}
