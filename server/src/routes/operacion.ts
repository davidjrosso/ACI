import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ActividadInputSchema, ESTADOS_RECLAMO, LoteInteraccionesSchema, ReclamoInputSchema, TIPOS_RECLAMO } from "@territorio/shared";
import { requiere, validar } from "../app.js";
import { registrarLote, listarInteracciones } from "../servicios/interacciones.js";
import * as rs from "../servicios/reclamos.js";
import * as as from "../servicios/actividades.js";
import { calcularTablero } from "../servicios/tablero.js";

const Id = z.object({ id: z.string().uuid() });

/** Timbreo, reclamos, agenda y tablero. */
export async function rutasOperacion(app: FastifyInstance) {
  const todos = { preHandler: requiere() };

  // Interacciones: se reciben siempre en lote (la PWA sincroniza su cola offline)
  app.post("/interacciones/lote", todos, async (req) => {
    const { interacciones } = validar(LoteInteraccionesSchema, req.body);
    return registrarLote(req.ctx.db, req.ctx.usuario, interacciones);
  });
  app.get("/interacciones", todos, async (req) => {
    const f = validar(
      z.object({
        barrioId: z.string().uuid().optional(),
        usuarioId: z.string().uuid().optional(),
        desde: z.string().optional(),
        limite: z.coerce.number().int().optional(),
      }),
      req.query,
    );
    return listarInteracciones(req.ctx.db, req.ctx.usuario, f);
  });

  // Reclamos y propuestas
  app.get("/reclamos", todos, async (req) => {
    const f = validar(
      z.object({
        barrioId: z.string().uuid().optional(),
        temaId: z.string().uuid().optional(),
        estado: z.enum(ESTADOS_RECLAMO).optional(),
        tipo: z.enum(TIPOS_RECLAMO).optional(),
      }),
      req.query,
    );
    return rs.listarReclamos(req.ctx.db, req.ctx.usuario, f);
  });
  app.post("/reclamos", todos, async (req) => rs.crearReclamo(req.ctx.db, req.ctx.usuario, validar(ReclamoInputSchema, req.body)));
  app.put("/reclamos/:id", todos, async (req) =>
    rs.actualizarReclamo(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id, validar(ReclamoInputSchema, req.body)),
  );
  app.patch("/reclamos/:id/estado", todos, async (req) =>
    rs.cambiarEstadoReclamo(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id, validar(z.object({ estado: z.enum(ESTADOS_RECLAMO) }), req.body).estado),
  );

  // Agenda
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

  // Tablero
  app.get("/tablero", todos, async (req) => calcularTablero(req.ctx.db, req.ctx.usuario));
}
