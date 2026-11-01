import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { telefonoWhatsApp, completarPlantilla } from "@territorio/shared";
import { construirApp } from "../src/app.js";
import { config } from "../src/config.js";

let app: FastifyInstance;
let dir: string;
const TOKEN = "token-de-prueba-123";

async function login(email: string, password: string, campania = "test") {
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { campania, email, password } });
  expect(r.statusCode, r.body).toBe(200);
  const c = r.cookies.find((x) => x.name === "territorio_sesion")!;
  return { cookie: `${c.name}=${c.value}`, body: r.json() };
}

const pedir = (cookie: string) => ({
  get: (url: string) => app.inject({ method: "GET", url, headers: { cookie } }),
  post: (url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as any, headers: { cookie } }),
  put: (url: string, payload: unknown) => app.inject({ method: "PUT", url, payload: payload as any, headers: { cookie } }),
  del: (url: string) => app.inject({ method: "DELETE", url, headers: { cookie } }),
});

let comando: ReturnType<typeof pedir>;
let voluntario: ReturnType<typeof pedir>;
let barrioA: string, barrioB: string, temaId: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "territorio-test-"));
  app = await construirApp({ ...config, dataDir: dir, platformToken: TOKEN, webDist: join(dir, "no-existe") }, { logger: false });

  const alta = await app.inject({
    method: "POST",
    url: "/api/plataforma/campanias",
    headers: { "x-platform-token": TOKEN },
    payload: {
      slug: "test",
      config: { nombre: "Campaña Test", candidato: "Ana Test", ciudad: "Ciudad Test", colorPrimario: "#112233", colorSecundario: "#445566" },
      admin: { nombre: "Admin", email: "admin@test.ar", password: "secreto123" },
    },
  });
  expect(alta.statusCode, alta.body).toBe(200);

  comando = pedir((await login("admin@test.ar", "secreto123")).cookie);
  barrioA = (await comando.post("/api/barrios", { nombre: "Norte" })).json().id;
  barrioB = (await comando.post("/api/barrios", { nombre: "Sur" })).json().id;
  temaId = (await comando.post("/api/temas", { nombre: "Calles" })).json().id;
  const v = await comando.post("/api/usuarios", { nombre: "Vol", email: "vol@test.ar", rol: "voluntario", barrioIds: [barrioA], password: "secreto123" });
  expect(v.statusCode, v.body).toBe(200);
  voluntario = pedir((await login("vol@test.ar", "secreto123")).cookie);
});

afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("plataforma y sesión", () => {
  it("rechaza crear campañas sin token", async () => {
    const r = await app.inject({ method: "POST", url: "/api/plataforma/campanias", payload: {} });
    expect(r.statusCode).toBe(403);
  });

  it("rechaza credenciales incorrectas sin revelar cuál falló", async () => {
    const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { campania: "test", email: "admin@test.ar", password: "mal" } });
    expect(r.statusCode).toBe(401);
    expect(r.json().error).toMatch(/incorrectos/);
  });

  it("exige sesión para la API", async () => {
    expect((await app.inject({ method: "GET", url: "/api/catalogos" })).statusCode).toBe(401);
  });

  it("devuelve catálogos con config, barrios y plantillas iniciales", async () => {
    const c = (await comando.get("/api/catalogos")).json();
    expect(c.config.candidato).toBe("Ana Test");
    expect(c.barrios).toHaveLength(2);
    expect(c.plantillas.length).toBeGreaterThanOrEqual(3);
  });
});

describe("roles y alcance territorial", () => {
  it("el voluntario no puede cambiar la configuración", async () => {
    expect((await voluntario.put("/api/config", { lema: "x" })).statusCode).toBe(403);
    expect((await voluntario.post("/api/barrios", { nombre: "Oeste" })).statusCode).toBe(403);
  });

  it("el voluntario solo carga y ve vecinos de sus barrios", async () => {
    const ok = await voluntario.post("/api/vecinos", { nombre: "Juana", barrioId: barrioA, telefono: "3571 15 401234" });
    expect(ok.statusCode, ok.body).toBe(200);
    const fuera = await voluntario.post("/api/vecinos", { nombre: "Pedro", barrioId: barrioB });
    expect(fuera.statusCode).toBe(403);
    await comando.post("/api/vecinos", { nombre: "Otro", barrioId: barrioB });
    const lista = (await voluntario.get("/api/vecinos")).json();
    expect(lista.items.every((v: any) => v.barrioId === barrioA)).toBe(true);
    const todos = (await comando.get("/api/vecinos")).json();
    expect(todos.total).toBe(2);
  });

  it("detecta teléfonos duplicados aunque estén escritos distinto", async () => {
    const r = await comando.post("/api/vecinos", { nombre: "Juana bis", barrioId: barrioA, telefono: "+54 9 3571 401234" });
    expect(r.statusCode).toBe(409);
  });
});

describe("timbreo offline", () => {
  it("el lote es idempotente y actualiza el apoyo del vecino", async () => {
    const vecinoId = crypto.randomUUID();
    const lote = {
      interacciones: [
        {
          id: crypto.randomUUID(),
          barrioId: barrioA,
          canal: "puerta",
          resultado: "atendio",
          apoyo: "apoya",
          temaId,
          fecha: new Date().toISOString(),
          vecinoNuevo: { id: vecinoId, nombre: "Rosa", barrioId: barrioA, apoyo: "apoya", consentimiento: true },
        },
        { id: crypto.randomUUID(), barrioId: barrioA, canal: "puerta", resultado: "no_estaba", fecha: new Date().toISOString(), direccion: "Mitre 123" },
        { id: crypto.randomUUID(), barrioId: barrioB, canal: "puerta", resultado: "no_estaba", fecha: new Date().toISOString() },
      ],
    };
    const r1 = (await voluntario.post("/api/interacciones/lote", lote)).json();
    expect(r1.aceptadas).toHaveLength(2);
    expect(r1.rechazadas).toHaveLength(1); // barrio B no está asignado
    const r2 = (await voluntario.post("/api/interacciones/lote", lote)).json();
    expect(r2.duplicadas).toHaveLength(2);
    expect(r2.aceptadas).toHaveLength(0);

    const v = (await voluntario.get(`/api/vecinos/${vecinoId}`)).json();
    expect(v.apoyo).toBe("apoya");
    expect(v.consentimiento).toBe(true);
    expect(v.consentimientoFecha).toBeTruthy();
    const hist = (await voluntario.get(`/api/vecinos/${vecinoId}/historial`)).json();
    expect(hist).toHaveLength(1);
  });
});

describe("tablero, reclamos, agenda y exportación", () => {
  it("calcula el tablero con alcance", async () => {
    await comando.post("/api/reclamos", { tipo: "reclamo", temaId, barrioId: barrioB, descripcion: "Pozo en la esquina" });
    const tc = (await comando.get("/api/tablero")).json();
    expect(tc.totales.vecinos).toBe(3);
    expect(tc.porSemana).toHaveLength(8);
    expect(tc.reclamosPorTema[0].cantidad).toBe(1);
    const tv = (await voluntario.get("/api/tablero")).json();
    expect(tv.porBarrio).toHaveLength(1);
    expect(tv.totales.reclamosAbiertos).toBe(0);
  });

  it("el voluntario no edita la agenda; el comando sí", async () => {
    const act = { titulo: "Caminata", tipo: "caminata", inicio: new Date().toISOString(), barrioId: barrioA, conCandidato: true };
    expect((await voluntario.post("/api/actividades", act)).statusCode).toBe(403);
    expect((await comando.post("/api/actividades", act)).statusCode).toBe(200);
    expect((await voluntario.get("/api/actividades")).json()).toHaveLength(1);
  });

  it("exporta CSV con ; solo para comando", async () => {
    expect((await voluntario.get("/api/vecinos/exportar.csv")).statusCode).toBe(403);
    const r = await comando.get("/api/vecinos/exportar.csv");
    expect(r.statusCode).toBe(200);
    expect(r.body.split("\r\n")[0]).toContain("Nombre;Apellido;Teléfono");
  });

  it("anonimiza al dar de baja un vecino", async () => {
    const v = (await comando.post("/api/vecinos", { nombre: "Borrar", barrioId: barrioA, telefono: "3571 409999" })).json();
    expect((await comando.del(`/api/vecinos/${v.id}`)).statusCode).toBe(200);
    expect((await comando.get(`/api/vecinos/${v.id}`)).statusCode).toBe(404);
  });

  it("no permite dejar la campaña sin comando", async () => {
    const usuarios = (await comando.get("/api/usuarios")).json();
    const admin = usuarios.find((u: any) => u.rol === "comando");
    const r = await comando.put(`/api/usuarios/${admin.id}`, { ...admin, rol: "voluntario", barrioIds: [barrioA] });
    expect(r.statusCode).toBe(409);
  });
});

describe("utilidades compartidas", () => {
  it("normaliza teléfonos argentinos para WhatsApp", () => {
    expect(telefonoWhatsApp("3571 15 401234")).toBe("5493571401234");
    expect(telefonoWhatsApp("+54 9 351 555-1234")).toBe("5493515551234");
    expect(telefonoWhatsApp("011 15 5555 1234")).toBe("5491155551234");
    expect(telefonoWhatsApp("123")).toBeNull();
  });
  it("completa plantillas", () => {
    expect(completarPlantilla("Hola {nombre} de {barrio}", { nombre: "Ana", barrio: "Centro" })).toBe("Hola Ana de Centro");
  });
});
