import { useState } from 'react'
import type { Seance, SeanceType, SeanceEtat } from '../types'

const TYPES: SeanceType[] = ['endurance', 'fractionne', 'cotes', 'recuperation', 'competition', 'autre']
const ETATS: SeanceEtat[] = ['planifiee', 'en_cours', 'terminee', 'annulee']

interface Props {
  initial?: Partial<Seance>
  onSubmit: (data: Omit<Seance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

export function SeanceForm({ initial, onSubmit, onCancel, submitLabel = 'Enregistrer' }: Props) {
  const [nom,              setNom]              = useState(initial?.nom              ?? '')
  const [date,             setDate]             = useState(initial?.date             ?? new Date().toISOString().slice(0, 10))
  const [contenu,          setContenu]          = useState(initial?.contenu          ?? '')
  const [type,             setType]             = useState<SeanceType>(initial?.type ?? 'endurance')
  const [etat,             setEtat]             = useState<SeanceEtat>(initial?.etat ?? 'planifiee')
  const [saving,           setSaving]           = useState(false)
  const [error,            setError]            = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit({ nom, date, contenu, type, etat, commentaire_coach: initial?.commentaire_coach ?? '' })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-100 text-sm focus:outline-none focus:border-orange-500'
  const labelCls = 'block text-xs font-medium text-slate-400 mb-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Nom *</label>
        <input className={inputCls} value={nom} onChange={e => setNom(e.target.value)} required />
      </div>
      <div>
        <label className={labelCls}>Date *</label>
        <input type="date" className={inputCls} value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div>
        <label className={labelCls}>Type *</label>
        <select className={inputCls} value={type} onChange={e => setType(e.target.value as SeanceType)}>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>État</label>
        <select className={inputCls} value={etat} onChange={e => setEtat(e.target.value as SeanceEtat)}>
          {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls}>Contenu (allures, séries…)</label>
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={contenu}
          onChange={e => setContenu(e.target.value)}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
        >
          {saving ? 'Enregistrement…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2.5 rounded-lg transition-colors">
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
