-- Base de plataforma: registro de campañas, dominios propios y sesiones.
CREATE TABLE campanias (
  slug        TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  creada_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  activa      INTEGER NOT NULL DEFAULT 1
);

-- Dominio propio de cada sitio (ej. lauramedina.com.ar → demo)
CREATE TABLE dominios (
  host     TEXT PRIMARY KEY COLLATE NOCASE,
  campania TEXT NOT NULL REFERENCES campanias(slug) ON DELETE CASCADE
);

CREATE TABLE sesiones (
  token_hash  TEXT PRIMARY KEY,
  campania    TEXT NOT NULL REFERENCES campanias(slug) ON DELETE CASCADE,
  usuario_id  TEXT NOT NULL,
  creada_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expira_en   TEXT NOT NULL
);
CREATE INDEX idx_sesiones_expira ON sesiones(expira_en);
