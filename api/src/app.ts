import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import { createHash, timingSafeEqual } from 'crypto'
import { createLoginLimiter } from './lib/loginLimiter.js'
import seancesRouter from './routes/seances.js'
import statsRouter from './routes/stats.js'
import vmaRouter from './routes/vma.js'
import fcZonesRouter from './routes/fc_zones.js'
import powerZonesRouter from './routes/power_zones.js'
import radarCumuleRouter from './routes/radar_cumule.js'

export interface AppSecrets {
  apiPassword: string
  jwtSecret: string
  // Secret partagé avec le service training-mcp, pour les appels serveur-à-serveur
  // (mcp proxie ses outils vers l'API — voir mcp/src/tools.ts).
  internalApiKey: string
}

// Comparaison à temps constant (hash d'abord pour avoir deux buffers de même
// longueur), pour ne pas révéler par le temps de réponse combien de
// caractères d'un secret sont justes.
function safeEqual(provided: unknown, expected: string): boolean {
  if (typeof provided !== 'string') return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

// Construit l'app Express sans l'écouter, pour pouvoir la tester (voir
// routes/seances.test.ts). index.ts vérifie l'environnement puis appelle listen.
export function createApp({ apiPassword, jwtSecret, internalApiKey }: AppSecrets) {
  const app = express()
  const loginLimiter = createLoginLimiter()

  app.use(cors())
  app.use(express.json())

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

  app.post('/api/auth/login', (req, res) => {
    // IP du client transmise par nginx (pwa/nginx.conf) ; l'API n'est pas
    // publiée directement, tout le trafic externe passe par nginx.
    const clientIp = (req.headers['x-real-ip'] as string | undefined) ?? req.ip ?? 'unknown'
    const retryAfter = loginLimiter.retryAfterSeconds(clientIp)
    if (retryAfter > 0) {
      res.setHeader('Retry-After', String(retryAfter))
      res.status(429).json({ error: 'Trop de tentatives échouées, réessaie plus tard' })
      return
    }
    const { password } = req.body ?? {}
    if (!safeEqual(password, apiPassword)) {
      loginLimiter.recordFailure(clientIp)
      res.status(401).json({ error: 'Mot de passe incorrect' })
      return
    }
    loginLimiter.reset(clientIp)
    const token = jwt.sign({}, jwtSecret, { expiresIn: '30d' })
    res.json({ data: { token } })
  })

  function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    // Appel serveur-à-serveur depuis training-mcp (pas de session utilisateur).
    const internalKey = req.headers['x-internal-key']
    if (internalKey && safeEqual(internalKey, internalApiKey)) {
      next()
      return
    }

    const auth = req.headers.authorization
    if (!auth?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Non authentifié' })
      return
    }
    try {
      jwt.verify(auth.slice(7), jwtSecret)
      next()
    } catch {
      res.status(401).json({ error: 'Token invalide ou expiré' })
    }
  }

  app.use('/api/seances', requireAuth, seancesRouter)
  app.use('/api/stats', requireAuth, statsRouter)
  app.use('/api/vma', requireAuth, vmaRouter)
  app.use('/api/fc-zones', requireAuth, fcZonesRouter)
  app.use('/api/power-zones', requireAuth, powerZonesRouter)
  app.use('/api/radar-cumule', requireAuth, radarCumuleRouter)

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err)
    res.status(500).json({ error: err.message })
  })

  return app
}
