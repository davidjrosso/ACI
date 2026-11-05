import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { BarrioInputSchema, ConfigCampaniaSchema, ROLES_SITIO, SitioConfigSchema, TemaInputSchema, UsuarioInputSchema } from "@aci/shared";
import { requiere, validar } from "../app.js";
import { borrarSesionesDeUsuario } from "../auth.js";
import { auditar, ErrorApp } from "../servicios/comun.js";
import * as cfg from "../servicios/configuracion.js";
import * as us from "../servicios/usuarios.js";

const Id = z.object({ id: z.string().uuid() });

/**
 * Parametrización de la campaña. Lectura: todo el equipo (la app necesita barrios, temas, plantillas).
 * Escritura: solo el rol "comando".
 */
export async function rutasConfiguracion(app: FastifyInstance) {
  const todos = { preHandler: requiere() };
  const comando = { preHandler: requiere("comando") };

  // Paquete de catálogos en una sola llamada (la PWA lo guarda para uso offline)
  app.get("/catalogos", todos, async (req) => ({
    config: cfg.leerConfig(req.ctx.db),
    barrios: cfg.listarBarrios(req.ctx.db),
    temas: cfg.listarTemas(req.ctx.db),
    sitio: cfg.leerSitio(req.ctx.db),
    equipo: us.listarUsuarios(req.ctx.db).filter((u) => u.activo).map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol })),
  }));

  app.put("/config", comando, async (req) => {
    const parcial = validar(ConfigCampaniaSchema.partial(), req.body);
    const r = cfg.guardarConfig(req.ctx.db, parcial);
    auditar(req.ctx.db, req.ctx.usuario.id, "actualizar", "config", null);
    return r;
  });

  // Barrios
  app.post("/barrios", comando, async (req) => cfg.crearBarrio(req.ctx.db, validar(BarrioInputSchema, req.body)));
  app.put("/barrios/:id", comando, async (req) => cfg.actualizarBarrio(req.ctx.db, validar(Id, req.params).id, validar(BarrioInputSchema, req.body)));
  app.delete("/barrios/:id", comando, async (req) => {
    cfg.borrarBarrio(req.ctx.db, validar(Id, req.params).id);
    return { ok: true };
  });
  app.post("/barrios/importar-geojson", comando, async (req) => {
    const { geojson, propiedadNombre } = validar(z.object({ geojson: z.any(), propiedadNombre: z.string().default("nombre") }), req.body);
    return cfg.importarGeoJSON(req.ctx.db, geojson, propiedadNombre);
  });

  // Temas
  app.post("/temas", comando, async (req) => cfg.crearTema(req.ctx.db, validar(TemaInputSchema, req.body)));
  app.put("/temas/:id", comando, async (req) => cfg.actualizarTema(req.ctx.db, validar(Id, req.params).id, validar(TemaInputSchema, req.body)));
  app.delete("/temas/:id", comando, async (req) => {
    cfg.borrarTema(req.ctx.db, validar(Id, req.params).id);
    return { ok: true };
  });

  // Sitio público (textos, redes, foto). Lo editan comando y comunicación.
  app.put("/sitio/config", { preHandler: requiere(...ROLES_SITIO) }, async (req) => {
    const r = cfg.guardarSitio(req.ctx.db, validar(SitioConfigSchema.partial(), req.body));
    auditar(req.ctx.db, req.ctx.usuario.id, "actualizar", "sitio", null);
    return r;
  });

  // Usuarios del equipo
  app.get("/usuarios", { preHandler: requiere("comando", "referente") }, async (req) => us.listarUsuarios(req.ctx.db));
  app.post("/usuarios", comando, async (req) => {
    const u = us.crearUsuario(req.ctx.db, validar(UsuarioInputSchema, req.body));
    auditar(req.ctx.db, req.ctx.usuario.id, "crear", "usuario", u.id);
    return u;
  });
  app.put("/usuarios/:id", comando, async (req) => {
    const { id } = validar(Id, req.params);
    const datos = validar(UsuarioInputSchema, req.body);
    const previo = us.obtenerUsuario(req.ctx.db, id);
    const dejaDeSerComando = previo?.rol === "comando" && (datos.rol !== "comando" || !datos.activo);
    if (dejaDeSerComando && us.cantidadComandoActivos(req.ctx.db) <= 1) {
      throw new ErrorApp(409, "Tiene que quedar al menos un usuario de comando activo");
    }
    const u = us.actualizarUsuario(req.ctx.db, id, datos);
    if (!u.activo || datos.password) borrarSesionesDeUsuario(app.registro.plataforma, req.ctx.slug, id);
    auditar(req.ctx.db, req.ctx.usuario.id, "actualizar", "usuario", id);
    return u;
  });
}
