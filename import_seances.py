#!/usr/bin/env python3
import sqlite3
import uuid
import re
from datetime import datetime, timezone

DB_PATH = "/home/nem0oo/Projects/training/data/training.db"
SEANCES_FILE = "/home/nem0oo/Projects/training/seances.txt"

def detect_type(description: str) -> str:
    d = description.lower()
    if "repos" in d:
        return "recuperation"
    if "renfo" in d:
        return "autre"
    # EF/Footing = endurance fondamentale, même si @xx% VMA est mentionné
    if d.startswith("ef ") or d.startswith("footing") or "90' ef" in d or "90' ef" in d:
        return "endurance"
    if "×" in description:
        return "fractionne"
    if "vma" in d:
        return "fractionne"
    if "allure cible + 15s" in d:
        return "fractionne"
    if "sortie" in d:
        return "endurance"
    return "endurance"

conn = sqlite3.connect(DB_PATH)
conn.execute("PRAGMA journal_mode = WAL")
conn.execute("PRAGMA foreign_keys = ON")
conn.execute("""
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
""")
conn.execute("""
  CREATE TABLE IF NOT EXISTS vma (
    id TEXT PRIMARY KEY,
    valeur REAL NOT NULL CHECK(valeur > 0),
    date_test TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )
""")

now = datetime.now(timezone.utc).isoformat()
inserted = 0

with open(SEANCES_FILE, encoding="utf-8") as f:
    for line in f:
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 4:
            continue
        date, semaine, jour, description = parts[0], parts[1], parts[2], parts[3]
        nom = f"{jour} – {description}"
        seance_type = detect_type(description)
        contenu = f"Semaine {semaine} | {description}"
        conn.execute(
            "INSERT INTO seances (id, nom, date, contenu, type, etat, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), nom, date, contenu, seance_type, "planifiee", now, now)
        )
        inserted += 1

conn.commit()
conn.close()
print(f"✓ {inserted} séances importées dans {DB_PATH}")
