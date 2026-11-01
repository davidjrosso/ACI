import type { FastifyInstance } from "fastify";
import { CrearCampaniaSchema, LoginSchema, type Sesion } from "@territorio/shared";
import { timingSafeEqual } from "node:crypto";
import { COOKIE, requiere, validar } from "../app.js";
import { borrarSesion, crearSesion, verificarPassword } from "../auth.js";
import { ErrorApp } from "../servicios/comun.js";
import { leerConfig } from "../servicios/configuracion.js";
import { buscarPorEmail } from "../servicios/usuarios.js";
import { crearCampania } from "../servicios/campanias.js";

// Límite simple de intentos de login por IP (en memoria; suficiente para un solo proceso)
const intentos = new Map<string, { n: number; hasta: number }>();
function controlarIntentos(ip: string) {
  const ahora = Date.now();
  const r = intentos.get(ip);
  if (r && r.hasta > ahora && r.n >= 10) throw new ErrorApp(429, "Demasiados intentos. Esperá unos minutos.", "limite");
  if (!r || r.hasta <= ahora) intentos.set(ip, { n: 1, hasta: ahora + 10 * 60_000 });
  else r.n++;
}

export async function rutasAuth(app: FastifyInstance) {
  app.post("/auth/login", async (req, reply) => {
    controlarIntentos(req.ip);
    const datos = validar(LoginSchema, req.body);
    const error = new ErrorApp(401, "Campaña, email o contraseña incorrectos", "credenciales");
    if (!app.registro.existe(datos.campania)) throw error;
    const db = app.registro.campania(datos.campania);
    const u = buscarPorEmail(db, datos.email);
    if (!u || !u.activo || !verificarPassword(datos.password, u.passwordHash)) throw error;
    const { token, expira } = crearSesion(app.registro.plataforma, datos.campania, u.id, app.appConfig.sessionDays);
    reply.setCookie(COOKIE, token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: app.appConfig.cookieSecure,
      expires: expira,
    });
    intentos.delete(req.ip);
    const { passwordHash: _, ...usuario } = u;
    const sesion: Sesion = { usuario, campania: { slug: datos.campania, ...leerConfig(db) } };
    return sesion;
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[COOKIE];
    if (token) borrarSesion(app.registro.plataforma, token);
    reply.clearCookie(COOKIE, { path: "/" });
    return { ok: true };
  });

  app.get("/auth/sesion", { preHandler: requiere() }, async (req): Promise<Sesion> => {
    return { usuario: req.ctx.usuario, campania: { slug: req.ctx.slug, ...leerConfig(req.ctx.db) } };
  });

  /**
   * Alta de una campaña nueva (uso del operador de la plataforma, no del candidato).
   * Requiere el header "x-platform-token" igual a PLATFORM_TOKEN.
   */
  app.post("/plataforma/campanias", async (req) => {
    const esperado = app.appConfig.platformToken;
    const recibido = String(req.headers["x-platform-token"] ?? "");
    const ok = esperado.length > 0 && recibido.length === esperado.length && timingSafeEqual(Buffer.from(recibido), Buffer.from(esperado));
    if (!ok) throw new ErrorApp(403, "Token de plataforma inválido", "prohibido");
    return crearCampania(app.registro, validar(CrearCampaniaSchema, req.body));
  });
}
