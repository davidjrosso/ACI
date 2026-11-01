import { APOYOS, type Apoyo, type Tablero, type Usuario } from "@territorio/shared";
import type { DB } from "../db/conexion.js";
import { filtroBarrios } from "./comun.js";
import { leerConfig } from "./configuracion.js";

/** Lunes (UTC) de la semana de una fecha, en formato AAAA-MM-DD. */
function lunes(d: Date): string {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dia = (x.getUTCDay() + 6) % 7;
  x.setUTCDate(x.getUTCDate() - dia);
  return x.toISOString().slice(0, 10);
}

export function calcularTablero(db: DB, u: Usuario, hoy = new Date()): Tablero {
  const hace7 = new Date(hoy.getTime() - 7 * 86_400_000).toISOString();
  const fv = filtroBarrios(u, "barrio_id");
  const n = (sql: string, ...p: unknown[]) => (db.prepare(sql).get(...p) as { n: number }).n;

  const totales = {
    vecinos: n(`SELECT COUNT(*) n FROM vecinos WHERE eliminado_en IS NULL${fv.sql}`, ...fv.params),
    interacciones: n(`SELECT COUNT(*) n FROM interacciones WHERE 1=1${fv.sql}`, ...fv.params),
    interacciones7d: n(`SELECT COUNT(*) n FROM interacciones WHERE fecha >= ?${fv.sql}`, hace7, ...fv.params),
    reclamosAbiertos: n(`SELECT COUNT(*) n FROM reclamos WHERE estado != 'resuelto'${fv.sql}`, ...fv.params),
    voluntariosActivos7d: n(`SELECT COUNT(DISTINCT usuario_id) n FROM interacciones WHERE fecha >= ?${fv.sql}`, hace7, ...fv.params),
  };

  const apoyo = Object.fromEntries(APOYOS.map((a) => [a, 0])) as Record<Apoyo, number>;
  for (const r of db.prepare(`SELECT apoyo, COUNT(*) n FROM vecinos WHERE eliminado_en IS NULL${fv.sql} GROUP BY apoyo`).all(...fv.params) as { apoyo: Apoyo; n: number }[]) {
    apoyo[r.apoyo] = r.n;
  }

  const fb = filtroBarrios(u, "b.id");
  const porBarrio = (
    db
      .prepare(
        `SELECT b.id, b.nombre, b.objetivo_contactos,
          (SELECT COUNT(*) FROM vecinos v WHERE v.barrio_id = b.id AND v.eliminado_en IS NULL) vecinos,
          (SELECT COUNT(*) FROM vecinos v WHERE v.barrio_id = b.id AND v.eliminado_en IS NULL AND v.apoyo = 'apoya') apoya,
          (SELECT COUNT(*) FROM vecinos v WHERE v.barrio_id = b.id AND v.eliminado_en IS NULL AND v.apoyo = 'indeciso') indeciso,
          (SELECT COUNT(*) FROM vecinos v WHERE v.barrio_id = b.id AND v.eliminado_en IS NULL AND v.apoyo = 'no_apoya') no_apoya,
          (SELECT COUNT(*) FROM vecinos v WHERE v.barrio_id = b.id AND v.eliminado_en IS NULL AND v.apoyo = 'sin_dato') sin_dato,
          (SELECT COUNT(*) FROM interacciones i WHERE i.barrio_id = b.id AND i.fecha >= ?) inter7,
          (SELECT COUNT(*) FROM reclamos r WHERE r.barrio_id = b.id AND r.estado != 'resuelto') reclamos
         FROM barrios b WHERE 1=1${fb.sql} ORDER BY b.orden, b.nombre`,
      )
      .all(hace7, ...fb.params) as any[]
  ).map((r) => ({
    barrioId: r.id,
    nombre: r.nombre,
    vecinos: r.vecinos,
    objetivo: r.objetivo_contactos,
    apoya: r.apoya,
    indeciso: r.indeciso,
    noApoya: r.no_apoya,
    sinDato: r.sin_dato,
    interacciones7d: r.inter7,
    reclamosAbiertos: r.reclamos,
  }));

  // Últimas 8 semanas, incluyendo semanas sin actividad
  const semanas: string[] = [];
  for (let i = 7; i >= 0; i--) semanas.push(lunes(new Date(hoy.getTime() - i * 7 * 86_400_000)));
  const desde = semanas[0] + "T00:00:00.000Z";
  const conteo = new Map<string, number>();
  for (const r of db.prepare(`SELECT fecha FROM interacciones WHERE fecha >= ?${fv.sql}`).all(desde, ...fv.params) as { fecha: string }[]) {
    const s = lunes(new Date(r.fecha));
    conteo.set(s, (conteo.get(s) ?? 0) + 1);
  }
  const porSemana = semanas.map((s) => ({ semana: s, interacciones: conteo.get(s) ?? 0 }));

  const fr = filtroBarrios(u, "r.barrio_id");
  const reclamosPorTema = (
    db
      .prepare(`SELECT t.id, t.nombre, COUNT(r.id) n FROM temas t JOIN reclamos r ON r.tema_id = t.id WHERE 1=1${fr.sql} GROUP BY t.id ORDER BY n DESC`)
      .all(...fr.params) as any[]
  ).map((r) => ({ temaId: r.id, nombre: r.nombre, cantidad: r.n }));

  const fi = filtroBarrios(u, "i.barrio_id");
  const rankingVoluntarios = (
    db
      .prepare(
        `SELECT us.id, us.nombre, COUNT(*) n FROM interacciones i JOIN usuarios us ON us.id = i.usuario_id
         WHERE i.fecha >= ?${fi.sql} GROUP BY us.id ORDER BY n DESC LIMIT 10`,
      )
      .all(hace7, ...fi.params) as any[]
  ).map((r) => ({ usuarioId: r.id, nombre: r.nombre, interacciones: r.n }));

  const cfg = leerConfig(db);
  let diasParaEleccion: number | null = null;
  if (cfg.fechaEleccion) {
    const e = new Date(cfg.fechaEleccion + "T00:00:00-03:00").getTime();
    diasParaEleccion = Math.ceil((e - hoy.getTime()) / 86_400_000);
  }

  return { totales, apoyo, porBarrio, porSemana, reclamosPorTema, rankingVoluntarios, diasParaEleccion };
}
