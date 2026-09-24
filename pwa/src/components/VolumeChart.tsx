import type { VolumePoint } from '../types'

interface VolumeChartProps {
  data: VolumePoint[]
  width?: number
  height?: number
}

// Ligne double SVG maison (pas de lib de graphique dans ce projet, voir
// RadarChart.tsx) — cumul prévu (pointillé orange) vs réalisé (plein vert)
// depuis la première semaine du plan. Une semaine sans donnée réalisée
// n'ajoute rien au cumul, donc la courbe réalisée reste à plat tant qu'une
// séance n'a pas été scorée (voir routes/stats.ts) — c'est ce qui rend
// l'écart avance/retard visible.
export function VolumeChart({ data, width = 600, height = 220 }: VolumeChartProps) {
  const padding = { top: 10, right: 10, bottom: 24, left: 40 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  if (data.length === 0) {
    return <p className="text-sm text-slate-500 py-8 text-center">Aucune donnée de volume pour l'instant.</p>
  }

  const maxKm = Math.max(...data.map(d => Math.max(d.cumule_prevu_km, d.cumule_realise_km)), 1)
  const xFor = (i: number) => data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2
  const yFor = (km: number) => innerH - (km / maxKm) * innerH

  const pathFor = (key: 'cumule_prevu_km' | 'cumule_realise_km') =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(d[key])}`).join(' ')

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxKm * f))
  // Un label toutes les ~6 semaines pour rester lisible sur un plan de ~50 semaines.
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <div className="space-y-2">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {yTicks.map(km => (
            <g key={km}>
              <line x1={0} y1={yFor(km)} x2={innerW} y2={yFor(km)} stroke="#334155" strokeWidth={1} />
              <text x={-8} y={yFor(km)} fontSize={10} fill="#94a3b8" textAnchor="end" dominantBaseline="middle">{km}</text>
            </g>
          ))}
          {data.map((d, i) => (i % xLabelEvery === 0) && (
            <text key={d.semaine} x={xFor(i)} y={innerH + 16} fontSize={9} fill="#94a3b8" textAnchor="middle">
              {new Date(d.semaine).toLocaleDateString('fr', { day: '2-digit', month: '2-digit' })}
            </text>
          ))}
          <path d={pathFor('cumule_prevu_km')} fill="none" stroke="#f97316" strokeWidth={2} strokeDasharray="5 4" />
          <path d={pathFor('cumule_realise_km')} fill="none" stroke="#22c55e" strokeWidth={2} />
        </g>
      </svg>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-orange-500" style={{ borderTop: '2px dashed #f97316', background: 'none' }} />
          Prévu
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-green-500" />
          Réalisé
        </span>
      </div>
    </div>
  )
}
