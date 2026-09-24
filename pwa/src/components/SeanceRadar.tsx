import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { toChartData } from '../lib/axes'
import { RadarChart } from './RadarChart'
import type { EffetReelBrut, Seance } from '../types'

// Couleur interpolée en continu autour de la cible (100%) plutôt qu'un
// statut à 3 paliers — vert pile sur la cible, rouge à ±50pts et au-delà,
// transition lisse entre les deux.
function zoneColor(ratioPct: number): string {
  const distance = Math.abs(ratioPct - 100)
  const t = Math.min(distance / 50, 1)
  const hue = 142 * (1 - t)
  return `hsl(${hue}, 70%, 45%)`
}

// Point 6 de la spec UI complémentaire : affichage dérivé de l'état des
// données, pas de champ de statut en base.
//   - garmin_activity_id vide -> rien
//   - garmin_activity_id + effet_reel_brut présent -> radar (3.1) + conformité (2.2)
//   - garmin_activity_id sans effet_reel_brut -> indicateur simple, pas de
//     diagnostic de cause (échec Garmin, calcul pas encore lancé, etc. — non
//     distingués, voir spec)
export function SeanceRadar({ seance }: { seance: Seance }) {
  const [proportions, setProportions] = useState<EffetReelBrut | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setProportions(null)
    setError(false)
    if (!seance.effet_reel_brut) return
    api.seances.radar(seance.id)
      .then(r => setProportions(r.proportions))
      .catch(() => setError(true))
  }, [seance.id, seance.effet_reel_brut])

  if (!seance.garmin_activity_id || seance.condition_signalee) return null

  if (!seance.effet_reel_brut) {
    return (
      <div className="bg-slate-800 rounded-xl p-4">
        <p className="text-sm text-amber-400">
          Calcul non disponible — vérifiez que l'activité Garmin est bien synchronisée, ou videz/remettez l'ID pour réessayer.
        </p>
      </div>
    )
  }

  const chartData = proportions ? toChartData(proportions) : null
  const maxValue = chartData ? Math.max(...chartData.map(d => d.value), 0.01) : 1

  return (
    <div className="bg-slate-800 rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-medium text-orange-400 uppercase tracking-wide">Radar de la séance</h2>

      {chartData ? (
        <div className="flex justify-center py-2">
          <RadarChart data={chartData} maxValue={maxValue} />
        </div>
      ) : error ? (
        <p className="text-sm text-slate-500">Impossible de charger le radar pour l'instant.</p>
      ) : (
        <p className="text-sm text-slate-500">Chargement…</p>
      )}

      {seance.conformite && (
        <div className="pt-2 border-t border-slate-700 space-y-2">
          <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Conformité</h3>
          {seance.conformite.par_zone.length > 0 && (
            <div className="space-y-2">
              {seance.conformite.par_zone.map(z => {
                const pct = z.ratio_pct
                const fillPct = pct !== null ? Math.min(Math.max(pct, 0), 150) / 150 * 100 : 100
                return (
                  <div key={z.zone} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-medium text-slate-300">{z.zone}</span>
                      <span className="text-slate-400">
                        {Math.round(z.temps_realise_min)}/{Math.round(z.temps_prescrit_min)}min
                        {pct !== null && ` · ${Math.round(pct)}%`}
                      </span>
                    </div>
                    <div className="relative h-1.5 rounded-full bg-slate-700 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${fillPct}%`, backgroundColor: pct !== null ? zoneColor(pct) : '#475569' }}
                      />
                      {pct !== null && (
                        <div className="absolute top-0 bottom-0 w-px bg-slate-400/60" style={{ left: `${100 / 150 * 100}%` }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {seance.conformite.duree_conformite_pct !== null && (
            <p className="text-xs text-slate-400">
              Durée : {Math.round(seance.conformite.duree_totale_realisee_min)} / {Math.round(seance.conformite.duree_totale_prescrite_min)} min
              {' '}
              <span style={{ color: zoneColor(seance.conformite.duree_conformite_pct) }}>
                ({Math.round(seance.conformite.duree_conformite_pct)}%)
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
