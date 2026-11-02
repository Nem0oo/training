import type { IncomingHttpHeaders } from 'http'

export interface AuthRequest {
  headers: IncomingHttpHeaders
}

// La clé API n'est lue que dans les en-têtes (X-Api-Key ou Authorization:
// Bearer) : une clé dans l'URL finirait dans les logs d'accès et l'historique.
// Le statusText reste en ASCII, Response refusant tout caractère hors Latin-1.
export function authenticateRequest(request: AuthRequest, apiKey: string): { apiKey: string } {
  const fromHeader = request.headers['x-api-key'] as string | undefined
  const authHeader = request.headers['authorization'] as string | undefined
  const fromBearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const provided = fromHeader ?? fromBearer

  if (!provided || provided !== apiKey) {
    throw new Response(null, { status: 401, statusText: 'Unauthorized' })
  }
  return { apiKey: provided }
}
