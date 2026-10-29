// Fuseau de l'athlète (nom IANA, variable TZ — voir .env.example) : les
// bornes « aujourd'hui » / « cette semaine » sont calculées dans ce fuseau.
// Sans TZ, le conteneur tourne en UTC et le début de semaine est décalé du
// décalage horaire local.
export const APP_TIME_ZONE = process.env.TZ || 'UTC'

// Date du jour (YYYY-MM-DD) dans le fuseau donné.
export function localDate(now: Date, timeZone = APP_TIME_ZONE): string {
  return now.toLocaleDateString('sv-SE', { timeZone })
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Bornes des stats : [since, today] pour les N dernières semaines,
// [monday, nextMonday[ pour la semaine en cours.
export function statsPeriod(now: Date, weeks: number, timeZone = APP_TIME_ZONE) {
  const today = localDate(now, timeZone)
  const dayOfWeek = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 // 0 = lundi
  const monday = addDays(today, -dayOfWeek)
  return {
    today,
    since: addDays(today, -weeks * 7),
    monday,
    nextMonday: addDays(monday, 7),
  }
}
