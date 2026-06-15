import { useNavigate } from 'react-router-dom'
import type { Seance } from '../types'
import { TypeBadge } from './TypeBadge'
import { EtatBadge } from './EtatBadge'

export function SeanceCard({ seance }: { seance: Seance }) {
  const navigate = useNavigate()
  return (
    <div
      onClick={() => navigate(`/seances/${seance.id}`)}
      className="bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-700 transition-colors border border-slate-700"
    >
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
  )
}
