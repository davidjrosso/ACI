import { slugificar, type Noticia, type NoticiaInput, type Propuesta, type PropuestaInput } from "@aci/shared";
import type { DB } from "../db/conexion.js";
import { ahora, auditar, bool, noEncontrado, nuevoId } from "./comun.js";

// ---------- Noticias ----------

const filaANoticia = (r: any): Noticia => ({
  id: r.id,
  slug: r.slug,
  titulo: r.titulo,
  bajada: r.bajada,
  cuerpo: r.cuerpo,
  imagenId: r.imagen_id,
  temaId: r.tema_id,
  barrioId: r.barrio_id,
  estado: r.estado,
  destacada: bool(r.destacada),
  fecha: r.fecha,
  autorId: r.autor_id,
  autorNombre: r.autor_nombre ?? null,
  creadaEn: r.creada_en,
  actualizadaEn: r.actualizada_en,
});

const SELECT = "SELECT n.*, u.nombre AS autor_nombre FROM noticias n LEFT JOIN usuarios u ON u.id = n.autor_id";

/** Slug único: si ya existe, agrega -2, -3... */
function slugLibre(db: DB, titulo: string, excluirId?: string): string {
  const base = slugificar(titulo);
  let s = base;
  for (let i = 2; db.prepare("SELECT 1 FROM noticias WHERE slug = ? AND id != ?").get(s, excluirId ?? ""); i++) s = `${base}-${i}`;
  return s;
}

export function listarNoticias(db: DB, f: { estado?: string; q?: string } = {}): Noticia[] {
  const where = ["1 = 1"];
  const p: unknown[] = [];
  if (f.estado) {
    where.push("n.estado = ?");
    p.push(f.estado);
  }
  if (f.q) {
    where.push("(n.titulo LIKE ? OR n.bajada LIKE ?)");
    p.push(`%${f.q}%`, `%${f.q}%`);
  }
  return db
    .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY CASE n.estado WHEN 'borrador' THEN 0 ELSE 1 END, COALESCE(n.fecha, n.actualizada_en) DESC LIMIT 500`)
    .all(...p)
    .map(filaANoticia);
}

export function obtenerNoticia(db: DB, id: string): Noticia {
  const r = db.prepare(`${SELECT} WHERE n.id = ?`).get(id);
  if (!r) throw noEncontrado("Noticia");
  return filaANoticia(r);
}

/** Al publicar por primera vez sin fecha, se toma la hora actual. Solo una noticia queda destacada. */
function normalizar(db: DB, n: NoticiaInput, previa?: Noticia): { fecha: string | null } {
  let fecha = n.fecha ? new Date(n.fecha).toISOString() : previa?.fecha ?? null;
  if (n.estado === "publicada" && !fecha) fecha = ahora();
  if (n.destacada) db.prepare("UPDATE noticias SET destacada = 0 WHERE destacada = 1 AND id != ?").run(previa?.id ?? "");
  return { fecha };
}

export function crearNoticia(db: DB, autorId: string, n: NoticiaInput): Noticia {
  const id = nuevoId();
  db.transaction(() => {
    const { fecha } = normalizar(db, n);
    db.prepare(
      `INSERT INTO noticias (id, slug, titulo, bajada, cuerpo, imagen_id, tema_id, barrio_id, estado, destacada, fecha, autor_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, slugLibre(db, n.titulo), n.titulo, n.bajada ?? null, n.cuerpo, n.imagenId ?? null, n.temaId ?? null, n.barrioId ?? null, n.estado, n.destacada ? 1 : 0, fecha, autorId);
    auditar(db, autorId, n.estado === "publicada" ? "publicar" : "crear", "noticia", id);
  })();
  return obtenerNoticia(db, id);
}

export function actualizarNoticia(db: DB, usuarioId: string, id: string, n: NoticiaInput): Noticia {
  const previa = obtenerNoticia(db, id);
  db.transaction(() => {
    const { fecha } = normalizar(db, n, previa);
    // El slug (link) se mantiene una vez publicada, para no romper enlaces ya compartidos
    const slug = previa.estado === "publicada" ? previa.slug : slugLibre(db, n.titulo, id);
    db.prepare(
      `UPDATE noticias SET slug = ?, titulo = ?, bajada = ?, cuerpo = ?, imagen_id = ?, tema_id = ?, barrio_id = ?, estado = ?, destacada = ?, fecha = ?, actualizada_en = ? WHERE id = ?`,
    ).run(slug, n.titulo, n.bajada ?? null, n.cuerpo, n.imagenId ?? null, n.temaId ?? null, n.barrioId ?? null, n.estado, n.destacada ? 1 : 0, fecha, ahora(), id);
    const accion = previa.estado !== "publicada" && n.estado === "publicada" ? "publicar" : previa.estado === "publicada" && n.estado !== "publicada" ? "despublicar" : "actualizar";
    auditar(db, usuarioId, accion, "noticia", id);
  })();
  return obtenerNoticia(db, id);
}

export function borrarNoticia(db: DB, usuarioId: string, id: string) {
  obtenerNoticia(db, id);
  db.prepare("DELETE FROM noticias WHERE id = ?").run(id);
  auditar(db, usuarioId, "borrar", "noticia", id);
}

// Lectura pública: solo publicadas y con fecha ya alcanzada (permite programar notas)
const PUBLICA = "n.estado = 'publicada' AND n.fecha <= strftime('%Y-%m-%dT%H:%M:%fZ','now')";

export function noticiasPublicas(db: DB, f: { limite?: number; desde?: number; temaId?: string } = {}): { items: Noticia[]; total: number } {
  const extra = f.temaId ? " AND n.tema_id = ?" : "";
  const p = f.temaId ? [f.temaId] : [];
  const total = (db.prepare(`SELECT COUNT(*) c FROM noticias n WHERE ${PUBLICA}${extra}`).get(...p) as { c: number }).c;
  const items = db
    .prepare(`${SELECT} WHERE ${PUBLICA}${extra} ORDER BY n.fecha DESC LIMIT ? OFFSET ?`)
    .all(...p, f.limite ?? 12, f.desde ?? 0)
    .map(filaANoticia);
  return { items, total };
}

export function noticiaPublicaPorSlug(db: DB, slug: string): Noticia | null {
  const r = db.prepare(`${SELECT} WHERE n.slug = ? AND ${PUBLICA}`).get(slug);
  return r ? filaANoticia(r) : null;
}

export function noticiaDestacada(db: DB): Noticia | null {
  const r = db.prepare(`${SELECT} WHERE ${PUBLICA} ORDER BY n.destacada DESC, n.fecha DESC LIMIT 1`).get();
  return r ? filaANoticia(r) : null;
}

// ---------- Propuestas ----------

const filaAPropuesta = (r: any): Propuesta => ({
  id: r.id,
  titulo: r.titulo,
  descripcion: r.descripcion,
  temaId: r.tema_id,
  orden: r.orden,
  publicada: bool(r.publicada),
});

export function listarPropuestas(db: DB, soloPublicadas = false): Propuesta[] {
  return db
    .prepare(`SELECT p.* FROM propuestas p LEFT JOIN temas t ON t.id = p.tema_id ${soloPublicadas ? "WHERE p.publicada = 1" : ""} ORDER BY t.nombre COLLATE NOCASE, p.orden, p.creada_en`)
    .all()
    .map(filaAPropuesta);
}

export function crearPropuesta(db: DB, usuarioId: string, p: PropuestaInput): Propuesta {
  const id = nuevoId();
  db.prepare("INSERT INTO propuestas (id, titulo, descripcion, tema_id, orden, publicada) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    p.titulo,
    p.descripcion,
    p.temaId ?? null,
    p.orden,
    p.publicada ? 1 : 0,
  );
  auditar(db, usuarioId, "crear", "propuesta", id);
  return { id, ...p };
}

export function actualizarPropuesta(db: DB, usuarioId: string, id: string, p: PropuestaInput): Propuesta {
  const r = db
    .prepare("UPDATE propuestas SET titulo = ?, descripcion = ?, tema_id = ?, orden = ?, publicada = ? WHERE id = ?")
    .run(p.titulo, p.descripcion, p.temaId ?? null, p.orden, p.publicada ? 1 : 0, id);
  if (r.changes === 0) throw noEncontrado("Propuesta");
  auditar(db, usuarioId, "actualizar", "propuesta", id);
  return { id, ...p };
}

export function borrarPropuesta(db: DB, usuarioId: string, id: string) {
  db.prepare("DELETE FROM propuestas WHERE id = ?").run(id);
  auditar(db, usuarioId, "borrar", "propuesta", id);
}
