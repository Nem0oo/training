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
  );

  CREATE TABLE IF NOT EXISTS vma (
    id TEXT PRIMARY KEY,
    valeur REAL NOT NULL CHECK(valeur > 0),
    date_test TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fc_zones (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    fc_min INTEGER NOT NULL CHECK(fc_min >= 0),
    fc_max INTEGER NOT NULL CHECK(fc_max >= fc_min),
    ordre INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

try {
  db.exec(`ALTER TABLE seances ADD COLUMN commentaire_coach TEXT NOT NULL DEFAULT ''`)
} catch { /* column already exists */ }

// Colonnes du moteur de scoring (voir Course 2026-2027 / scoring séances).
// Pas de CHECK ici : ALTER TABLE ADD COLUMN a des limites sur les contraintes
// multi-colonnes selon la version SQLite embarquée ; la validation vit dans
// les routes (voir routes/seances.ts).
try {
  db.exec(`ALTER TABLE seances ADD COLUMN condition_signalee INTEGER NOT NULL DEFAULT 0`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE seances ADD COLUMN garmin_activity_id TEXT`)
} catch { /* column already exists */ }
try {
  // Pas de mapping automatique depuis l'ancien champ `type` (valeurs non
  // fiables pour le moteur) — 'autre' est un défaut neutre pour l'historique.
  db.exec(`ALTER TABLE seances ADD COLUMN categorie TEXT NOT NULL DEFAULT 'autre'`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE seances ADD COLUMN nature_effort TEXT NOT NULL DEFAULT 'non_applicable'`)
} catch { /* column already exists */ }
try {
  db.exec(`ALTER TABLE seances ADD COLUMN blocs_prescrits TEXT`)
} catch { /* column already exists */ }
try {
  // Sortie du moteur (effet_reel_brut, 7 axes) — jamais écrit par
  // create_seance/update_seance, uniquement par le calcul déclenché en 2.2/2.3.
  db.exec(`ALTER TABLE seances ADD COLUMN effet_reel_brut TEXT`)
} catch { /* column already exists */ }
try {
  // Résultat de conformité (2.2), calculé par le moteur mais jusqu'ici jamais
  // persisté (seul facteur_execution en dérivait) — ajouté pour l'affichage
  // UI (point 6 de la spec UI complémentaire), même statut en écriture que
  // effet_reel_brut : jamais accepté via create_seance/update_seance.
  db.exec(`ALTER TABLE seances ADD COLUMN conformite TEXT`)
} catch { /* column already exists */ }
try {
  // Tags libres, tableau JSON de strings — accepté en écriture via
  // create_seance/update_seance (voir routes/seances.ts).
  db.exec(`ALTER TABLE seances ADD COLUMN tags TEXT`)
} catch { /* column already exists */ }
try {
  // Volume prévu (km), dérivé de blocs_prescrits par estimateDistancePrevueKm
  // (voir scoring/distance.ts) — recalculé à chaque create/update, jamais
  // accepté directement du client (même statut que effet_reel_brut).
  db.exec(`ALTER TABLE seances ADD COLUMN distance_prevue_km REAL`)
} catch { /* column already exists */ }
try {
  // Volume réalisé (km), lu directement depuis l'activité Garmin
  // (summary.total_distance_km) au moment du scoring (pipeline.ts) — jamais
  // accepté directement du client.
  db.exec(`ALTER TABLE seances ADD COLUMN distance_realisee_km REAL`)
} catch { /* column already exists */ }

db.exec(`
  CREATE TABLE IF NOT EXISTS power_zones (
    id TEXT PRIMARY KEY,
    zone TEXT NOT NULL UNIQUE CHECK(zone IN ('Z1','Z2','Z3','Z4','Z5')),
    nom TEXT NOT NULL,
    power_min INTEGER NOT NULL CHECK(power_min >= 0),
    power_max INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- État persistant du radar cumulé (2.4) — un seul athlète, une seule ligne
  -- (id fixe 'singleton'). Mis à jour par EMA à chaque séance scorée.
  CREATE TABLE IF NOT EXISTS radar_cumule (
    id TEXT PRIMARY KEY,
    endurance_fondamentale REAL NOT NULL,
    seuil_lactique REAL NOT NULL,
    vo2max REAL NOT NULL,
    vma REAL NOT NULL,
    resistance_musculaire REAL NOT NULL,
    economie_course REAL NOT NULL,
    resilience_thermique REAL NOT NULL,
    updated_at TEXT NOT NULL
  );
`)

export default db
