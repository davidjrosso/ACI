-- Módulo 1 · Sitio del candidato: imágenes, noticias, propuestas y agenda.

CREATE TABLE imagenes (
  id         TEXT PRIMARY KEY,
  ancho      INTEGER NOT NULL,
  alto       INTEGER NOT NULL,
  alt        TEXT,
  bytes      INTEGER NOT NULL,
  subida_por TEXT REFERENCES usuarios(id),
  creada_en  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE noticias (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  titulo        TEXT NOT NULL,
  bajada        TEXT,
  cuerpo        TEXT NOT NULL DEFAULT '',
  imagen_id     TEXT REFERENCES imagenes(id) ON DELETE SET NULL,
  tema_id       TEXT REFERENCES temas(id) ON DELETE SET NULL,
  barrio_id     TEXT REFERENCES barrios(id) ON DELETE SET NULL,
  estado        TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','publicada')),
  destacada     INTEGER NOT NULL DEFAULT 0,
  fecha         TEXT,        -- fecha visible (al publicar, si no se indicó)
  autor_id      TEXT REFERENCES usuarios(id),
  creada_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizada_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_noticias_pub ON noticias(estado, fecha);

CREATE TABLE propuestas (
  id          TEXT PRIMARY KEY,
  titulo      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  tema_id     TEXT REFERENCES temas(id) ON DELETE SET NULL,
  orden       INTEGER NOT NULL DEFAULT 0,
  publicada   INTEGER NOT NULL DEFAULT 1,
  creada_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE actividades (
  id                 TEXT PRIMARY KEY,
  titulo             TEXT NOT NULL,
  tipo               TEXT NOT NULL,
  inicio             TEXT NOT NULL,
  fin                TEXT,
  lugar              TEXT,
  barrio_id          TEXT REFERENCES barrios(id) ON DELETE SET NULL,
  responsable_id     TEXT REFERENCES usuarios(id),
  con_candidato      INTEGER NOT NULL DEFAULT 0,
  publica            INTEGER NOT NULL DEFAULT 0,
  descripcion_publica TEXT,
  notas              TEXT,
  creado_por         TEXT REFERENCES usuarios(id),
  creado_en          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_actividades_inicio ON actividades(inicio);
