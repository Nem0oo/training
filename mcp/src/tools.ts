// Le serveur MCP n'a plus d'accès direct à la base SQLite : il proxie tous
// les appels vers le service `api`, qui reste l'unique propriétaire de
// l'écriture (et, à terme, du déclenchement du moteur de scoring — voir
// étape 4 de la spec scoring séances). Ça garantit que MCP et UI passent
// par exactement le même code serveur.
const API_BASE = process.env.API_INTERNAL_URL ?? 'http://api:3001'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY

if (!INTERNAL_API_KEY) {
  console.error('INTERNAL_API_KEY environment variable is required')
  process.exit(1)
}

async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Key': INTERNAL_API_KEY!,
      ...options?.headers,
    },
  })
  if (res.status === 204) return undefined as T
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? `API error: HTTP ${res.status}`)
  return json.data as T
}

// Les ids de séance sont des UUID (générés par l'API ou import_seances.py).
// Tout autre format est refusé avant l'appel : sans ça, un id comme
// "../power-zones/<id>" était résolu par fetch vers une autre route de l'API,
// avec la clé interne (accès à des routes que le MCP n'expose pas).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function seancePath(id: string): string {
  if (!UUID_RE.test(id)) throw new Error(`id invalide (UUID attendu) : ${id}`)
  return `/api/seances/${encodeURIComponent(id)}`
}

export function listSeances(params: {
  from?: string
  to?: string
  type?: string
  etat?: string
  limit?: number
  order?: 'asc' | 'desc'
}) {
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.type) qs.set('type', params.type)
  if (params.etat) qs.set('etat', params.etat)
  if (params.limit) qs.set('limit', String(params.limit))
  // Plus récentes d'abord par défaut : sans filtre de date, l'ordre croissant
  // renvoyait les 50 premières séances du plan plutôt que l'actualité.
  qs.set('order', params.order ?? 'desc')
  const query = qs.toString()
  return apiRequest(`/api/seances${query ? '?' + query : ''}`)
}

export async function getSeance(id: string) {
  return apiRequest(seancePath(id))
}

export function listTags() {
  return apiRequest('/api/seances/tags')
}

export function createSeance(data: {
  nom: string
  date: string
  contenu?: string
  type: string
  etat?: string
  commentaire_coach?: string
  condition_signalee?: boolean
  garmin_activity_id?: string
  categorie?: string
  nature_effort?: string
  blocs_prescrits?: unknown
  tags?: string[]
}) {
  return apiRequest('/api/seances', { method: 'POST', body: JSON.stringify(data) })
}

export async function updateSeance(id: string, data: {
  nom?: string
  date?: string
  contenu?: string
  type?: string
  etat?: string
  commentaire_coach?: string
  condition_signalee?: boolean
  garmin_activity_id?: string
  categorie?: string
  nature_effort?: string
  blocs_prescrits?: unknown
  tags?: string[]
}) {
  return apiRequest(seancePath(id), { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteSeance(id: string) {
  return apiRequest(seancePath(id), { method: 'DELETE' }).then(() => ({ success: true }))
}

export function getStats(weeks?: number) {
  return apiRequest(`/api/stats${weeks ? `?weeks=${weeks}` : ''}`)
}

export function getVolume(tag?: string) {
  return apiRequest(`/api/stats/volume${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`)
}

export function listFcZones() {
  return apiRequest('/api/fc-zones')
}

export function listPowerZones() {
  return apiRequest('/api/power-zones')
}

// 3.1 — radar par séance (proportions internes, échelle propre à la séance).
export async function getSeanceRadar(id: string) {
  return apiRequest(`${seancePath(id)}/radar`)
}

// 3.2 — radar cumulé (état de forme global, échelle EMA — jamais la même
// échelle que le radar par séance, ne pas les confondre côté appelant).
export function getRadarCumule() {
  return apiRequest('/api/radar-cumule')
}
