import { useState } from 'react'
import { api } from '../lib/api'

interface Props {
  onLogin: (token: string) => void
}

export function Login({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { token } = await api.auth.login(password)
      onLogin(token)
    } catch {
      setError('Mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-xs">
        <h1 className="text-2xl font-bold text-white text-center mb-8">Coach Running</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            className="w-full px-4 py-3 rounded-lg bg-slate-800 text-white placeholder-slate-500 border border-slate-700 focus:outline-none focus:border-orange-500"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg bg-orange-500 text-white font-semibold disabled:opacity-50"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
