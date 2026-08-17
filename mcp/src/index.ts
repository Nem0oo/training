import { randomUUID } from 'node:crypto'
import express, { Request, Response, NextFunction } from 'express'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from '@modelcontextprotocol/sdk/types.js'
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

// --- MCP Server ---

function buildMcpServer() {
  const server = new Server(
    { name: 'coach-running', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_seances',
        description: "Liste les séances d'entraînement avec filtres optionnels. Sans le filtre 'etat', retourne les séances de tous les états (planifiées, en cours, terminées, annulées).",
        inputSchema: {
          type: 'object',
          properties: {
            from:  { type: 'string', description: 'Date de début ISO (YYYY-MM-DD)' },
            to:    { type: 'string', description: 'Date de fin ISO (YYYY-MM-DD)' },
            type:  { type: 'string', enum: ['endurance','fractionne','cotes','recuperation','competition','autre'] },
            etat:  { type: 'string', enum: ['planifiee','en_cours','terminee','annulee'], description: "Filtre optionnel par état. Omettre ce champ pour récupérer les séances de tous les états." },
            limit: { type: 'number', description: 'Nombre max de résultats (défaut 50)' },
          },
        },
      },
      {
        name: 'get_seance',
        description: "Récupère le détail d'une séance par son id",
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      {
        name: 'create_seance',
        description: "Crée une nouvelle séance d'entraînement",
        inputSchema: {
          type: 'object',
          properties: {
            nom:               { type: 'string' },
            date:              { type: 'string', description: 'YYYY-MM-DD' },
            contenu:           { type: 'string', description: 'Description détaillée (allures, séries…)' },
            type:              { type: 'string', enum: ['endurance','fractionne','cotes','recuperation','competition','autre'] },
            etat:              { type: 'string', enum: ['planifiee','en_cours','terminee','annulee'] },
            commentaire_coach: { type: 'string', description: 'Commentaire du coach sur la séance' },
          },
          required: ['nom', 'date', 'type'],
        },
      },
      {
        name: 'update_seance',
        description: 'Met à jour une séance existante (champs partiels acceptés)',
        inputSchema: {
          type: 'object',
          properties: {
            id:                { type: 'string' },
            nom:               { type: 'string' },
            date:              { type: 'string' },
            contenu:           { type: 'string' },
            type:              { type: 'string', enum: ['endurance','fractionne','cotes','recuperation','competition','autre'] },
            etat:              { type: 'string', enum: ['planifiee','en_cours','terminee','annulee'] },
            commentaire_coach: { type: 'string', description: 'Commentaire du coach sur la séance' },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_seance',
        description: 'Supprime une séance',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string' } },
          required: ['id'],
        },
      },
      {
        name: 'get_stats',
        description: "Statistiques d'entraînement sur N semaines",
        inputSchema: {
          type: 'object',
          properties: {
            weeks: { type: 'number', description: 'Nombre de semaines à analyser (défaut 4)' },
          },
        },
      },
      {
        name: 'list_fc_zones',
        description: "Liste les zones de fréquence cardiaque définies par l'utilisateur (lecture seule)",
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    const a = (args ?? {}) as Record<string, unknown>
    try {
      let result: unknown
      switch (name) {
        case 'list_seances':  result = listSeances(a as Parameters<typeof listSeances>[0]); break
        case 'get_seance':    result = getSeance(a.id as string); break
        case 'create_seance': result = createSeance(a as Parameters<typeof createSeance>[0]); break
        case 'update_seance': result = updateSeance(a.id as string, a as Parameters<typeof updateSeance>[1]); break
        case 'delete_seance': result = deleteSeance(a.id as string); break
        case 'get_stats':     result = getStats(a.weeks as number | undefined); break
        case 'list_fc_zones': result = listFcZones(); break
        default: throw new Error(`Outil inconnu: ${name}`)
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Erreur: ${(err as Error).message}` }], isError: true }
    }
  })

  return server
}

// --- HTTP / SSE ---

const app = express()
app.use(express.json())

// Claude.ai connects to remote MCP servers directly from the browser, so
// without CORS headers the request never reaches app code — the browser
// blocks it and Claude just reports "Couldn't reach" the server.
app.use((req: Request, res: Response, next: NextFunction) => {
  res.header('Vary', 'Origin')
  res.header('Access-Control-Allow-Origin', req.headers.origin ?? '*')
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key, Authorization, Mcp-Session-Id, mcp-protocol-version, Last-Event-ID')
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const fromHeader = req.headers['x-api-key']
  const fromBearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : undefined
  const fromQuery = req.query.api_key
  const fromPath = req.params.api_key
  const provided = fromHeader ?? fromBearer ?? fromQuery ?? fromPath

  if (!provided || provided !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized — clé API invalide ou absente' })
    return
  }
  next()
}

// --- Legacy SSE transport (GET /sse + POST /messages) ---
const sseSessions = new Map<string, SSEServerTransport>()

// --- Streamable HTTP transport (POST /sse, nouveaux clients dont Claude.ai) ---
const httpSessions = new Map<string, StreamableHTTPServerTransport>()

app.get(['/sse', '/sse/:api_key'], requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  if (sessionId) {
    // Streamable HTTP : flux SSE d'une session existante
    const transport = httpSessions.get(sessionId)
    if (!transport) {
      res.status(404).json({ error: 'Session introuvable' })
      return
    }
    await transport.handleRequest(req, res)
    return
  }

  // Legacy SSE transport
  const apiKey = (req.query.api_key ?? req.params.api_key) as string
  const transport = new SSEServerTransport(`/mcp/messages?api_key=${apiKey}`, res)
  const server = buildMcpServer()
  sseSessions.set(transport.sessionId, transport)
  res.on('close', () => sseSessions.delete(transport.sessionId))
  await server.connect(transport)
})

app.post(['/sse', '/sse/:api_key'], requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined

  // Claude.ai's client probes an unreleased "server/discover" extension
  // (MCP Apps/UI capability negotiation) before the standard "initialize".
  // We don't support it — reply with a proper JSON-RPC "Method not found"
  // so the client treats it as an optional, declined extension and falls
  // back to plain initialize, instead of a transport-level 400 that reads
  // as "this server is broken".
  if (!sessionId && req.body?.method && req.body.method !== 'initialize') {
    res.status(200).json({ jsonrpc: '2.0', error: { code: -32601, message: `Method not found: ${req.body.method}` }, id: req.body.id ?? null })
    return
  }

  let transport: StreamableHTTPServerTransport

  if (sessionId) {
    const existing = httpSessions.get(sessionId)
    if (!existing) {
      // Session ID from a previous server instance (e.g. redeploy wiped
      // in-memory sessions). Tell the client to reinitialize instead of
      // silently handing this request to a fresh, uninitialized transport,
      // which just rejects it with a confusing "Server not initialized" 400.
      res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session expirée — réinitialisation nécessaire' }, id: null })
      return
    }
    transport = existing
  } else if (isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { httpSessions.set(sid, transport) },
    })
    transport.onclose = () => {
      if (transport.sessionId) httpSessions.delete(transport.sessionId)
    }
    await buildMcpServer().connect(transport)
  } else {
    // No session AND not an initialize request — matches the MCP SDK's own
    // reference Express pattern: reject up front instead of spinning up a
    // transport just to have the SDK reject the same request internally.
    res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: No valid session ID provided' }, id: null })
    return
  }

  await transport.handleRequest(req, res, req.body)
})

app.delete(['/sse', '/sse/:api_key'], requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !httpSessions.has(sessionId)) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  const transport = httpSessions.get(sessionId)!
  await transport.handleRequest(req, res)
  httpSessions.delete(sessionId)
})

app.post('/messages', requireApiKey, async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string
  const transport = sseSessions.get(sessionId)
  if (!transport) {
    res.status(404).json({ error: 'Session introuvable' })
    return
  }
  await transport.handlePostMessage(req, res)
})

app.get('/health', (_req: Request, res: Response) => res.json({ status: 'ok' }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP server listening on http://0.0.0.0:${PORT}`)
  console.log(`  SSE legacy   : GET  /sse`)
  console.log(`  Streamable   : POST /sse`)
  console.log(`  Auth         : X-Api-Key / Bearer / ?api_key`)
})
