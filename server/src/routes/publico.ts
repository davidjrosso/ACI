import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { SumateSchema } from "@aci/shared";
import { ZodError } from "zod";
import { COOKIE } from "../app.js";
import { buscarSesion } from "../auth.js";
import { leerConfig, leerSitio, listarBarrios, listarTemas } from "../servicios/configuracion.js";
import { noticiaDestacada, noticiaPublicaPorSlug, noticiasPublicas, listarPropuestas } from "../servicios/noticias.js";
import { agendaPublica } from "../servicios/actividades.js";
import { registrarSumate } from "../servicios/adhesiones.js";
import { obtenerUsuario } from "../servicios/usuarios.js";
import * as v from "../sitio/vistas.js";

/** Origen público (https://host) para URLs absolutas. PUBLIC_URL tiene prioridad. */
export function origen(req: FastifyRequest): string {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  return `${req.protocol}://${req.headers["x-forwarded-host"] ?? req.headers.host}`;
}

/** URL del sitio de una campaña: dominio propio si tiene, o /s/<slug> en la plataforma. */
export function urlSitio(app: FastifyInstance, req: FastifyRequest, slug: string): string {
  const dom = app.registro.plataforma.prepare("SELECT host FROM dominios WHERE campania = ? LIMIT 1").get(slug) as { host: string } | undefined;
  return dom ? `https://${dom.host}` : `${origen(req)}/s/${slug}`;
}

// Límite de envíos del formulario por IP (en memoria)
const envios = new Map<string, { n: number; hasta: number }>();
function limiteSumate(ip: string): boolean {
  const ahora = Date.now();
  const r = envios.get(ip);
  if (!r || r.hasta < ahora) {
    envios.set(ip, { n: 1, hasta: ahora + 3600_000 });
    return true;
  }
  r.n++;
  return r.n <= 20;
}

export async function rutasPublicas(app: FastifyInstance) {
  // Formularios HTML clásicos (funcionan sin JavaScript)
  app.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string", bodyLimit: 20_000 }, (_req, cuerpo, hecho) => {
    const p = new URLSearchParams(cuerpo as string);
    const obj: Record<string, unknown> = {};
    for (const k of new Set(p.keys())) obj[k] = k === "ayudas" ? p.getAll(k) : p.get(k);
    hecho(null, obj);
  });

  /** Arma el contexto del sitio o responde 404 / "próximamente". */
  function contexto(req: FastifyRequest, reply: FastifyReply, slug: string): v.Ctx | null {
    if (!app.registro.existe(slug)) {
      reply.status(404).type("text/html").send("<h1>Sitio no encontrado</h1>");
      return null;
    }
    const db = app.registro.campania(slug);
    const cfg = leerConfig(db);
    const sitio = leerSitio(db);
    const porDominio = app.registro.campaniaPorHost(req.headers.host) === slug;
    // El equipo con sesión iniciada puede ver el sitio antes de publicarlo
    const token = req.cookies[COOKIE];
    const s = token ? buscarSesion(app.registro.plataforma, token) : null;
    const delEquipo = Boolean(s && s.campania === slug && obtenerUsuario(db, s.usuarioId)?.activo);
    const c: v.Ctx = { slug, base: porDominio ? "" : `/s/${slug}`, origen: origen(req), cfg, sitio, temas: listarTemas(db), vistaPrevia: delEquipo };
    if (!sitio.publicado && !delEquipo) {
      reply.status(200).type("text/html").header("cache-control", "no-store").send(v.vistaNoPublicado(c));
      return null;
    }
    return c;
  }

  const enviar = (reply: FastifyReply, cuerpo: string, c: v.Ctx, status = 200) =>
    reply
      .status(status)
      .type("text/html; charset=utf-8")
      // Caché corta en el borde para soportar picos (ej. una nota que se viraliza en WhatsApp)
      .header("cache-control", c.vistaPrevia ? "private, no-store" : "public, max-age=60")
      .header("x-content-type-options", "nosniff")
      .header("referrer-policy", "strict-origin-when-cross-origin")
      .send(cuerpo);

  const Params = (req: FastifyRequest) => req.params as { slug: string; nota?: string };

  app.get("/s/:slug", async (req, reply) => reply.redirect(`/s/${Params(req).slug}/`, 301));

  app.get("/s/:slug/", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const db = app.registro.campania(c.slug);
    const dias = c.cfg.fechaEleccion ? Math.ceil((new Date(c.cfg.fechaEleccion + "T00:00:00-03:00").getTime() - Date.now()) / 86_400_000) : null;
    return enviar(
      reply,
      v.vistaInicio(c, {
        destacada: noticiaDestacada(db),
        ultimas: noticiasPublicas(db, { limite: 4 }).items,
        propuestas: listarPropuestas(db, true),
        agenda: agendaPublica(db, 6),
        barrios: listarBarrios(db),
        dias,
      }),
      c,
    );
  });

  app.get("/s/:slug/noticias", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const q = req.query as { pagina?: string; tema?: string };
    const pagina = Math.max(1, parseInt(q.pagina ?? "1", 10) || 1);
    const temaId = q.tema && c.temas.some((t) => t.id === q.tema) ? q.tema : undefined;
    const porPagina = 12;
    const r = noticiasPublicas(app.registro.campania(c.slug), { limite: porPagina, desde: (pagina - 1) * porPagina, temaId });
    return enviar(reply, v.vistaNoticias(c, { ...r, pagina, porPagina, temaId }), c);
  });

  app.get("/s/:slug/noticias/:nota", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const db = app.registro.campania(c.slug);
    const n = noticiaPublicaPorSlug(db, Params(req).nota ?? "");
    if (!n) return enviar(reply, v.vistaNoEncontrada(c), c, 404);
    const otras = noticiasPublicas(db, { limite: 7, temaId: n.temaId ?? undefined }).items.filter((x) => x.id !== n.id);
    const relacionadas = (otras.length >= 2 ? otras : noticiasPublicas(db, { limite: 4 }).items.filter((x) => x.id !== n.id)).slice(0, 3);
    return enviar(reply, v.vistaNoticia(c, n, relacionadas), c);
  });

  app.get("/s/:slug/noticias.rss", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    reply.type("application/rss+xml; charset=utf-8").header("cache-control", "public, max-age=300");
    return v.rss(c, noticiasPublicas(app.registro.campania(c.slug), { limite: 30 }).items);
  });

  app.get("/s/:slug/propuestas", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    return enviar(reply, v.vistaPropuestas(c, listarPropuestas(app.registro.campania(c.slug), true)), c);
  });

  app.get("/s/:slug/agenda", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const db = app.registro.campania(c.slug);
    return enviar(reply, v.vistaAgenda(c, agendaPublica(db, 50), listarBarrios(db)), c);
  });

  app.get("/s/:slug/quien-soy", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    return enviar(reply, v.vistaQuien(c), c);
  });

  app.get("/s/:slug/privacidad", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    return enviar(reply, v.vistaPrivacidad(c), c);
  });

  app.get("/s/:slug/sumate", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const ok = (req.query as { ok?: string }).ok === "1";
    return enviar(reply, v.vistaSumate(c, listarBarrios(app.registro.campania(c.slug)), { ok }), c);
  });

  app.post("/s/:slug/sumate", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const db = app.registro.campania(c.slug);
    const cuerpo = (req.body ?? {}) as Record<string, unknown>;
    const barrios = listarBarrios(db);
    if (!limiteSumate(req.ip)) return enviar(reply, v.vistaSumate(c, barrios, { error: "Recibimos muchos envíos desde tu conexión. Probá de nuevo en un rato.", valores: cuerpo }), c, 429);
    // Honeypot: un bot completó el campo oculto. Respondemos "ok" sin guardar nada.
    if (typeof cuerpo.sitio_web === "string" && cuerpo.sitio_web.length > 0) return reply.redirect(`${c.base}/sumate?ok=1`, 303);
    try {
      const datos = SumateSchema.parse({ ...cuerpo, consentimiento: cuerpo.consentimiento === "1" || cuerpo.consentimiento === true });
      registrarSumate(db, datos);
      return reply.redirect(`${c.base}/sumate?ok=1`, 303);
    } catch (e) {
      const msg =
        e instanceof ZodError
          ? e.issues.some((i) => i.path[0] === "consentimiento")
            ? "Necesitamos que aceptes el uso de tus datos para poder contactarte."
            : e.issues.some((i) => i.path[0] === "telefono")
              ? "Revisá el número de celular."
              : e.issues.some((i) => i.path[0] === "nombre")
                ? "Completá tu nombre."
                : "Revisá los datos del formulario."
          : "No pudimos guardar tus datos. Probá de nuevo.";
      return enviar(reply, v.vistaSumate(c, barrios, { error: msg, valores: cuerpo }), c, 400);
    }
  });

  // SEO: robots y sitemap por sitio
  app.get("/s/:slug/robots.txt", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    reply.type("text/plain");
    return `User-agent: *\nAllow: /\nSitemap: ${c.origen}${c.base}/sitemap.xml\n`;
  });
  app.get("/s/:slug/sitemap.xml", async (req, reply) => {
    const c = contexto(req, reply, Params(req).slug);
    if (!c) return;
    const db = app.registro.campania(c.slug);
    const urls = ["/", "/noticias", "/propuestas", "/agenda", "/quien-soy", "/sumate", ...noticiasPublicas(db, { limite: 1000 }).items.map((n) => `/noticias/${n.slug}`)];
    reply.type("application/xml");
    return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<url><loc>${c.origen}${c.base}${u}</loc></url>`).join("")}</urlset>`;
  });
}
