import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import seancesRouter from './routes/seances.js'
import statsRouter from './routes/stats.js'
import vmaRouter from './routes/vma.js'
import fcZonesRouter from './routes/fc_zones.js'

const app = express()
const PORT = process.env.PORT ?? 3001
const API_PASSWORD = process.env.API_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET

if (!API_PASSWORD || !JWT_SECRET) {
  console.error('API_PASSWORD and JWT_SECRET environment variables are required')
  process.exit(1)
}

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body ?? {}
  if (password !== API_PASSWORD) {
    res.status(401).json({ error: 'Mot de passe incorrect' })
    return
  }
  const token = jwt.sign({}, JWT_SECRET!, { expiresIn: '30d' })
  res.json({ data: { token } })
})

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Non authentifié' })
    return
  }
  try {
    jwt.verify(auth.slice(7), JWT_SECRET!)
    next()
  } catch {
    res.status(401).json({ error: 'Token invalide ou expiré' })
  }
}

app.use('/api/seances', requireAuth, seancesRouter)
app.use('/api/stats', requireAuth, statsRouter)
app.use('/api/vma', requireAuth, vmaRouter)
app.use('/api/fc-zones', requireAuth, fcZonesRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
