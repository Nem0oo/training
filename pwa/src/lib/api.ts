import type { Seance, Stats, VMA, FCZone, PowerZone, SeanceRadar, RadarCumule, VolumePoint } from '../types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('auth_token')
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })
  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.dispatchEvent(new Event('auth-expired'))
    throw new Error('Session expirée')
  }
  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  return json.data as T
}

export const api = {
  auth: {
    login: (password: string) =>
      req<{ token: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  },
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
    // 3.1 — jette (409) si pas encore scorée ; le composant appelant décide
    // comment afficher cet état, voir components/SeanceRadar.tsx.
    radar: (id: string) => req<SeanceRadar>(`/seances/${id}/radar`),
    tags: () => req<string[]>('/seances/tags'),
  },
  radarCumule: {
    // 3.2 — jette (404) tant qu'aucune séance n'a été scorée.
    get: () => req<RadarCumule>('/radar-cumule'),
  },
  stats: {
    get: (weeks = 4) => req<Stats>(`/stats?weeks=${weeks}`),
    volume: (tag?: string) => req<VolumePoint[]>(`/stats/volume${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  },
  vma: {
    list:   ()                                              => req<VMA[]>('/vma'),
    create: (data: Pick<VMA, 'valeur' | 'date_test' | 'note'>) =>
      req<VMA>('/vma', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/vma/${id}`, { method: 'DELETE' }),
  },
  fcZones: {
    list:   ()                                                       => req<FCZone[]>('/fc-zones'),
    create: (data: Pick<FCZone, 'nom' | 'fc_min' | 'fc_max' | 'ordre'>) =>
      req<FCZone>('/fc-zones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<FCZone>) =>
      req<FCZone>(`/fc-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/fc-zones/${id}`, { method: 'DELETE' }),
  },
  powerZones: {
    list:   ()                                                              => req<PowerZone[]>('/power-zones'),
    create: (data: Pick<PowerZone, 'zone' | 'nom' | 'power_min' | 'power_max'>) =>
      req<PowerZone>('/power-zones', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<PowerZone>) =>
      req<PowerZone>(`/power-zones/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => req<void>(`/power-zones/${id}`, { method: 'DELETE' }),
  },
}
