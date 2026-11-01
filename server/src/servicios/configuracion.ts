import {
  ConfigCampaniaSchema,
  type Barrio,
  type BarrioInput,
  type ConfigCampania,
  type Plantilla,
  type PlantillaInput,
  type Tema,
  type TemaInput,
} from "@territorio/shared";
import type { DB } from "../db/conexion.js";
import { ErrorApp, json, noEncontrado, nuevoId } from "./comun.js";

// ---------- Config general de la campaña ----------

export function leerConfig(db: DB): ConfigCampania {
  const fila = db.prepare("SELECT valor FROM config WHERE clave = 'campania'").get() as { valor: string } | undefined;
  if (!fila) throw new ErrorApp(500, "La campaña no tiene configuración");
  return ConfigCampaniaSchema.parse(JSON.parse(fila.valor));
}

export function guardarConfig(db: DB, parcial: Partial<ConfigCampania>): ConfigCampania {
  const actual = (() => {
    try {
      return leerConfig(db);
    } catch {
      return {} as ConfigCampania;
    }
  })();
  const nueva = ConfigCampaniaSchema.parse({ ...actual, ...parcial });
  db.prepare("INSERT INTO config (clave, valor) VALUES ('campania', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(
    JSON.stringify(nueva),
  );
  return nueva;
}

// ---------- Barrios ----------

const filaABarrio = (r: any): Barrio => ({
  id: r.id,
  nombre: r.nombre,
  geometria: json(r.geometria, null),
  objetivoContactos: r.objetivo_contactos,
});

export function listarBarrios(db: DB): Barrio[] {
  return db.prepare("SELECT * FROM barrios ORDER BY orden, nombre COLLATE NOCASE").all().map(filaABarrio);
}

export function crearBarrio(db: DB, b: BarrioInput): Barrio {
  const id = nuevoId();
  const orden = (db.prepare("SELECT COALESCE(MAX(orden), 0) + 1 o FROM barrios").get() as { o: number }).o;
  try {
    db.prepare("INSERT INTO barrios (id, nombre, geometria, objetivo_contactos, orden) VALUES (?, ?, ?, ?, ?)").run(
      id,
      b.nombre,
      b.geometria ? JSON.stringify(b.geometria) : null,
      b.objetivoContactos ?? null,
      orden,
    );
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) throw new ErrorApp(409, `Ya existe el barrio "${b.nombre}"`);
    throw e;
  }
  return { id, ...b };
}

export function actualizarBarrio(db: DB, id: string, b: BarrioInput): Barrio {
  const r = db
    .prepare("UPDATE barrios SET nombre = ?, geometria = ?, objetivo_contactos = ? WHERE id = ?")
    .run(b.nombre, b.geometria ? JSON.stringify(b.geometria) : null, b.objetivoContactos ?? null, id);
  if (r.changes === 0) throw noEncontrado("Barrio");
  return { id, ...b };
}

export function borrarBarrio(db: DB, id: string) {
  const usado = db.prepare("SELECT (SELECT COUNT(*) FROM vecinos WHERE barrio_id = ?) + (SELECT COUNT(*) FROM interacciones WHERE barrio_id = ?) + (SELECT COUNT(*) FROM reclamos WHERE barrio_id = ?) n").get(id, id, id) as { n: number };
  if (usado.n > 0) throw new ErrorApp(409, "No se puede borrar: el barrio ya tiene datos cargados. Podés renombrarlo.");
  db.prepare("DELETE FROM barrios WHERE id = ?").run(id);
}

/**
 * Importa barrios desde un GeoJSON FeatureCollection (por ejemplo exportado de QGIS o geojson.io).
 * Usa la propiedad indicada como nombre. Si el barrio existe, actualiza la geometría.
 */
export function importarGeoJSON(db: DB, fc: any, propiedadNombre = "nombre"): { creados: number; actualizados: number } {
  if (fc?.type !== "FeatureCollection" || !Array.isArray(fc.features)) throw new ErrorApp(400, "Se esperaba un GeoJSON FeatureCollection");
  let creados = 0;
  let actualizados = 0;
  db.transaction(() => {
    for (const f of fc.features) {
      const nombre = String(f?.properties?.[propiedadNombre] ?? f?.properties?.name ?? "").trim();
      let geom = f?.geometry;
      if (!nombre || !geom) continue;
      if (geom.type === "MultiPolygon") geom = { type: "Polygon", coordinates: geom.coordinates[0] };
      if (geom.type !== "Polygon") continue;
      const existente = db.prepare("SELECT id FROM barrios WHERE nombre = ? COLLATE NOCASE").get(nombre) as { id: string } | undefined;
      if (existente) {
        db.prepare("UPDATE barrios SET geometria = ? WHERE id = ?").run(JSON.stringify(geom), existente.id);
        actualizados++;
      } else {
        crearBarrio(db, { nombre, geometria: geom });
        creados++;
      }
    }
  })();
  return { creados, actualizados };
}

// ---------- Temas ----------

export function listarTemas(db: DB): Tema[] {
  return db.prepare("SELECT id, nombre, color FROM temas ORDER BY nombre COLLATE NOCASE").all() as Tema[];
}

export function crearTema(db: DB, t: TemaInput): Tema {
  const id = nuevoId();
  try {
    db.prepare("INSERT INTO temas (id, nombre, color) VALUES (?, ?, ?)").run(id, t.nombre, t.color ?? null);
  } catch (e: any) {
    if (String(e.message).includes("UNIQUE")) throw new ErrorApp(409, `Ya existe el tema "${t.nombre}"`);
    throw e;
  }
  return { id, nombre: t.nombre, color: t.color ?? null };
}

export function actualizarTema(db: DB, id: string, t: TemaInput): Tema {
  const r = db.prepare("UPDATE temas SET nombre = ?, color = ? WHERE id = ?").run(t.nombre, t.color ?? null, id);
  if (r.changes === 0) throw noEncontrado("Tema");
  return { id, nombre: t.nombre, color: t.color ?? null };
}

export function borrarTema(db: DB, id: string) {
  const usado = db.prepare("SELECT (SELECT COUNT(*) FROM reclamos WHERE tema_id = ?) + (SELECT COUNT(*) FROM interacciones WHERE tema_id = ?) n").get(id, id) as { n: number };
  if (usado.n > 0) throw new ErrorApp(409, "No se puede borrar: el tema ya está en uso. Podés renombrarlo.");
  db.prepare("DELETE FROM temas WHERE id = ?").run(id);
}

// ---------- Plantillas de mensajes (WhatsApp asistido) ----------

export function listarPlantillas(db: DB): Plantilla[] {
  return db.prepare("SELECT id, titulo, texto FROM plantillas ORDER BY titulo COLLATE NOCASE").all() as Plantilla[];
}

export function crearPlantilla(db: DB, p: PlantillaInput): Plantilla {
  const id = nuevoId();
  db.prepare("INSERT INTO plantillas (id, titulo, texto) VALUES (?, ?, ?)").run(id, p.titulo, p.texto);
  return { id, ...p };
}

export function actualizarPlantilla(db: DB, id: string, p: PlantillaInput): Plantilla {
  const r = db.prepare("UPDATE plantillas SET titulo = ?, texto = ? WHERE id = ?").run(p.titulo, p.texto, id);
  if (r.changes === 0) throw noEncontrado("Plantilla");
  return { id, ...p };
}

export function borrarPlantilla(db: DB, id: string) {
  db.prepare("DELETE FROM plantillas WHERE id = ?").run(id);
}
