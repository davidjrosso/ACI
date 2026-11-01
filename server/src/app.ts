import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { z, ZodError, type ZodTypeAny } from "zod";
import type { Rol, Usuario } from "@territorio/shared";
import type { AppConfig } from "./config.js";
import { RegistroBases } from "./db/registro.js";
import type { DB } from "./db/conexion.js";
import { buscarSesion, limpiarSesionesVencidas } from "./auth.js";
import { ErrorApp, prohibido } from "./servicios/comun.js";
import { obtenerUsuario } from "./servicios/usuarios.js";
import { rutasAuth } from "./routes/auth.js";
import { rutasConfiguracion } from "./routes/configuracion.js";
import { rutasVecinos } from "./routes/vecinos.js";
import { rutasOperacion } from "./routes/operacion.js";

export const COOKIE = "territorio_sesion";

export interface Contexto {
  slug: string;
  db: DB;
  usuario: Usuario;
}

declare module "fastify" {
  interface FastifyRequest {
    ctx: Contexto;
  }
  interface FastifyInstance {
    registro: RegistroBases;
    appConfig: AppConfig;
  }
}

/** Valida datos con un esquema zod y devuelve 400 con mensajes legibles si fallan. */
export function validar<S extends ZodTypeAny>(schema: S, datos: unknown): z.output<S> {
  return schema.parse(datos);
}

/** preHandler: exige sesión válida y, opcionalmente, uno de los roles indicados. */
export function requiere(...roles: Rol[]) {
  return async (req: FastifyRequest) => {
    const token = req.cookies[COOKIE];
    if (!token) throw new ErrorApp(401, "Iniciá sesión", "sin_sesion");
    const app = req.server;
    const s = buscarSesion(app.registro.plataforma, token);
    if (!s || !app.registro.existe(s.campania)) throw new ErrorApp(401, "La sesión venció, volvé a ingresar", "sin_sesion");
    const db = app.registro.campania(s.campania);
    const usuario = obtenerUsuario(db, s.usuarioId);
    if (!usuario || !usuario.activo) throw new ErrorApp(401, "Usuario inactivo", "sin_sesion");
    if (roles.length && !roles.includes(usuario.rol)) throw prohibido();
    req.ctx = { slug: s.campania, db, usuario };
  };
}

export async function construirApp(cfg: AppConfig, opciones: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opciones.logger === false ? false : { level: cfg.logLevel },
    bodyLimit: 5 * 1024 * 1024, // GeoJSON de barrios puede pesar algunos MB
    trustProxy: true,
  });
  app.decorate("registro", new RegistroBases(cfg.dataDir));
  app.decorate("appConfig", cfg);
  app.addHook("onClose", async () => app.registro.cerrar());

  await app.register(cookie);

  app.setErrorHandler((err: any, req, reply: FastifyReply) => {
    if (err instanceof ErrorApp) return reply.status(err.status).send({ error: err.message, codigo: err.codigo });
    if (err instanceof ZodError) {
      const detalle = err.issues.map((i) => `${i.path.join(".") || "dato"}: ${i.message}`);
      return reply.status(400).send({ error: "Datos inválidos", codigo: "validacion", detalle });
    }
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: err.message, codigo: "solicitud" });
    req.log.error(err);
    return reply.status(500).send({ error: "Error interno del servidor", codigo: "interno" });
  });

  app.get("/api/salud", async () => ({ ok: true, version: process.env.npm_package_version ?? "0.1.0", campanias: app.registro.listarSlugs().length }));

  await app.register(rutasAuth, { prefix: "/api" });
  await app.register(rutasConfiguracion, { prefix: "/api" });
  await app.register(rutasVecinos, { prefix: "/api" });
  await app.register(rutasOperacion, { prefix: "/api" });

  // Limpieza periódica de sesiones vencidas
  const timer = setInterval(() => limpiarSesionesVencidas(app.registro.plataforma), 6 * 3600_000);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));

  // Web (PWA) servida desde el mismo proceso en producción
  if (existsSync(cfg.webDist)) {
    await app.register(fastifyStatic, { root: cfg.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api/")) return reply.status(404).send({ error: "Ruta no encontrada", codigo: "no_encontrado" });
      return reply.sendFile("index.html");
    });
  }

  return app;
}
