import type { Usuario } from "@aci/shared";
import type { DB } from "../db/conexion.js";

export const ahora = () => new Date().toISOString();
export const nuevoId = () => crypto.randomUUID();

/** Error de negocio con código HTTP. Los handlers lo traducen a la respuesta. */
export class ErrorApp extends Error {
  constructor(public status: number, message: string, public codigo = "error") {
    super(message);
  }
}
export const noEncontrado = (que: string) => new ErrorApp(404, `${que} no encontrado`, "no_encontrado");
export const prohibido = (msg = "No tenés permiso para esta acción") => new ErrorApp(403, msg, "prohibido");

/**
 * Alcance territorial del usuario:
 *  - comando: null (ve toda la ciudad)
 *  - comunicacion: ningún barrio (no accede a datos de vecinos)
 *  - referente / voluntario: lista de barrios asignados
 */
export function alcance(u: Usuario): string[] | null {
  if (u.rol === "comando") return null;
  if (u.rol === "comunicacion") return []; // Comunicación publica en el sitio pero no ve datos de vecinos
  return u.barrioIds;
}

/** Fragmento SQL "AND <col> IN (...)" según el alcance. Devuelve también los parámetros. */
export function filtroBarrios(u: Usuario, columna: string): { sql: string; params: string[] } {
  const a = alcance(u);
  if (a === null) return { sql: "", params: [] };
  if (a.length === 0) return { sql: " AND 1 = 0", params: [] };
  return { sql: ` AND ${columna} IN (${a.map(() => "?").join(",")})`, params: a };
}

export function verificarBarrio(u: Usuario, barrioId: string) {
  const a = alcance(u);
  if (a !== null && !a.includes(barrioId)) throw prohibido("Ese barrio no está asignado a tu usuario");
}

export function auditar(db: DB, usuarioId: string | null, accion: string, entidad: string, entidadId?: string | null, detalle?: unknown) {
  db.prepare("INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)").run(
    usuarioId,
    accion,
    entidad,
    entidadId ?? null,
    detalle === undefined ? null : JSON.stringify(detalle),
  );
}

export const bool = (v: unknown) => v === 1 || v === true;
export const json = <T>(v: unknown, def: T): T => {
  if (typeof v !== "string") return def;
  try {
    return JSON.parse(v) as T;
  } catch {
    return def;
  }
};
