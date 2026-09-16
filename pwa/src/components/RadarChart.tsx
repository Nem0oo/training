interface RadarChartProps {
  data: { label: string; value: number }[]
  maxValue: number
  size?: number
  color?: string
}

// Radar/étoile SVG générique — pas de lib de graphique dans ce projet, un
// composant maison pour 7 axes reste simple. `maxValue` est fourni par
// l'appelant : le radar par séance (proportions) et le radar cumulé (échelle
// EMA) ont chacun leur propre échelle, jamais partagée — voir SeanceRadar.tsx
// et Stats.tsx qui appellent ce composant séparément avec des données et une
// échelle indépendantes.
export function RadarChart({ data, maxValue, size = 280, color = '#f97316' }: RadarChartProps) {
  const center = size / 2
  const radius = size / 2 - 60
  const n = data.length
  const angleFor = (i: number) => (-90 + (360 / n) * i) * (Math.PI / 180)

  const pointAt = (i: number, value: number) => {
    const r = maxValue > 0 ? (Math.max(value, 0) / maxValue) * radius : 0
    const a = angleFor(i)
    return { x: center + r * Math.cos(a), y: center + r * Math.sin(a) }
  }

  const dataPoints = data.map((d, i) => pointAt(i, d.value))
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(' ')
  const gridLevels = [0.25, 0.5, 0.75, 1]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
      {gridLevels.map(level => {
        const pts = data.map((_, i) => {
          const a = angleFor(i)
          const r = radius * level
          return `${center + r * Math.cos(a)},${center + r * Math.sin(a)}`
        }).join(' ')
        return <polygon key={level} points={pts} fill="none" stroke="#334155" strokeWidth={1} />
      })}
      {data.map((_, i) => {
        const a = angleFor(i)
        return (
          <line
            key={i}
            x1={center} y1={center}
            x2={center + radius * Math.cos(a)} y2={center + radius * Math.sin(a)}
            stroke="#334155" strokeWidth={1}
          />
        )
      })}
      <polygon points={polygonPoints} fill={color} fillOpacity={0.25} stroke={color} strokeWidth={2} />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} />)}
      {data.map((d, i) => {
        const a = angleFor(i)
        const labelR = radius + 14
        const x = center + labelR * Math.cos(a)
        const y = center + labelR * Math.sin(a)
        const cos = Math.cos(a)
        const anchor = cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle'
        return (
          <text key={i} x={x} y={y} fontSize={10} fill="#94a3b8" textAnchor={anchor} dominantBaseline="middle">
            {d.label}
          </text>
        )
      })}
    </svg>
  )
}
