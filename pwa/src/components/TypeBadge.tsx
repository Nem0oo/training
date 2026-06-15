import type { SeanceType } from '../types'

const colors: Record<SeanceType, string> = {
  endurance:   'bg-blue-900 text-blue-300',
  fractionne:  'bg-red-900 text-red-300',
  cotes:       'bg-orange-900 text-orange-300',
  recuperation:'bg-green-900 text-green-300',
  competition: 'bg-purple-900 text-purple-300',
  autre:       'bg-slate-700 text-slate-300',
}

const labels: Record<SeanceType, string> = {
  endurance:   'Endurance',
  fractionne:  'Fractionné',
  cotes:       'Côtes',
  recuperation:'Récup',
  competition: 'Compét',
  autre:       'Autre',
}

export function TypeBadge({ type }: { type: SeanceType }) {
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[type]}`}>
      {labels[type]}
    </span>
  )
}
