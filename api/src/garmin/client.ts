import type { GarminActivity } from '../scoring/types.js'

const GARMIN_BASE_URL = process.env.GARMIN_BASE_URL
const GARMIN_API_KEY = process.env.GARMIN_API_KEY

// Appel HTTP public vers garmin-bridge (service séparé, voir README) — pas
// d'accès réseau Docker interne, les deux services sont déployés
// indépendamment. Erreurs typiques : activité pas encore synchronisée côté
// Garmin Connect (404), ou clé API invalide (401).
export async function fetchGarminActivity(activityId: string): Promise<GarminActivity> {
  if (!GARMIN_BASE_URL) {
    throw new Error('GARMIN_BASE_URL environment variable is required to fetch Garmin activities')
  }
  if (!GARMIN_API_KEY) {
    throw new Error('GARMIN_API_KEY environment variable is required to fetch Garmin activities')
  }
  const res = await fetch(`${GARMIN_BASE_URL}/activities/${encodeURIComponent(activityId)}/json`, {
    headers: { Authorization: `Bearer ${GARMIN_API_KEY}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Échec de récupération de l'activité Garmin ${activityId} : HTTP ${res.status} ${body}`.trim())
  }
  return (await res.json()) as GarminActivity
}
