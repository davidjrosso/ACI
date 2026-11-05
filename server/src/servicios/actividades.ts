import type { Actividad, ActividadInput, Usuario } from "@aci/shared";
import type { DB } from "../db/conexion.js";
import { auditar, bool, noEncontrado, nuevoId, prohibido, verificarBarrio } from "./comun.js";

const filaAActividad = (r: any): Actividad => ({
  id: r.id,
  titulo: r.titulo,
  tipo: r.tipo,
  inicio: r.inicio,
  fin: r.fin,
  lugar: r.lugar,
  barrioId: r.barrio_id,
  responsableId: r.responsable_id,
  conCandidato: bool(r.con_candidato),
  publica: bool(r.publica),
  descripcionPublica: r.descripcion_publica,
  notas: r.notas,
});

/** Agenda interna: comando y comunicación ven todo; el resto, lo general y lo de sus barrios. */
export function listarActividades(db: DB, u: Usuario, f: { desde?: string; hasta?: string }): Actividad[] {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  if (f.desde) {
    where.push("inicio >= ?");
    params.push(f.desde);
  }
  if (f.hasta) {
    where.push("inicio < ?");
    params.push(f.hasta);
  }
  if (u.rol === "referente" || u.rol === "voluntario") {
    const ids = u.barrioIds;
    where.push(`(barrio_id IS NULL OR publica = 1 OR con_candidato = 1 OR responsable_id = ?${ids.length ? ` OR barrio_id IN (${ids.map(() => "?").join(",")})` : ""})`);
    params.push(u.id, ...ids);
  }
  return db.prepare(`SELECT * FROM actividades WHERE ${where.join(" AND ")} ORDER BY inicio LIMIT 500`).all(...params).map(filaAActividad);
}

/** Agenda del sitio: solo actividades públicas que no terminaron. Nunca expone notas internas. */
export function agendaPublica(db: DB, limite = 30): Actividad[] {
  const desde = new Date(Date.now() - 3 * 3600_000).toISOString();
  return db
    .prepare("SELECT * FROM actividades WHERE publica = 1 AND COALESCE(fin, inicio) >= ? ORDER BY inicio LIMIT ?")
    .all(desde, limite)
    .map((r) => ({ ...filaAActividad(r), notas: null, responsableId: null }));
}

function puedeEditar(u: Usuario, a: Pick<ActividadInput, "barrioId">) {
  if (u.rol === "voluntario") throw prohibido("Los voluntarios no editan la agenda");
  if (u.rol === "referente") {
    if (!a.barrioId) throw prohibido("Como referente, las actividades deben ser de uno de tus barrios");
    verificarBarrio(u, a.barrioId);
  }
}

export function crearActividad(db: DB, u: Usuario, a: ActividadInput): Actividad {
  puedeEditar(u, a);
  const id = nuevoId();
  db.prepare(
    `INSERT INTO actividades (id, titulo, tipo, inicio, fin, lugar, barrio_id, responsable_id, con_candidato, publica, descripcion_publica, notas, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    a.titulo,
    a.tipo,
    new Date(a.inicio).toISOString(),
    a.fin ? new Date(a.fin).toISOString() : null,
    a.lugar ?? null,
    a.barrioId ?? null,
    a.responsableId ?? null,
    a.conCandidato ? 1 : 0,
    a.publica ? 1 : 0,
    a.descripcionPublica ?? null,
    a.notas ?? null,
    u.id,
  );
  auditar(db, u.id, "crear", "actividad", id);
  return filaAActividad(db.prepare("SELECT * FROM actividades WHERE id = ?").get(id));
}

export function actualizarActividad(db: DB, u: Usuario, id: string, a: ActividadInput): Actividad {
  const previa = db.prepare("SELECT * FROM actividades WHERE id = ?").get(id);
  if (!previa) throw noEncontrado("Actividad");
  puedeEditar(u, filaAActividad(previa));
  puedeEditar(u, a);
  db.prepare(
    `UPDATE actividades SET titulo = ?, tipo = ?, inicio = ?, fin = ?, lugar = ?, barrio_id = ?, responsable_id = ?, con_candidato = ?, publica = ?, descripcion_publica = ?, notas = ? WHERE id = ?`,
  ).run(
    a.titulo,
    a.tipo,
    new Date(a.inicio).toISOString(),
    a.fin ? new Date(a.fin).toISOString() : null,
    a.lugar ?? null,
    a.barrioId ?? null,
    a.responsableId ?? null,
    a.conCandidato ? 1 : 0,
    a.publica ? 1 : 0,
    a.descripcionPublica ?? null,
    a.notas ?? null,
    id,
  );
  return filaAActividad(db.prepare("SELECT * FROM actividades WHERE id = ?").get(id));
}

export function borrarActividad(db: DB, u: Usuario, id: string) {
  const previa = db.prepare("SELECT * FROM actividades WHERE id = ?").get(id);
  if (!previa) throw noEncontrado("Actividad");
  puedeEditar(u, filaAActividad(previa));
  db.prepare("DELETE FROM actividades WHERE id = ?").run(id);
}
