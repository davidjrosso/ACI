import Database from "better-sqlite3";
import { mkdirSync, readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type DB = Database.Database;

const MIGRACIONES = join(import.meta.dirname, "migrations");

/** Abre un archivo SQLite con pragmas seguros y aplica las migraciones pendientes de la carpeta indicada. */
export function abrirBase(archivo: string, carpetaMigraciones: "platform" | "campania"): DB {
  if (archivo !== ":memory:") mkdirSync(join(archivo, ".."), { recursive: true });
  const db = new Database(archivo);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrar(db, join(MIGRACIONES, carpetaMigraciones));
  return db;
}

/**
 * Migraciones versionadas por número de archivo (001_x.sql, 002_y.sql...).
 * Nunca se edita una migración ya publicada: siempre se agrega una nueva.
 */
export function migrar(db: DB, carpeta: string) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY, aplicada_en TEXT NOT NULL)");
  const actual = (db.prepare("SELECT MAX(version) v FROM schema_version").get() as { v: number | null }).v ?? 0;
  if (!existsSync(carpeta)) throw new Error(`No existe la carpeta de migraciones ${carpeta}`);
  const archivos = readdirSync(carpeta).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  for (const f of archivos) {
    const version = parseInt(f, 10);
    if (version <= actual) continue;
    const sql = readFileSync(join(carpeta, f), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.prepare("INSERT INTO schema_version (version, aplicada_en) VALUES (?, ?)").run(version, new Date().toISOString());
    })();
  }
}

/** Versión de esquema aplicada (útil para /api/salud y para soporte). */
export function versionEsquema(db: DB): number {
  return (db.prepare("SELECT MAX(version) v FROM schema_version").get() as { v: number | null }).v ?? 0;
}
