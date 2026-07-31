import { Link } from 'react-router-dom'

const ITEMS = [
  {
    to: '/vma',
    label: 'VMA & Allures',
    description: 'Tests VMA et zones d\'allure',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    to: '/fc-zones',
    label: 'Zones de FC',
    description: 'Zones de fréquence cardiaque',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.172 5.172a4 4 0 015.656 0L12 8.343l3.172-3.171a4 4 0 115.656 5.656L12 19.657l-8.828-8.829a4 4 0 010-5.656z" />
      </svg>
    ),
  },
]

export function ParametresPage() {
  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      <header className="sticky top-0 bg-slate-900 border-b border-slate-700 px-4 py-3 z-10">
        <div className="max-w-lg mx-auto">
          <h1 className="text-lg font-semibold text-slate-100">Réglages</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="bg-slate-800 rounded-xl overflow-hidden divide-y divide-slate-700/50">
          {ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/30 transition-colors"
            >
              <span className="text-orange-400">{item.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-100">{item.label}</div>
                <div className="text-xs text-slate-400">{item.description}</div>
              </div>
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
