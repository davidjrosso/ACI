import { AYUDAS, telefonoWhatsApp, type Adhesion, type Ayuda, type ResumenSitio, type Sumate, type Usuario } from "@aci/shared";
import type { DB } from "../db/conexion.js";
import { ahora, auditar, bool, filtroBarrios, json, noEncontrado, nuevoId, verificarBarrio } from "./comun.js";
import { leerConfig, leerSitio } from "./configuracion.js";

const filaAAdhesion = (r: any): Adhesion => ({
  id: r.id,
  nombre: r.nombre,
  apellido: r.apellido,
  telefono: r.telefono,
  email: r.email,
  barrioId: r.barrio_id,
  ayudas: json<Ayuda[]>(r.ayudas, []),
  mensaje: r.mensaje,
  origen: r.origen,
  consentimientoFecha: r.consentimiento_fecha,
  creadoEn: r.creado_en,
  contactado: bool(r.contactado),
});

/**
 * Registra a una persona que se sumó desde el sitio. Si el teléfono ya existe,
 * actualiza el registro (suma las formas de ayudar) en lugar de duplicarlo.
 */
export function registrarSumate(db: DB, s: Sumate): { id: string; nuevo: boolean } {
  const norm = telefonoWhatsApp(s.telefono);
  const barrioId = s.barrioId && db.prepare("SELECT 1 FROM barrios WHERE id = ?").get(s.barrioId) ? s.barrioId : null;
  const t = ahora();
  const existente = norm
    ? ((db.prepare("SELECT id, telefono, ayudas FROM vecinos WHERE telefono IS NOT NULL AND eliminado_en IS NULL").all() as any[]).find(
        (v) => telefonoWhatsApp(v.telefono) === norm,
      ) as { id: string; ayudas: string } | undefined)
    : undefined;

  if (existente) {
    const ayudas = [...new Set([...json<string[]>(existente.ayudas, []), ...s.ayudas])];
    db.prepare(
      `UPDATE vecinos SET ayudas = ?, mensaje = COALESCE(?, mensaje), email = COALESCE(?, email), barrio_id = COALESCE(barrio_id, ?),
         consentimiento = 1, consentimiento_fecha = ?, contactado = 0, actualizado_en = ? WHERE id = ?`,
    ).run(JSON.stringify(ayudas), s.mensaje ?? null, s.email ?? null, barrioId, t, t, existente.id);
    auditar(db, null, "sumate_actualiza", "vecino", existente.id);
    return { id: existente.id, nuevo: false };
  }

  const id = nuevoId();
  db.prepare(
    `INSERT INTO vecinos (id, nombre, apellido, telefono, email, barrio_id, ayudas, mensaje, origen, etiquetas, consentimiento, consentimiento_fecha, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sumate', '["sumate"]', 1, ?, ?, ?)`,
  ).run(id, s.nombre, s.apellido ?? null, s.telefono, s.email ?? null, barrioId, JSON.stringify(s.ayudas), s.mensaje ?? null, t, t, t);
  auditar(db, null, "sumate", "vecino", id);
  return { id, nuevo: true };
}

export function listarAdhesiones(db: DB, u: Usuario, f: { barrioId?: string; ayuda?: string; pendientes?: boolean; q?: string }): Adhesion[] {
  const where = ["eliminado_en IS NULL", "origen = 'sumate'"];
  const p: unknown[] = [];
  if (f.barrioId) {
    where.push("barrio_id = ?");
    p.push(f.barrioId);
  }
  if (f.ayuda) {
    where.push("EXISTS (SELECT 1 FROM json_each(vecinos.ayudas) WHERE value = ?)");
    p.push(f.ayuda);
  }
  if (f.pendientes) where.push("contactado = 0");
  if (f.q) {
    where.push("(nombre LIKE ? OR apellido LIKE ? OR telefono LIKE ?)");
    p.push(`%${f.q}%`, `%${f.q}%`, `%${f.q}%`);
  }
  const alc = filtroBarrios(u, "barrio_id");
  return db
    .prepare(`SELECT * FROM vecinos WHERE ${where.join(" AND ")}${alc.sql} ORDER BY contactado, creado_en DESC LIMIT 2000`)
    .all(...p, ...alc.params)
    .map(filaAAdhesion);
}

export function marcarContactado(db: DB, u: Usuario, id: string, contactado: boolean): Adhesion {
  const r = db.prepare("SELECT * FROM vecinos WHERE id = ? AND eliminado_en IS NULL").get(id) as any;
  if (!r) throw noEncontrado("Adhesión");
  if (r.barrio_id) verificarBarrio(u, r.barrio_id);
  else if (u.rol !== "comando") verificarBarrio(u, "__sin_barrio__");
  db.prepare("UPDATE vecinos SET contactado = ?, actualizado_en = ? WHERE id = ?").run(contactado ? 1 : 0, ahora(), id);
  return filaAAdhesion(db.prepare("SELECT * FROM vecinos WHERE id = ?").get(id));
}

/** Derecho de supresión (Ley 25.326): anonimiza y conserva solo el dato estadístico. */
export function eliminarAdhesion(db: DB, u: Usuario, id: string) {
  const r = db.prepare("SELECT barrio_id FROM vecinos WHERE id = ? AND eliminado_en IS NULL").get(id) as any;
  if (!r) throw noEncontrado("Adhesión");
  if (u.rol !== "comando") verificarBarrio(u, r.barrio_id ?? "__sin_barrio__");
  db.prepare(
    `UPDATE vecinos SET nombre = 'Eliminado', apellido = NULL, telefono = NULL, email = NULL, direccion = NULL, mensaje = NULL, notas = NULL,
       consentimiento = 0, eliminado_en = ?, actualizado_en = ? WHERE id = ?`,
  ).run(ahora(), ahora(), id);
  auditar(db, u.id, "eliminar", "vecino", id);
}

export function exportarAdhesionesCsv(db: DB, u: Usuario, f: Parameters<typeof listarAdhesiones>[2]): string {
  const items = listarAdhesiones(db, u, f);
  const barrios = new Map((db.prepare("SELECT id, nombre FROM barrios").all() as { id: string; nombre: string }[]).map((b) => [b.id, b.nombre]));
  const fecha = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");
  const esc = (s: unknown) => {
    const t = s === null || s === undefined ? "" : String(s);
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const filas = [
    ["Nombre", "Apellido", "Teléfono", "Email", "Barrio", "Cómo quiere ayudar", "Mensaje", "Contactado", "Fecha consentimiento", "Alta"],
    ...items.map((a) => [a.nombre, a.apellido, a.telefono, a.email, a.barrioId ? barrios.get(a.barrioId) : "", a.ayudas.join(", "), a.mensaje, a.contactado ? "Sí" : "No", fecha(a.consentimientoFecha), fecha(a.creadoEn)]),
  ];
  auditar(db, u.id, "exportar", "vecino", null, { origen: "sumate", filtros: f, cantidad: items.length });
  return "﻿" + filas.map((x) => x.map(esc).join(";")).join("\r\n");
}

function lunes(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  return x.toISOString().slice(0, 10);
}

export function resumenSitio(db: DB, u: Usuario, urlSitio: string, hoy = new Date()): ResumenSitio {
  const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const alc = filtroBarrios(u, "barrio_id");
  const base = `FROM vecinos WHERE eliminado_en IS NULL AND origen = 'sumate'${alc.sql}`;
  const hace7 = new Date(hoy.getTime() - 7 * 86_400_000).toISOString();

  const porAyuda = AYUDAS.map((a) => ({
    ayuda: a,
    cantidad: n(`SELECT COUNT(*) n ${base} AND EXISTS (SELECT 1 FROM json_each(vecinos.ayudas) WHERE value = ?)`, ...alc.params, a),
  }));

  const semanas: string[] = [];
  for (let i = 7; i >= 0; i--) semanas.push(lunes(new Date(hoy.getTime() - i * 7 * 86_400_000)));
  const conteo = new Map<string, number>();
  for (const r of db.prepare(`SELECT creado_en ${base} AND creado_en >= ?`).all(...alc.params, semanas[0] + "T00:00:00Z") as { creado_en: string }[]) {
    const s = lunes(new Date(r.creado_en));
    conteo.set(s, (conteo.get(s) ?? 0) + 1);
  }

  const cfg = leerConfig(db);
  const diasParaEleccion = cfg.fechaEleccion ? Math.ceil((new Date(cfg.fechaEleccion + "T00:00:00-03:00").getTime() - hoy.getTime()) / 86_400_000) : null;

  return {
    publicado: leerSitio(db).publicado,
    url: urlSitio,
    noticiasPublicadas: n("SELECT COUNT(*) n FROM noticias WHERE estado = 'publicada'"),
    borradores: n("SELECT COUNT(*) n FROM noticias WHERE estado = 'borrador'"),
    adhesiones: n(`SELECT COUNT(*) n ${base}`, ...alc.params),
    adhesiones7d: n(`SELECT COUNT(*) n ${base} AND creado_en >= ?`, ...alc.params, hace7),
    sinContactar: n(`SELECT COUNT(*) n ${base} AND contactado = 0`, ...alc.params),
    proximasPublicas: n("SELECT COUNT(*) n FROM actividades WHERE publica = 1 AND inicio >= ?", hoy.toISOString()),
    porAyuda,
    porSemana: semanas.map((s) => ({ semana: s, cantidad: conteo.get(s) ?? 0 })),
    diasParaEleccion,
  };
}
