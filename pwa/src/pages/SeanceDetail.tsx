import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Seance } from '../types'
import { TypeBadge } from '../components/TypeBadge'
import { EtatBadge } from '../components/EtatBadge'
import { SeanceForm } from '../components/SeanceForm'

export function SeanceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [seance, setSeance] = useState<Seance | null>(null)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    api.seances.get(id).then(s => { setSeance(s); setLoading(false) }).catch(() => navigate('/planning'))
  }, [id])

  async function handleUpdate(data: Omit<Seance, 'id' | 'created_at' | 'updated_at'>) {
    const updated = await api.seances.update(id!, data)
    setSeance(updated)
    setEditing(false)
  }

  async function markTerminee() {
    const updated = await api.seances.update(id!, { etat: 'terminee' })
    setSeance(updated)
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette séance ?')) return
    await api.seances.delete(id!)
    navigate('/planning', { replace: true })
  }

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">Chargement…</div>
  if (!seance) return null

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-slate-100 truncate flex-1 mx-2">{seance.nom}</h1>
          <button onClick={() => setEditing(e => !e)} className="text-xs text-orange-400 font-medium px-2 py-1 rounded hover:bg-slate-800">
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {editing ? (
          <SeanceForm
            initial={seance}
            onSubmit={handleUpdate}
            onCancel={() => setEditing(false)}
            submitLabel="Enregistrer"
          />
        ) : (
          <>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <TypeBadge type={seance.type} />
                <EtatBadge etat={seance.etat} />
              </div>
              <p className="text-slate-300 text-sm">
                {new Date(seance.date).toLocaleDateString('fr', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {seance.contenu && (
                <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">{seance.contenu}</p>
              )}
            </div>

            {(seance.etat === 'planifiee' || seance.etat === 'en_cours') && (
              <button
                onClick={markTerminee}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                Marquer comme terminée ✓
              </button>
            )}

            <button
              onClick={handleDelete}
              className="w-full bg-slate-800 hover:bg-red-900/40 text-red-400 font-medium py-2.5 rounded-xl transition-colors text-sm"
            >
              Supprimer la séance
            </button>
          </>
        )}
      </div>
    </div>
  )
}
