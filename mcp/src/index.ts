import { FastMCP, UserError } from 'fastmcp'
import { z } from 'zod'
import {
  listSeances,
  getSeance,
  createSeance,
  updateSeance,
  deleteSeance,
  getStats,
  listFcZones,
} from './tools.js'

const PORT = Number(process.env.PORT ?? 3002)
const API_KEY = process.env.MCP_API_KEY

if (!API_KEY) {
  console.error('MCP_API_KEY environment variable is required')
  process.exit(1)
}

const seanceType = z.enum(['endurance', 'fractionne', 'cotes', 'recuperation', 'competition', 'autre'])
const seanceEtat = z.enum(['planifiee', 'en_cours', 'terminee', 'annulee'])

function run<T>(fn: () => T): T {
  try {
    return fn()
  } catch (err) {
    throw new UserError((err as Error).message)
  }
}

const server = new FastMCP({
  name: 'coach-running',
  version: '1.0.0',
  health: { enabled: true, path: '/health' },
  authenticate: async (request) => {
    const fromHeader = request.headers['x-api-key'] as string | undefined
    const authHeader = request.headers['authorization'] as string | undefined
    const fromBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
    const url = new URL(request.url ?? '', 'http://localhost')
    const fromQuery = url.searchParams.get('api_key') ?? undefined
    const provided = fromHeader ?? fromBearer ?? fromQuery

    if (!provided || provided !== API_KEY) {
      throw new Response(null, { status: 401, statusText: 'Unauthorized — clé API invalide ou absente' })
    }
    return { apiKey: provided }
  },
})

server.addTool({
  name: 'list_seances',
  description: "Liste les séances d'entraînement avec filtres optionnels. Sans le filtre 'etat', retourne les séances de tous les états (planifiées, en cours, terminées, annulées).",
  parameters: z.object({
    from: z.string().describe('Date de début ISO (YYYY-MM-DD)').optional(),
    to: z.string().describe('Date de fin ISO (YYYY-MM-DD)').optional(),
    type: seanceType.optional(),
    etat: seanceEtat.describe("Filtre optionnel par état. Omettre ce champ pour récupérer les séances de tous les états.").optional(),
    limit: z.number().describe('Nombre max de résultats (défaut 50)').optional(),
  }),
  execute: async (args) => JSON.stringify(run(() => listSeances(args)), null, 2),
})

server.addTool({
  name: 'get_seance',
  description: "Récupère le détail d'une séance par son id",
  parameters: z.object({ id: z.string() }),
  execute: async (args) => JSON.stringify(run(() => getSeance(args.id)), null, 2),
})

server.addTool({
  name: 'create_seance',
  description: "Crée une nouvelle séance d'entraînement",
  parameters: z.object({
    nom: z.string(),
    date: z.string().describe('YYYY-MM-DD'),
    contenu: z.string().describe('Description détaillée (allures, séries…)').optional(),
    type: seanceType,
    etat: seanceEtat.optional(),
    commentaire_coach: z.string().describe('Commentaire du coach sur la séance').optional(),
  }),
  execute: async (args) => JSON.stringify(run(() => createSeance(args)), null, 2),
})

server.addTool({
  name: 'update_seance',
  description: 'Met à jour une séance existante (champs partiels acceptés)',
  parameters: z.object({
    id: z.string(),
    nom: z.string().optional(),
    date: z.string().optional(),
    contenu: z.string().optional(),
    type: seanceType.optional(),
    etat: seanceEtat.optional(),
    commentaire_coach: z.string().describe('Commentaire du coach sur la séance').optional(),
  }),
  execute: async ({ id, ...data }) => JSON.stringify(run(() => updateSeance(id, data)), null, 2),
})

server.addTool({
  name: 'delete_seance',
  description: 'Supprime une séance',
  parameters: z.object({ id: z.string() }),
  execute: async (args) => JSON.stringify(run(() => deleteSeance(args.id)), null, 2),
})

server.addTool({
  name: 'get_stats',
  description: "Statistiques d'entraînement sur N semaines",
  parameters: z.object({
    weeks: z.number().describe('Nombre de semaines à analyser (défaut 4)').optional(),
  }),
  execute: async (args) => JSON.stringify(run(() => getStats(args.weeks)), null, 2),
})

server.addTool({
  name: 'list_fc_zones',
  description: "Liste les zones de fréquence cardiaque définies par l'utilisateur (lecture seule)",
  execute: async () => JSON.stringify(run(() => listFcZones()), null, 2),
})

// FastMCP always also mounts a fixed, separate legacy-SSE compatibility
// route at /sse regardless of `endpoint` — so the Streamable HTTP endpoint
// (the one Claude actually speaks) must live elsewhere, or the two collide.
await server.start({
  transportType: 'httpStream',
  httpStream: {
    port: PORT,
    endpoint: '/mcp',
    cors: true,
    // No cross-request state to preserve (auth is re-checked per request,
    // tools are stateless DB calls) — statelessness also means a redeploy
    // can never strand a client on a session ID the new process forgot.
    stateless: true,
  },
})

console.log(`MCP server listening on http://0.0.0.0:${PORT}`)
console.log(`  Endpoint : /mcp (Streamable HTTP)  +  /sse (legacy SSE, built in)`)
console.log(`  Auth     : X-Api-Key / Bearer / ?api_key`)
