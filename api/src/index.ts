import express from 'express'
import cors from 'cors'
import seancesRouter from './routes/seances.js'
import statsRouter from './routes/stats.js'
import vmaRouter from './routes/vma.js'

const app = express()
const PORT = process.env.PORT ?? 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/seances', seancesRouter)
app.use('/api/stats', statsRouter)
app.use('/api/vma', vmaRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message })
})

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
