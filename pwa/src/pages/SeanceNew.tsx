import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { SeanceForm } from '../components/SeanceForm'
import type { Seance } from '../types'

export function SeanceNew() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const dateParam = params.get('date') ?? undefined

  async function handleSubmit(data: Omit<Seance, 'id' | 'created_at' | 'updated_at'>) {
    const created = await api.seances.create(data)
    navigate(`/seances/${created.id}`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-slate-100">Nouvelle séance</h1>
        </div>
      </header>
      <div className="max-w-lg mx-auto px-4 py-4">
        <SeanceForm
          initial={{ date: dateParam }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(-1)}
          submitLabel="Créer la séance"
        />
      </div>
    </div>
  )
}
