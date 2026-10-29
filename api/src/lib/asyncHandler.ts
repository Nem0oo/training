import type { NextFunction, Request, RequestHandler, Response } from 'express'

// Express 4 n'attrape pas les promesses rejetées des handlers async : sans ce
// wrapper, une erreur (ex : contrainte SQLite) devient un unhandledRejection
// qui fait tomber le process. On la transmet au middleware d'erreur (500).
export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => fn(req, res, next).catch(next)
