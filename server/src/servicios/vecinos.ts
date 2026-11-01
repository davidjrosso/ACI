import { telefonoWhatsApp, type Apoyo, type Usuario, type Vecino, type VecinoInput, type Interaccion } from "@territorio/shared";
import type { DB } from "../db/conexion.js";
import { ahora, auditar, bool, ErrorApp, filtroBarrios, json, noEncontrado, nuevoId, verificarBarrio } from "./comun.js";

const SELECT_VECINO = `
  SELECT v.*, (SELECT MAX(i.fecha) FROM interacciones i WHERE i.vecino_id = v.id) AS ultima_interaccion
  FROM vecinos v`;

const filaAVecino = (r: any): Vecino => ({
  id: r.id,
  nombre: r.nombre,
  apellido: r.apellido,
  telefono: r.telefono,
  email: r.email,
  direccion: r.direccion,
  barrioId: r.barrio_id,
  apoyo: r.apoyo,
  etiquetas: json<string[]>(r.etiquetas, []),
  notas: r.notas,
  consentimiento: bool(r.consentimiento),
  consentimientoFecha: r.consentimiento_fecha,
  lat: r.lat,
  lng: r.lng,
  creadoPor: r.creado_por,
  creadoEn: r.creado_en,
  actualizadoEn: r.actualizado_en,
  ultimaInteraccion: r.ultima_interaccion ?? null,
});

export interface FiltroVecinos {
  q?: string;
  barrioId?: string;
  apoyo?: Apoyo;
  etiqueta?: string;
  consentimiento?: boolean;
  limite?: number;
  desde?: number;
}

export function listarVecinos(db: DB, u: Usuario, f: FiltroVecinos): { items: Vecino[]; total: number } {
  const where: string[] = ["v.eliminado_en IS NULL"];
  const params: unknown[] = [];
  const alc = filtroBarrios(u, "v.barrio_id");
  if (f.barrioId) {
    where.push("v.barrio_id = ?");
    params.push(f.barrioId);
  }
  if (f.apoyo) {
    where.push("v.apoyo = ?");
    params.push(f.apoyo);
  }
  if (f.consentimiento !== undefined) {
    where.push("v.consentimiento = ?");
    params.push(f.consentimiento ? 1 : 0);
  }
  if (f.etiqueta) {
    where.push("EXISTS (SELECT 1 FROM json_each(v.etiquetas) WHERE value = ? COLLATE NOCASE)");
    params.push(f.etiqueta);
  }
  if (f.q) {
    const q = `%${f.q.trim()}%`;
    where.push("(v.nombre LIKE ? OR v.apellido LIKE ? OR v.direccion LIKE ? OR v.telefono LIKE ? OR (v.nombre || ' ' || COALESCE(v.apellido,'')) LIKE ?)");
    params.push(q, q, q, q, q);
  }
  const cond = `WHERE ${where.join(" AND ")}${alc.sql}`;
  const allParams = [...params, ...alc.params];
  const total = (db.prepare(`SELECT COUNT(*) n FROM vecinos v ${cond}`).get(...allParams) as { n: number }).n;
  const limite = Math.min(f.limite ?? 50, 5000);
  const items = db
    .prepare(`${SELECT_VECINO} ${cond} ORDER BY v.actualizado_en DESC LIMIT ? OFFSET ?`)
    .all(...allParams, limite, f.desde ?? 0)
    .map(filaAVecino);
  return { items, total };
}

export function obtenerVecino(db: DB, u: Usuario, id: string): Vecino {
  const r = db.prepare(`${SELECT_VECINO} WHERE v.id = ? AND v.eliminado_en IS NULL`).get(id);
  if (!r) throw noEncontrado("Vecino");
  const v = filaAVecino(r);
  verificarBarrio(u, v.barrioId);
  return v;
}

/** Busca un vecino por teléfono normalizado, para evitar duplicados. */
export function buscarPorTelefono(db: DB, telefono: string | null | undefined): string | null {
  const norm = telefonoWhatsApp(telefono);
  if (!norm) return null;
  const candidatos = db.prepare("SELECT id, telefono FROM vecinos WHERE telefono IS NOT NULL AND eliminado_en IS NULL").all() as { id: string; telefono: string }[];
  return candidatos.find((c) => telefonoWhatsApp(c.telefono) === norm)?.id ?? null;
}

export function crearVecino(db: DB, u: Usuario, v: VecinoInput, opciones: { permitirDuplicado?: boolean } = {}): Vecino {
  verificarBarrio(u, v.barrioId);
  const id = v.id ?? nuevoId();
  if (db.prepare("SELECT 1 FROM vecinos WHERE id = ?").get(id)) return obtenerVecino(db, u, id); // idempotente (reintento offline)
  if (!opciones.permitirDuplicado) {
    const dup = buscarPorTelefono(db, v.telefono);
    if (dup) throw new ErrorApp(409, "Ya existe un vecino con ese teléfono", "duplicado");
  }
  const t = ahora();
  db.prepare(
    `INSERT INTO vecinos (id, nombre, apellido, telefono, email, direccion, barrio_id, apoyo, etiquetas, notas, consentimiento, consentimiento_fecha, lat, lng, creado_por, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    v.nombre,
    v.apellido ?? null,
    v.telefono ?? null,
    v.email ?? null,
    v.direccion ?? null,
    v.barrioId,
    v.apoyo,
    JSON.stringify(v.etiquetas ?? []),
    v.notas ?? null,
    v.consentimiento ? 1 : 0,
    v.consentimiento ? t : null,
    v.lat ?? null,
    v.lng ?? null,
    u.id,
    t,
    t,
  );
  auditar(db, u.id, "crear", "vecino", id);
  return obtenerVecino(db, u, id);
}

export function actualizarVecino(db: DB, u: Usuario, id: string, v: VecinoInput): Vecino {
  const previo = obtenerVecino(db, u, id);
  verificarBarrio(u, v.barrioId);
  const consentimientoFecha = v.consentimiento ? previo.consentimientoFecha ?? ahora() : null;
  db.prepare(
    `UPDATE vecinos SET nombre = ?, apellido = ?, telefono = ?, email = ?, direccion = ?, barrio_id = ?, apoyo = ?, etiquetas = ?, notas = ?,
       consentimiento = ?, consentimiento_fecha = ?, lat = ?, lng = ?, actualizado_en = ? WHERE id = ?`,
  ).run(
    v.nombre,
    v.apellido ?? null,
    v.telefono ?? null,
    v.email ?? null,
    v.direccion ?? null,
    v.barrioId,
    v.apoyo,
    JSON.stringify(v.etiquetas ?? []),
    v.notas ?? null,
    v.consentimiento ? 1 : 0,
    consentimientoFecha,
    v.lat ?? null,
    v.lng ?? null,
    ahora(),
    id,
  );
  auditar(db, u.id, "actualizar", "vecino", id);
  return obtenerVecino(db, u, id);
}

/**
 * Baja de un vecino (derecho de supresión, Ley 25.326):
 * se anonimizan los datos personales y se conserva solo el registro estadístico.
 */
export function eliminarVecino(db: DB, u: Usuario, id: string) {
  obtenerVecino(db, u, id);
  db.transaction(() => {
    db.prepare(
      `UPDATE vecinos SET nombre = 'Eliminado', apellido = NULL, telefono = NULL, email = NULL, direccion = NULL, notas = NULL,
         etiquetas = '[]', lat = NULL, lng = NULL, consentimiento = 0, eliminado_en = ?, actualizado_en = ? WHERE id = ?`,
    ).run(ahora(), ahora(), id);
    db.prepare("UPDATE interacciones SET nota = NULL, direccion = NULL, lat = NULL, lng = NULL WHERE vecino_id = ?").run(id);
    auditar(db, u.id, "eliminar", "vecino", id);
  })();
}

export function historialVecino(db: DB, u: Usuario, id: string): Interaccion[] {
  obtenerVecino(db, u, id);
  return db
    .prepare(
      `SELECT i.*, us.nombre AS usuario_nombre FROM interacciones i JOIN usuarios us ON us.id = i.usuario_id
       WHERE i.vecino_id = ? ORDER BY i.fecha DESC LIMIT 100`,
    )
    .all(id)
    .map((r: any) => ({
      id: r.id,
      vecinoId: r.vecino_id,
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

export function listarEtiquetas(db: DB): string[] {
  return (
    db.prepare("SELECT DISTINCT value AS e FROM vecinos, json_each(vecinos.etiquetas) WHERE eliminado_en IS NULL ORDER BY e COLLATE NOCASE").all() as { e: string }[]
  ).map((r) => r.e);
}

/** Exporta a CSV con separador ";" y fechas dd/mm/aaaa (convención local, abre bien en Excel AR). Queda auditado. */
export function exportarCsv(db: DB, u: Usuario, f: FiltroVecinos): string {
  const { items } = listarVecinos(db, u, { ...f, limite: 5000, desde: 0 });
  const barrios = new Map((db.prepare("SELECT id, nombre FROM barrios").all() as { id: string; nombre: string }[]).map((b) => [b.id, b.nombre]));
  const fecha = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
  const esc = (s: unknown) => {
    const t = s === null || s === undefined ? "" : String(s);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [
    ["Nombre", "Apellido", "Teléfono", "Email", "Dirección", "Barrio", "Apoyo", "Etiquetas", "Consentimiento", "Fecha consentimiento", "Último contacto", "Alta"],
    ...items.map((v) => [
      v.nombre,
      v.apellido,
      v.telefono,
      v.email,
      v.direccion,
      barrios.get(v.barrioId),
      v.apoyo,
      v.etiquetas.join(", "),
      v.consentimiento ? "Sí" : "No",
      fecha(v.consentimientoFecha),
      fecha(v.ultimaInteraccion),
      fecha(v.creadoEn),
    ]),
  ];
  auditar(db, u.id, "exportar", "vecino", null, { filtros: f, cantidad: items.length });
  return "﻿" + filas.map((f) => f.map(esc).join(";")).join("\r\n");
}
