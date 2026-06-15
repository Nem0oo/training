import type { SeanceEtat } from '../types'

const colors: Record<SeanceEtat, string> = {
  planifiee: 'bg-slate-700 text-slate-300',
  en_cours:  'bg-yellow-900 text-yellow-300',
  terminee:  'bg-green-900 text-green-300',
  annulee:   'bg-red-900 text-red-400 line-through',
}

const labels: Record<SeanceEtat, string> = {
  planifiee: 'Planifiée',
  en_cours:  'En cours',
  terminee:  'Terminée',
  annulee:   'Annulée',
}

export function EtatBadge({ etat }: { etat: SeanceEtat }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[etat]}`}>
      {labels[etat]}
    </span>
  )
}
