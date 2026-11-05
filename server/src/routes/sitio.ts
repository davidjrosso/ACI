import type { FastifyInstance } from "fastify";
import { createReadStream } from "node:fs";
import { z } from "zod";
import { ActividadInputSchema, AYUDAS, ESTADOS_NOTICIA, NoticiaInputSchema, PropuestaInputSchema, ROLES_SITIO } from "@aci/shared";
import { requiere, validar } from "../app.js";
import { ErrorApp } from "../servicios/comun.js";
import * as ns from "../servicios/noticias.js";
import * as im from "../servicios/imagenes.js";
import * as as from "../servicios/actividades.js";
import * as ad from "../servicios/adhesiones.js";
import { urlSitio } from "./publico.js";

const Id = z.object({ id: z.string().uuid() });

/** Gestión del sitio del candidato: noticias, propuestas, imágenes, agenda y adhesiones. */
export async function rutasSitio(app: FastifyInstance) {
  const sitio = { preHandler: requiere(...ROLES_SITIO) };
  const todos = { preHandler: requiere() };
  const adhesiones = { preHandler: requiere("comando", "referente") };

  // ----- Resumen (inicio del panel) -----
  app.get("/sitio/resumen", todos, async (req) => ad.resumenSitio(req.ctx.db, req.ctx.usuario, urlSitio(app, req, req.ctx.slug)));

  // ----- Noticias -----
  app.get("/noticias", sitio, async (req) =>
    ns.listarNoticias(req.ctx.db, validar(z.object({ estado: z.enum(ESTADOS_NOTICIA).optional(), q: z.string().max(80).optional() }), req.query)),
  );
  app.get("/noticias/:id", sitio, async (req) => ns.obtenerNoticia(req.ctx.db, validar(Id, req.params).id));
  app.post("/noticias", sitio, async (req) => ns.crearNoticia(req.ctx.db, req.ctx.usuario.id, validar(NoticiaInputSchema, req.body)));
  app.put("/noticias/:id", sitio, async (req) =>
    ns.actualizarNoticia(req.ctx.db, req.ctx.usuario.id, validar(Id, req.params).id, validar(NoticiaInputSchema, req.body)),
  );
  app.delete("/noticias/:id", sitio, async (req) => {
    ns.borrarNoticia(req.ctx.db, req.ctx.usuario.id, validar(Id, req.params).id);
    return { ok: true };
  });

  // ----- Propuestas -----
  app.get("/propuestas", sitio, async (req) => ns.listarPropuestas(req.ctx.db));
  app.post("/propuestas", sitio, async (req) => ns.crearPropuesta(req.ctx.db, req.ctx.usuario.id, validar(PropuestaInputSchema, req.body)));
  app.put("/propuestas/:id", sitio, async (req) =>
    ns.actualizarPropuesta(req.ctx.db, req.ctx.usuario.id, validar(Id, req.params).id, validar(PropuestaInputSchema, req.body)),
  );
  app.delete("/propuestas/:id", sitio, async (req) => {
    ns.borrarPropuesta(req.ctx.db, req.ctx.usuario.id, validar(Id, req.params).id);
    return { ok: true };
  });

  // ----- Imágenes -----
  app.get("/imagenes", sitio, async (req) => im.listarImagenes(req.ctx.db));
  app.post("/imagenes", sitio, async (req) => {
    const archivo = await req.file();
    if (!archivo) throw new ErrorApp(400, "No llegó ninguna imagen");
    const datos = await archivo.toBuffer();
    const alt = typeof (archivo.fields as any)?.alt?.value === "string" ? (archivo.fields as any).alt.value.slice(0, 200) : null;
    return im.guardarImagen(req.ctx.db, app.registro.rutaMedia(req.ctx.slug), datos, archivo.mimetype, req.ctx.usuario.id, alt);
  });
  app.delete("/imagenes/:id", sitio, async (req) => {
    im.borrarImagen(req.ctx.db, app.registro.rutaMedia(req.ctx.slug), validar(Id, req.params).id);
    return { ok: true };
  });

  // ----- Agenda -----
  app.get("/actividades", todos, async (req) =>
    as.listarActividades(req.ctx.db, req.ctx.usuario, validar(z.object({ desde: z.string().optional(), hasta: z.string().optional() }), req.query)),
  );
  app.post("/actividades", todos, async (req) => as.crearActividad(req.ctx.db, req.ctx.usuario, validar(ActividadInputSchema, req.body)));
  app.put("/actividades/:id", todos, async (req) =>
    as.actualizarActividad(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id, validar(ActividadInputSchema, req.body)),
  );
  app.delete("/actividades/:id", todos, async (req) => {
    as.borrarActividad(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id);
    return { ok: true };
  });

  // ----- Adhesiones (gente que se sumó desde el sitio) -----
  const FiltroAd = z.object({
    barrioId: z.string().uuid().optional(),
    ayuda: z.enum(AYUDAS).optional(),
    pendientes: z.enum(["si", "no"]).optional().transform((v) => v === "si"),
    q: z.string().max(80).optional(),
  });
  app.get("/adhesiones", adhesiones, async (req) => ad.listarAdhesiones(req.ctx.db, req.ctx.usuario, validar(FiltroAd, req.query)));
  app.get("/adhesiones/exportar.csv", { preHandler: requiere("comando") }, async (req, reply) => {
    const csv = ad.exportarAdhesionesCsv(req.ctx.db, req.ctx.usuario, validar(FiltroAd, req.query));
    reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="sumados-${new Date().toISOString().slice(0, 10)}.csv"`);
    return csv;
  });
  app.patch("/adhesiones/:id", adhesiones, async (req) =>
    ad.marcarContactado(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id, validar(z.object({ contactado: z.boolean() }), req.body).contactado),
  );
  app.delete("/adhesiones/:id", adhesiones, async (req) => {
    ad.eliminarAdhesion(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id);
    return { ok: true };
  });
}

/** Archivos de imagen. Públicos (los usa el sitio), con caché larga porque nunca cambian. */
export async function rutasMedia(app: FastifyInstance) {
  app.get("/m/:slug/:archivo", async (req, reply) => {
    const { slug, archivo } = validar(z.object({ slug: z.string().regex(/^[a-z0-9-]{3,40}$/), archivo: z.string().max(60) }), req.params);
    const m = archivo.match(/^([0-9a-f-]{36})-(g|m|og)\.(webp|jpg)$/);
    if (!m || !app.registro.existe(slug)) throw new ErrorApp(404, "Imagen no encontrada");
    const f = im.archivoImagen(app.registro.rutaMedia(slug), m[1]!, m[2] as im.Variante);
    if (!f) throw new ErrorApp(404, "Imagen no encontrada");
    reply.header("content-type", f.tipo).header("cache-control", "public, max-age=31536000, immutable");
    return reply.send(createReadStream(f.ruta));
  });
}
