import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Seance } from '../types'
import { SeanceCard } from '../components/SeanceCard'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function getWeekDates(offset: number): Date[] {
  const today = new Date()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function toISO(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Planning() {
  const [weekOffset, setWeekOffset] = useState(0)
  const [seances, setSeances] = useState<Seance[]>([])
  const navigate = useNavigate()
  const days = getWeekDates(weekOffset)

  useEffect(() => {
    api.seances.list({ from: toISO(days[0]), to: toISO(days[6]), limit: 100 })
      .then(setSeances)
      .catch(console.error)
  }, [weekOffset])

  const byDate = (date: Date) =>
    seances.filter(s => s.date === toISO(date))

  const label = weekOffset === 0
    ? 'Cette semaine'
    : weekOffset === -1
    ? 'Semaine dernière'
    : weekOffset === 1
    ? 'Semaine prochaine'
    : `Sem. ${days[0].toLocaleDateString('fr', { day: '2-digit', month: 'short' })}`

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <button onClick={() => setWeekOffset(w => w - 1)} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-100">{label}</p>
            <p className="text-xs text-slate-400">
              {days[0].toLocaleDateString('fr', { day: '2-digit', month: 'short' })} – {days[6].toLocaleDateString('fr', { day: '2-digit', month: 'short' })}
            </p>
          </div>
          <button onClick={() => setWeekOffset(w => w + 1)} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-3 space-y-2">
        {days.map((day, i) => {
          const items = byDate(day)
          const isToday = toISO(day) === toISO(new Date())
          return (
            <div key={i}>
              <div
                className="flex items-center gap-3 py-2 cursor-pointer"
                onClick={() => navigate(`/seances/new?date=${toISO(day)}`)}
              >
                <div className={`w-10 text-center rounded-lg py-1 ${isToday ? 'bg-orange-500' : 'bg-slate-800'}`}>
                  <p className="text-xs text-slate-300">{DAYS[i]}</p>
                  <p className={`text-sm font-bold ${isToday ? 'text-white' : 'text-slate-100'}`}>
                    {day.getDate()}
                  </p>
                </div>
                {items.length === 0 && (
                  <p className="text-xs text-slate-600 italic">Repos · tap pour ajouter</p>
                )}
              </div>
              {items.length > 0 && (
                <div className="ml-13 space-y-2 pl-13" style={{ paddingLeft: '3.25rem' }}>
                  {items.map(s => <SeanceCard key={s.id} seance={s} />)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
