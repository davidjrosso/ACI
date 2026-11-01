import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { APOYOS, VecinoInputSchema } from "@territorio/shared";
import { requiere, validar } from "../app.js";
import { prohibido } from "../servicios/comun.js";
import * as vs from "../servicios/vecinos.js";

const Id = z.object({ id: z.string().uuid() });
const Filtro = z.object({
  q: z.string().max(80).optional(),
  barrioId: z.string().uuid().optional(),
  apoyo: z.enum(APOYOS).optional(),
  etiqueta: z.string().max(30).optional(),
  consentimiento: z.enum(["si", "no"]).optional().transform((v) => (v === undefined ? undefined : v === "si")),
  limite: z.coerce.number().int().min(1).max(5000).optional(),
  desde: z.coerce.number().int().min(0).optional(),
});

export async function rutasVecinos(app: FastifyInstance) {
  const todos = { preHandler: requiere() };

  app.get("/vecinos", todos, async (req) => vs.listarVecinos(req.ctx.db, req.ctx.usuario, validar(Filtro, req.query)));
  app.get("/vecinos/etiquetas", todos, async (req) => vs.listarEtiquetas(req.ctx.db));
  app.get("/vecinos/exportar.csv", { preHandler: requiere("comando") }, async (req, reply) => {
    const csv = vs.exportarCsv(req.ctx.db, req.ctx.usuario, validar(Filtro, req.query));
    const fecha = new Date().toISOString().slice(0, 10);
    reply.header("content-type", "text/csv; charset=utf-8").header("content-disposition", `attachment; filename="vecinos-${fecha}.csv"`);
    return csv;
  });
  app.get("/vecinos/:id", todos, async (req) => vs.obtenerVecino(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id));
  app.get("/vecinos/:id/historial", todos, async (req) => vs.historialVecino(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id));
  app.post("/vecinos", todos, async (req) => vs.crearVecino(req.ctx.db, req.ctx.usuario, validar(VecinoInputSchema, req.body)));
  app.put("/vecinos/:id", todos, async (req) =>
    vs.actualizarVecino(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id, validar(VecinoInputSchema, req.body)),
  );
  app.delete("/vecinos/:id", todos, async (req) => {
    if (req.ctx.usuario.rol === "voluntario") throw prohibido("Solo referentes y comando pueden dar de baja vecinos");
    vs.eliminarVecino(req.ctx.db, req.ctx.usuario, validar(Id, req.params).id);
    return { ok: true };
  });
}
