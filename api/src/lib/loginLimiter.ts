// Limite les tentatives de login échouées par IP, en mémoire (un seul
// process API, un seul utilisateur : pas besoin de store partagé). Au-delà de
// maxFailures échecs dans la fenêtre, l'IP est refusée jusqu'à la fin de la
// fenêtre ; une connexion réussie remet son compteur à zéro.
export function createLoginLimiter({ maxFailures = 5, windowMs = 15 * 60_000 } = {}) {
  const failures = new Map<string, { count: number; resetAt: number }>()

  function entry(key: string, now: number) {
    const e = failures.get(key)
    if (e && e.resetAt <= now) { failures.delete(key); return undefined }
    return e
  }

  return {
    // Secondes à attendre si l'IP est bloquée, sinon 0.
    retryAfterSeconds(key: string, now = Date.now()): number {
      const e = entry(key, now)
      return e && e.count >= maxFailures ? Math.ceil((e.resetAt - now) / 1000) : 0
    },
    recordFailure(key: string, now = Date.now()) {
      const e = entry(key, now) ?? { count: 0, resetAt: now + windowMs }
      e.count++
      failures.set(key, e)
    },
    reset(key: string) { failures.delete(key) },
  }
}
