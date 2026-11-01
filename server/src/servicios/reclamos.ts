import type { EstadoReclamo, Reclamo, ReclamoInput, Usuario } from "@territorio/shared";
import type { DB } from "../db/conexion.js";
import { ahora, auditar, filtroBarrios, noEncontrado, nuevoId, prohibido, verificarBarrio } from "./comun.js";

const filaAReclamo = (r: any): Reclamo => ({
  id: r.id,
  tipo: r.tipo,
  temaId: r.tema_id,
  barrioId: r.barrio_id,
  vecinoId: r.vecino_id,
  descripcion: r.descripcion,
  direccion: r.direccion,
  lat: r.lat,
  lng: r.lng,
  estado: r.estado,
  creadoPor: r.creado_por,
  creadoEn: r.creado_en,
});

export function listarReclamos(db: DB, u: Usuario, f: { barrioId?: string; temaId?: string; estado?: EstadoReclamo; tipo?: string }): Reclamo[] {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  for (const [col, val] of [
    ["barrio_id", f.barrioId],
    ["tema_id", f.temaId],
    ["estado", f.estado],
    ["tipo", f.tipo],
  ] as const) {
    if (val) {
      where.push(`${col} = ?`);
      params.push(val);
    }
  }
  const alc = filtroBarrios(u, "barrio_id");
  return db
    .prepare(`SELECT * FROM reclamos WHERE ${where.join(" AND ")}${alc.sql} ORDER BY CASE estado WHEN 'nuevo' THEN 0 WHEN 'en_curso' THEN 1 ELSE 2 END, creado_en DESC LIMIT 1000`)
    .all(...params, ...alc.params)
    .map(filaAReclamo);
}

function obtener(db: DB, u: Usuario, id: string): Reclamo {
  const r = db.prepare("SELECT * FROM reclamos WHERE id = ?").get(id);
  if (!r) throw noEncontrado("Reclamo");
  const rec = filaAReclamo(r);
  verificarBarrio(u, rec.barrioId);
  return rec;
}

export function crearReclamo(db: DB, u: Usuario, r: ReclamoInput): Reclamo {
  verificarBarrio(u, r.barrioId);
  const id = nuevoId();
  db.prepare(
    `INSERT INTO reclamos (id, tipo, tema_id, barrio_id, vecino_id, descripcion, direccion, lat, lng, estado, creado_por)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, r.tipo, r.temaId, r.barrioId, r.vecinoId ?? null, r.descripcion, r.direccion ?? null, r.lat ?? null, r.lng ?? null, r.estado, u.id);
  auditar(db, u.id, "crear", "reclamo", id);
  return obtener(db, u, id);
}

export function actualizarReclamo(db: DB, u: Usuario, id: string, r: ReclamoInput): Reclamo {
  const previo = obtener(db, u, id);
  if (u.rol === "voluntario" && previo.creadoPor !== u.id) throw prohibido("Solo podés editar los reclamos que cargaste vos");
  verificarBarrio(u, r.barrioId);
  db.prepare(
    `UPDATE reclamos SET tipo = ?, tema_id = ?, barrio_id = ?, vecino_id = ?, descripcion = ?, direccion = ?, lat = ?, lng = ?, estado = ?, actualizado_en = ? WHERE id = ?`,
  ).run(r.tipo, r.temaId, r.barrioId, r.vecinoId ?? null, r.descripcion, r.direccion ?? null, r.lat ?? null, r.lng ?? null, r.estado, ahora(), id);
  auditar(db, u.id, "actualizar", "reclamo", id);
  return obtener(db, u, id);
}

export function cambiarEstadoReclamo(db: DB, u: Usuario, id: string, estado: EstadoReclamo): Reclamo {
  obtener(db, u, id);
  if (u.rol === "voluntario") throw prohibido("Solo referentes y comando cambian el estado");
  db.prepare("UPDATE reclamos SET estado = ?, actualizado_en = ? WHERE id = ?").run(estado, ahora(), id);
  return obtener(db, u, id);
}
