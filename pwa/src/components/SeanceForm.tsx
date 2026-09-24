import { useState } from 'react'
import type { Seance, SeanceType, SeanceEtat, SeanceCategorie, NatureEffort, BlocPrescrit, ZoneCible } from '../types'

const TYPES: SeanceType[] = ['endurance', 'fractionne', 'cotes', 'recuperation', 'competition', 'autre']
const ETATS: SeanceEtat[] = ['planifiee', 'en_cours', 'terminee', 'annulee']
const CATEGORIES: SeanceCategorie[] = ['cardio', 'renforcement', 'competition', 'autre']
const NATURES_EFFORT: NatureEffort[] = ['non_applicable', 'continu', 'repetition_courte']
const ZONES: ZoneCible[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']

interface Props {
  initial?: Partial<Seance>
  onSubmit: (data: Omit<Seance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

export function SeanceForm({ initial, onSubmit, onCancel, submitLabel = 'Enregistrer' }: Props) {
  const [nom,                setNom]                = useState(initial?.nom                ?? '')
  const [date,                setDate]                = useState(initial?.date              ?? new Date().toISOString().slice(0, 10))
  const [contenu,             setContenu]             = useState(initial?.contenu           ?? '')
  const [type,                setType]                = useState<SeanceType>(initial?.type  ?? 'endurance')
  const [etat,                setEtat]                = useState<SeanceEtat>(initial?.etat  ?? 'planifiee')
  const [categorie,           setCategorie]           = useState<SeanceCategorie>(initial?.categorie ?? 'autre')
  const [natureEffort,        setNatureEffort]        = useState<NatureEffort>(initial?.nature_effort ?? 'non_applicable')
  const [garminActivityId,    setGarminActivityId]    = useState(initial?.garmin_activity_id ?? '')
  const [conditionSignalee,   setConditionSignalee]   = useState(initial?.condition_signalee ?? false)
  const [blocsPrescrits,      setBlocsPrescrits]      = useState<BlocPrescrit[]>(initial?.blocs_prescrits ?? [])
  const [tagsInput,           setTagsInput]           = useState((initial?.tags ?? []).join(', '))
  const [saving,              setSaving]              = useState(false)
  const [error,                setError]               = useState('')

  const natureEffortPertinente = categorie === 'cardio' || categorie === 'competition'

  function addBloc() {
    setBlocsPrescrits(prev => [...prev, { zone_cible: 'Z1', duree_min: 10 }])
  }

  function updateBloc(index: number, patch: Partial<BlocPrescrit>) {
    setBlocsPrescrits(prev => prev.map((b, i) => i === index ? { ...b, ...patch } : b))
  }

  function removeBloc(index: number) {
    setBlocsPrescrits(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
      await onSubmit({
        nom, date, contenu, type, etat,
        commentaire_coach: initial?.commentaire_coach ?? '',
        categorie,
        nature_effort: natureEffort,
        garmin_activity_id: garminActivityId || null,
        condition_signalee: conditionSignalee,
        blocs_prescrits: blocsPrescrits.length > 0 ? blocsPrescrits : null,
        effet_reel_brut: initial?.effet_reel_brut ?? null,
        conformite: initial?.conformite ?? null,
        tags,
        // Dérivés côté serveur (voir types.ts) — jamais éditables ici,
        // seulement préservés pour satisfaire le type Seance complet.
        distance_prevue_km: initial?.distance_prevue_km ?? null,
        distance_realisee_km: initial?.distance_realisee_km ?? null,
      })
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
        <p className="text-xs text-slate-500 mt-1">Champ historique, conservé pour le passé. Utilise catégorie ci-dessous pour le scoring.</p>
      </div>
      <div>
        <label className={labelCls}>État</label>
        <select className={inputCls} value={etat} onChange={e => setEtat(e.target.value as SeanceEtat)}>
          {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div className={natureEffortPertinente ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <label className={labelCls}>Catégorie</label>
          <select
            className={inputCls}
            value={categorie}
            onChange={e => {
              const next = e.target.value as SeanceCategorie
              setCategorie(next)
              const pertinente = next === 'cardio' || next === 'competition'
              if (!pertinente) setNatureEffort('non_applicable')
              else if (natureEffort === 'non_applicable') setNatureEffort('continu')
            }}
          >
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {natureEffortPertinente && (
          <div>
            <label className={labelCls}>Nature de l'effort</label>
            <select className={inputCls} value={natureEffort} onChange={e => setNatureEffort(e.target.value as NatureEffort)}>
              {NATURES_EFFORT.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        )}
      </div>
      {natureEffortPertinente && natureEffort === 'non_applicable' && (
        <p className="text-xs text-amber-400 -mt-2">
          Sans nature de l'effort (continu / répétition courte), le moteur de scoring ne pourra pas répartir précisément l'effet des zones Z4/Z5.
        </p>
      )}

      <div>
        <label className={labelCls}>ID activité Garmin</label>
        <input
          className={inputCls}
          value={garminActivityId}
          onChange={e => setGarminActivityId(e.target.value)}
          placeholder="ex: 12345678901"
        />
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={conditionSignalee}
          onChange={e => setConditionSignalee(e.target.checked)}
          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-slate-900"
        />
        <span className="text-sm text-slate-300">Condition signalée (exclut cette séance du scoring)</span>
      </label>

      <div>
        <label className={labelCls}>Contenu (allures, séries…)</label>
        <textarea
          className={`${inputCls} h-28 resize-none`}
          value={contenu}
          onChange={e => setContenu(e.target.value)}
        />
      </div>

      <div>
        <label className={labelCls}>Tags</label>
        <input
          className={inputCls}
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="ex: trail, reprise, chaleur"
        />
        <p className="text-xs text-slate-500 mt-1">Séparés par des virgules — utilisés pour filtrer le graphe de volume dans Stats.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className={labelCls}>Blocs prescrits</label>
          <button type="button" onClick={addBloc} className="text-xs text-orange-400 font-medium hover:text-orange-300">
            + Ajouter un bloc
          </button>
        </div>
        {blocsPrescrits.length === 0 ? (
          <p className="text-xs text-slate-500">Aucun bloc prescrit — utilisé pour comparer réalisé vs prescrit par zone.</p>
        ) : (
          <div className="space-y-2">
            {blocsPrescrits.map((bloc, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-lg p-2">
                <select
                  className="bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                  value={bloc.zone_cible}
                  onChange={e => updateBloc(i, { zone_cible: e.target.value as ZoneCible })}
                >
                  {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <input
                  type="number"
                  min="1"
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                  value={bloc.duree_min}
                  onChange={e => updateBloc(i, { duree_min: Number(e.target.value) })}
                  placeholder="durée (min)"
                />
                <input
                  type="number"
                  min="1"
                  className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-slate-100 text-sm focus:outline-none focus:border-orange-500"
                  value={bloc.repetitions ?? ''}
                  onChange={e => updateBloc(i, { repetitions: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="reps"
                />
                <button type="button" onClick={() => removeBloc(i)} className="text-slate-500 hover:text-red-400 p-1" aria-label="Supprimer le bloc">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <p className="text-xs text-slate-500">Répétitions = informatif seulement, non utilisé par le calcul de conformité.</p>
          </div>
        )}
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
