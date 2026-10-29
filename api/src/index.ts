import { createApp } from './app.js'

const PORT = process.env.PORT ?? 3001
const API_PASSWORD = process.env.API_PASSWORD
const JWT_SECRET = process.env.JWT_SECRET
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY

if (!API_PASSWORD || !JWT_SECRET) {
  console.error('API_PASSWORD and JWT_SECRET environment variables are required')
  process.exit(1)
}
if (!INTERNAL_API_KEY) {
  console.error('INTERNAL_API_KEY environment variable is required')
  process.exit(1)
}

createApp({ apiPassword: API_PASSWORD, jwtSecret: JWT_SECRET, internalApiKey: INTERNAL_API_KEY })
  .listen(PORT, () => {
    console.log(`API running on http://localhost:${PORT}`)
  })
