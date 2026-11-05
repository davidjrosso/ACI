-- Módulo 1 · Núcleo. Cada campaña vive en su propio archivo SQLite.
-- Todos los IDs son UUID (se pueden generar en el celular sin conexión).

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL            -- JSON
);

CREATE TABLE barrios (
  id                 TEXT PRIMARY KEY,
  nombre             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  geometria          TEXT,                -- GeoJSON Polygon [lng,lat]
  objetivo_contactos INTEGER,
  orden              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE temas (
  id     TEXT PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color  TEXT
);

CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono      TEXT,
  rol           TEXT NOT NULL CHECK (rol IN ('comando','comunicacion','referente','voluntario')),
  password_hash TEXT NOT NULL,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE usuario_barrios (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  barrio_id  TEXT NOT NULL REFERENCES barrios(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, barrio_id)
);

-- Vecinos: en el módulo 1 llegan desde el formulario "Sumate".
-- El módulo 2 (Territorio) suma timbreo, apoyo e historial sobre esta misma tabla.
CREATE TABLE vecinos (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  apellido              TEXT,
  telefono              TEXT,
  email                 TEXT,
  direccion             TEXT,
  barrio_id             TEXT REFERENCES barrios(id),
  apoyo                 TEXT NOT NULL DEFAULT 'sin_dato' CHECK (apoyo IN ('apoya','indeciso','no_apoya','sin_dato')),
  etiquetas             TEXT NOT NULL DEFAULT '[]',   -- JSON
  ayudas                TEXT NOT NULL DEFAULT '[]',   -- JSON: cómo quiere ayudar
  mensaje               TEXT,
  notas                 TEXT,
  origen                TEXT NOT NULL DEFAULT 'manual', -- 'sumate', 'manual', 'timbreo', 'importacion'
  contactado            INTEGER NOT NULL DEFAULT 0,
  consentimiento        INTEGER NOT NULL DEFAULT 0,   -- Ley 25.326
  consentimiento_fecha  TEXT,
  creado_por            TEXT REFERENCES usuarios(id),
  creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  eliminado_en          TEXT
);
CREATE INDEX idx_vecinos_barrio ON vecinos(barrio_id) WHERE eliminado_en IS NULL;
CREATE INDEX idx_vecinos_creado ON vecinos(creado_en);

CREATE TABLE auditoria (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id TEXT,
  accion     TEXT NOT NULL,
  entidad    TEXT NOT NULL,
  entidad_id TEXT,
  detalle    TEXT,
  fecha      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_auditoria_fecha ON auditoria(fecha);
