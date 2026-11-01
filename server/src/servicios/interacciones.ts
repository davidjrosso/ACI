import type { Interaccion, InteraccionInput, Usuario } from "@territorio/shared";
import type { DB } from "../db/conexion.js";
import { ahora, ErrorApp, filtroBarrios, verificarBarrio } from "./comun.js";
import { buscarPorTelefono, crearVecino } from "./vecinos.js";

export interface ResultadoLote {
  aceptadas: string[];
  duplicadas: string[];
  rechazadas: Array<{ id: string; error: string }>;
}

/**
 * Registra un lote de interacciones enviado por el celular (sincronización offline).
 * Es idempotente: si una interacción ya existe (mismo id), se cuenta como duplicada y no se vuelve a guardar.
 * Cada interacción se procesa en su propia transacción: un error no frena al resto del lote.
 */
export function registrarLote(db: DB, u: Usuario, lote: InteraccionInput[]): ResultadoLote {
  const res: ResultadoLote = { aceptadas: [], duplicadas: [], rechazadas: [] };
  for (const it of lote) {
    try {
      const estado = db.transaction(() => registrarUna(db, u, it))();
      (estado === "duplicada" ? res.duplicadas : res.aceptadas).push(it.id);
    } catch (e: any) {
      res.rechazadas.push({ id: it.id, error: e instanceof ErrorApp ? e.message : "Error inesperado" });
    }
  }
  return res;
}

function registrarUna(db: DB, u: Usuario, it: InteraccionInput): "aceptada" | "duplicada" {
  if (db.prepare("SELECT 1 FROM interacciones WHERE id = ?").get(it.id)) return "duplicada";
  verificarBarrio(u, it.barrioId);

  let vecinoId = it.vecinoId ?? null;
  if (!vecinoId && it.vecinoNuevo) {
    // Si el teléfono ya existe, se vincula al vecino existente en lugar de duplicarlo
    const existente = buscarPorTelefono(db, it.vecinoNuevo.telefono);
    vecinoId = existente ?? crearVecino(db, u, { ...it.vecinoNuevo, barrioId: it.vecinoNuevo.barrioId ?? it.barrioId }, { permitirDuplicado: true }).id;
  }
  if (vecinoId) {
    const v = db.prepare("SELECT barrio_id FROM vecinos WHERE id = ? AND eliminado_en IS NULL").get(vecinoId) as { barrio_id: string } | undefined;
    if (!v) throw new ErrorApp(404, "El vecino de la visita no existe");
    verificarBarrio(u, v.barrio_id);
  }

  db.prepare(
    `INSERT INTO interacciones (id, vecino_id, barrio_id, usuario_id, canal, resultado, apoyo, tema_id, direccion, nota, fecha, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    it.id,
    vecinoId,
    it.barrioId,
    u.id,
    it.canal,
    it.resultado,
    it.apoyo ?? null,
    it.temaId ?? null,
    it.direccion ?? null,
    it.nota ?? null,
    new Date(it.fecha).toISOString(),
    it.lat ?? null,
    it.lng ?? null,
  );

  // El último dato de apoyo registrado actualiza la ficha del vecino
  if (vecinoId && it.apoyo && it.apoyo !== "sin_dato" && it.resultado === "atendio") {
    db.prepare("UPDATE vecinos SET apoyo = ?, actualizado_en = ? WHERE id = ?").run(it.apoyo, ahora(), vecinoId);
  }
  return "aceptada";
}

export function listarInteracciones(db: DB, u: Usuario, f: { barrioId?: string; usuarioId?: string; desde?: string; limite?: number }): Interaccion[] {
  const where = ["1 = 1"];
  const params: unknown[] = [];
  if (f.barrioId) {
    where.push("i.barrio_id = ?");
    params.push(f.barrioId);
  }
  if (u.rol === "voluntario") {
    where.push("i.usuario_id = ?");
    params.push(u.id);
  } else if (f.usuarioId) {
    where.push("i.usuario_id = ?");
    params.push(f.usuarioId);
  }
  if (f.desde) {
    where.push("i.fecha >= ?");
    params.push(f.desde);
  }
  const alc = filtroBarrios(u, "i.barrio_id");
  return db
    .prepare(
      `SELECT i.*, us.nombre usuario_nombre, TRIM(v.nombre || ' ' || COALESCE(v.apellido, '')) vecino_nombre
       FROM interacciones i JOIN usuarios us ON us.id = i.usuario_id LEFT JOIN vecinos v ON v.id = i.vecino_id
       WHERE ${where.join(" AND ")}${alc.sql} ORDER BY i.fecha DESC LIMIT ?`,
    )
    .all(...params, ...alc.params, Math.min(f.limite ?? 100, 1000))
    .map((r: any) => ({
      id: r.id,
      vecinoId: r.vecino_id,
      vecinoNombre: r.vecino_nombre,
      barrioId: r.barrio_id,
      usuarioId: r.usuario_id,
      usuarioNombre: r.usuario_nombre,
      canal: r.canal,
      resultado: r.resultado,
      apoyo: r.apoyo,
      temaId: r.tema_id,
      direccion: r.direccion,
      nota: r.nota,
      fecha: r.fecha,
      lat: r.lat,
      lng: r.lng,
    }));
}
