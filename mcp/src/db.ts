import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ?? join(__dirname, '../../data')
const dbPath = join(dataDir, 'training.db')

mkdirSync(dataDir, { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS seances (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    date TEXT NOT NULL,
    contenu TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL CHECK(type IN ('endurance','fractionne','cotes','recuperation','competition','autre')),
    etat TEXT NOT NULL DEFAULT 'planifiee' CHECK(etat IN ('planifiee','en_cours','terminee','annulee')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

export default db
