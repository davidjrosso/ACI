import { ROLES_TERRITORIALES, type Usuario, type UsuarioInput } from "@aci/shared";
import type { DB } from "../db/conexion.js";
import { hashPassword } from "../auth.js";
import { bool, ErrorApp, noEncontrado, nuevoId } from "./comun.js";

function barriosDe(db: DB, usuarioId: string): string[] {
  return (db.prepare("SELECT barrio_id FROM usuario_barrios WHERE usuario_id = ?").all(usuarioId) as { barrio_id: string }[]).map((r) => r.barrio_id);
}

const filaAUsuario = (db: DB, r: any): Usuario => ({
  id: r.id,
  nombre: r.nombre,
  email: r.email,
  telefono: r.telefono,
  rol: r.rol,
  activo: bool(r.activo),
  barrioIds: barriosDe(db, r.id),
});

export function obtenerUsuario(db: DB, id: string): Usuario | null {
  const r = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(id);
  return r ? filaAUsuario(db, r) : null;
}

export function buscarPorEmail(db: DB, email: string): (Usuario & { passwordHash: string }) | null {
  const r = db.prepare("SELECT * FROM usuarios WHERE email = ? COLLATE NOCASE").get(email) as any;
  return r ? { ...filaAUsuario(db, r), passwordHash: r.password_hash } : null;
}

export function listarUsuarios(db: DB): Usuario[] {
  return db.prepare("SELECT * FROM usuarios ORDER BY activo DESC, rol, nombre COLLATE NOCASE").all().map((r) => filaAUsuario(db, r));
}

function asignarBarrios(db: DB, usuarioId: string, barrioIds: string[]) {
  db.prepare("DELETE FROM usuario_barrios WHERE usuario_id = ?").run(usuarioId);
  const ins = db.prepare("INSERT INTO usuario_barrios (usuario_id, barrio_id) VALUES (?, ?)");
  for (const b of new Set(barrioIds)) ins.run(usuarioId, b);
}

export function crearUsuario(db: DB, u: UsuarioInput): Usuario {
  if (!u.password) throw new ErrorApp(400, "La contraseña es obligatoria para un usuario nuevo");
  if (ROLES_TERRITORIALES.includes(u.rol) && u.barrioIds.length === 0) throw new ErrorApp(400, "Asigná al menos un barrio a referentes y voluntarios");
  const id = nuevoId();
  db.transaction(() => {
    try {
      db.prepare("INSERT INTO usuarios (id, nombre, email, telefono, rol, password_hash, activo) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
        id,
        u.nombre,
        u.email,
        u.telefono ?? null,
        u.rol,
        hashPassword(u.password!),
        u.activo ? 1 : 0,
      );
    } catch (e: any) {
      if (String(e.message).includes("UNIQUE")) throw new ErrorApp(409, `Ya existe un usuario con el email ${u.email}`);
      throw e;
    }
    asignarBarrios(db, id, ROLES_TERRITORIALES.includes(u.rol) ? u.barrioIds : []);
  })();
  return obtenerUsuario(db, id)!;
}

export function actualizarUsuario(db: DB, id: string, u: UsuarioInput): Usuario {
  if (ROLES_TERRITORIALES.includes(u.rol) && u.barrioIds.length === 0) throw new ErrorApp(400, "Asigná al menos un barrio a referentes y voluntarios");
  db.transaction(() => {
    const r = db
      .prepare("UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, rol = ?, activo = ? WHERE id = ?")
      .run(u.nombre, u.email, u.telefono ?? null, u.rol, u.activo ? 1 : 0, id);
    if (r.changes === 0) throw noEncontrado("Usuario");
    if (u.password) db.prepare("UPDATE usuarios SET password_hash = ? WHERE id = ?").run(hashPassword(u.password), id);
    asignarBarrios(db, id, ROLES_TERRITORIALES.includes(u.rol) ? u.barrioIds : []);
  })();
  return obtenerUsuario(db, id)!;
}

export function cantidadComandoActivos(db: DB): number {
  return (db.prepare("SELECT COUNT(*) n FROM usuarios WHERE rol = 'comando' AND activo = 1").get() as { n: number }).n;
}
