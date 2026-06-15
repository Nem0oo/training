import type { Seance, Stats, VMA } from '../types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data as T
}

export const api = {
  seances: {
    list: (params: Record<string, string | number> = {}) => {
      const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
      return req<Seance[]>(`/seances${qs ? '?' + qs : ''}`)
    },
    get:    (id: string)                       => req<Seance>(`/seances/${id}`),
    create: (data: Omit<Seance, 'id' | 'created_at' | 'updated_at'>) =>
      req<Seance>('/seances', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Seance>) =>
      req<Seance>(`/seances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      req<void>(`/seances/${id}`, { method: 'DELETE' }),
  },
  stats: {
    get: (weeks = 4) => req<Stats>(`/stats?weeks=${weeks}`),
  },
  vma: {
    list:   ()                                              => req<VMA[]>('/vma'),
    create: (data: Pick<VMA, 'valeur' | 'date_test' | 'note'>) =>
      req<VMA>('/vma', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/vma/${id}`, { method: 'DELETE' }),
  },
}
