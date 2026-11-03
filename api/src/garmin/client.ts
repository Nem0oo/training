import type { GarminActivity } from '../scoring/types.js'

// Appel HTTP public vers l'API REST en lecture seule de garmin-gateway
// (service séparé, voir README), authentifié par la clé `REST_API_KEY` du
// gateway. Pas d'accès réseau Docker interne : les deux services sont
// déployés indépendamment. Erreurs typiques : activité inconnue ou pas encore
// synchronisée (404), clé invalide (401), erreur côté Garmin (502).
// GARMIN_BASE_URL et GARMIN_API_KEY sont lues à chaque appel.
export async function fetchGarminActivity(activityId: string): Promise<GarminActivity> {
  const baseUrl = process.env.GARMIN_BASE_URL
  const apiKey = process.env.GARMIN_API_KEY
  if (!baseUrl) {
    throw new Error('GARMIN_BASE_URL environment variable is required to fetch Garmin activities')
  }
  if (!apiKey) {
    throw new Error('GARMIN_API_KEY environment variable is required to fetch Garmin activities')
  }
  const res = await fetch(`${baseUrl}/api/v1/activities/${encodeURIComponent(activityId)}/series`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Échec de récupération de l'activité Garmin ${activityId} : HTTP ${res.status} ${body}`.trim())
  }
  return (await res.json()) as GarminActivity
}
