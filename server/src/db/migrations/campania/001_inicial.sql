-- Base de una campaña. Cada campaña vive en su propio archivo SQLite:
-- aislamiento total, backup = copiar un archivo, baja = borrarlo.
-- Todos los IDs son UUID (se pueden generar en el celular sin conexión).

CREATE TABLE config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL            -- JSON
);

-- ===== Tablas de parametrización (lo único que se configura) =====
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

CREATE TABLE plantillas (
  id     TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  texto  TEXT NOT NULL
);

CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  telefono      TEXT,
  rol           TEXT NOT NULL CHECK (rol IN ('comando','referente','voluntario')),
  password_hash TEXT NOT NULL,
  activo        INTEGER NOT NULL DEFAULT 1,
  creado_en     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE usuario_barrios (
  usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  barrio_id  TEXT NOT NULL REFERENCES barrios(id) ON DELETE CASCADE,
  PRIMARY KEY (usuario_id, barrio_id)
);

-- ===== Datos de la campaña (estructura fija) =====
CREATE TABLE vecinos (
  id                    TEXT PRIMARY KEY,
  nombre                TEXT NOT NULL,
  apellido              TEXT,
  telefono              TEXT,
  email                 TEXT,
  direccion             TEXT,
  barrio_id             TEXT NOT NULL REFERENCES barrios(id),
  apoyo                 TEXT NOT NULL DEFAULT 'sin_dato' CHECK (apoyo IN ('apoya','indeciso','no_apoya','sin_dato')),
  etiquetas             TEXT NOT NULL DEFAULT '[]',   -- JSON array de texto
  notas                 TEXT,
  consentimiento        INTEGER NOT NULL DEFAULT 0,   -- Ley 25.326: consentimiento para ser contactado
  consentimiento_fecha  TEXT,
  lat                   REAL,
  lng                   REAL,
  creado_por            TEXT REFERENCES usuarios(id),
  creado_en             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  eliminado_en          TEXT
);
CREATE INDEX idx_vecinos_barrio ON vecinos(barrio_id) WHERE eliminado_en IS NULL;

CREATE TABLE interacciones (
  id         TEXT PRIMARY KEY,
  vecino_id  TEXT REFERENCES vecinos(id),
  barrio_id  TEXT NOT NULL REFERENCES barrios(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  canal      TEXT NOT NULL CHECK (canal IN ('puerta','whatsapp','telefono','evento')),
  resultado  TEXT NOT NULL CHECK (resultado IN ('atendio','no_estaba','no_quiso')),
  apoyo      TEXT CHECK (apoyo IN ('apoya','indeciso','no_apoya','sin_dato')),
  tema_id    TEXT REFERENCES temas(id),
  direccion  TEXT,
  nota       TEXT,
  fecha      TEXT NOT NULL,
  lat        REAL,
  lng        REAL,
  recibido_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_inter_fecha ON interacciones(fecha);
CREATE INDEX idx_inter_barrio ON interacciones(barrio_id);
CREATE INDEX idx_inter_vecino ON interacciones(vecino_id);

CREATE TABLE reclamos (
  id          TEXT PRIMARY KEY,
  tipo        TEXT NOT NULL CHECK (tipo IN ('reclamo','propuesta')),
  tema_id     TEXT NOT NULL REFERENCES temas(id),
  barrio_id   TEXT NOT NULL REFERENCES barrios(id),
  vecino_id   TEXT REFERENCES vecinos(id),
  descripcion TEXT NOT NULL,
  direccion   TEXT,
  lat         REAL,
  lng         REAL,
  estado      TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_curso','resuelto')),
  creado_por  TEXT REFERENCES usuarios(id),
  creado_en   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  actualizado_en TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_reclamos_barrio ON reclamos(barrio_id);

CREATE TABLE actividades (
  id             TEXT PRIMARY KEY,
  titulo         TEXT NOT NULL,
  tipo           TEXT NOT NULL,
  inicio         TEXT NOT NULL,
  fin            TEXT,
  lugar          TEXT,
  barrio_id      TEXT REFERENCES barrios(id),
  responsable_id TEXT REFERENCES usuarios(id),
  con_candidato  INTEGER NOT NULL DEFAULT 0,
  notas          TEXT,
  creado_por     TEXT REFERENCES usuarios(id),
  creado_en      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_actividades_inicio ON actividades(inicio);

-- Auditoría: quién vio/exportó/modificó datos personales (Ley 25.326)
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
