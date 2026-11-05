import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import type { DB } from "./db/conexion.js";

/** Hash de contraseña con scrypt (sin dependencias nativas extra). Formato: scrypt$salt$hash */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verificarPassword(password: string, almacenado: string): boolean {
  const [alg, saltB64, hashB64] = almacenado.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, "base64");
  const calculado = scryptSync(password, Buffer.from(saltB64, "base64"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Crea una sesión. En la base solo se guarda el hash del token. */
export function crearSesion(plataforma: DB, campania: string, usuarioId: string, dias: number): { token: string; expira: Date } {
  const token = randomBytes(32).toString("base64url");
  const expira = new Date(Date.now() + dias * 86_400_000);
  plataforma
    .prepare("INSERT INTO sesiones (token_hash, campania, usuario_id, expira_en) VALUES (?, ?, ?, ?)")
    .run(sha256(token), campania, usuarioId, expira.toISOString());
  return { token, expira };
}

export function buscarSesion(plataforma: DB, token: string): { campania: string; usuarioId: string } | null {
  const fila = plataforma
    .prepare("SELECT campania, usuario_id FROM sesiones WHERE token_hash = ? AND expira_en > ?")
    .get(sha256(token), new Date().toISOString()) as { campania: string; usuario_id: string } | undefined;
  return fila ? { campania: fila.campania, usuarioId: fila.usuario_id } : null;
}

export function borrarSesion(plataforma: DB, token: string) {
  plataforma.prepare("DELETE FROM sesiones WHERE token_hash = ?").run(sha256(token));
}

export function borrarSesionesDeUsuario(plataforma: DB, campania: string, usuarioId: string) {
  plataforma.prepare("DELETE FROM sesiones WHERE campania = ? AND usuario_id = ?").run(campania, usuarioId);
}

export function limpiarSesionesVencidas(plataforma: DB) {
  plataforma.prepare("DELETE FROM sesiones WHERE expira_en <= ?").run(new Date().toISOString());
}
