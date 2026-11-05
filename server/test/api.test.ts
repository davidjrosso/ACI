import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { FastifyInstance } from "fastify";
import { extracto, formatoATexto, slugificar, telefonoWhatsApp } from "@aci/shared";
import { construirApp } from "../src/app.js";
import { config } from "../src/config.js";

let app: FastifyInstance;
let dir: string;
const TOKEN = "token-de-prueba-123";

async function login(email: string, password: string, campania = "test") {
  const r = await app.inject({ method: "POST", url: "/api/auth/login", payload: { campania, email, password } });
  expect(r.statusCode, r.body).toBe(200);
  const c = r.cookies.find((x) => x.name === "aci_sesion")!;
  return `${c.name}=${c.value}`;
}

const como = (cookie?: string) => ({
  get: (url: string, headers: Record<string, string> = {}) => app.inject({ method: "GET", url, headers: { ...(cookie ? { cookie } : {}), ...headers } }),
  post: (url: string, payload: unknown) => app.inject({ method: "POST", url, payload: payload as any, headers: cookie ? { cookie } : {} }),
  put: (url: string, payload: unknown) => app.inject({ method: "PUT", url, payload: payload as any, headers: cookie ? { cookie } : {} }),
  patch: (url: string, payload: unknown) => app.inject({ method: "PATCH", url, payload: payload as any, headers: cookie ? { cookie } : {} }),
  del: (url: string) => app.inject({ method: "DELETE", url, headers: cookie ? { cookie } : {} }),
});
const anonimo = como();
const formulario = (url: string, campos: Record<string, string | string[]>, headers: Record<string, string> = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(campos)) for (const x of [v].flat()) p.append(k, x);
  return app.inject({ method: "POST", url, payload: p.toString(), headers: { "content-type": "application/x-www-form-urlencoded", ...headers } });
};

let comando: ReturnType<typeof como>;
let prensa: ReturnType<typeof como>;
let referente: ReturnType<typeof como>;
let voluntario: ReturnType<typeof como>;
let barrioA: string, barrioB: string, temaId: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "aci-test-"));
  app = await construirApp({ ...config, dataDir: dir, platformToken: TOKEN, webDist: join(dir, "no-existe") }, { logger: false });
  const alta = await app.inject({
    method: "POST",
    url: "/api/plataforma/campanias",
    headers: { "x-platform-token": TOKEN },
    payload: {
      slug: "test",
      config: { nombre: "Frente Test", candidato: "Ana Test", ciudad: "Ciudad Test", colorPrimario: "#0f766e", colorSecundario: "#f59e0b" },
      admin: { nombre: "Admin", email: "admin@test.ar", password: "secreto123" },
    },
  });
  expect(alta.statusCode, alta.body).toBe(200);
  comando = como(await login("admin@test.ar", "secreto123"));
  barrioA = (await comando.post("/api/barrios", { nombre: "Norte" })).json().id;
  barrioB = (await comando.post("/api/barrios", { nombre: "Sur" })).json().id;
  temaId = (await comando.post("/api/temas", { nombre: "Calles" })).json().id;
  for (const [n, e, rol, bs] of [
    ["Prensa", "prensa@test.ar", "comunicacion", []],
    ["Ref", "ref@test.ar", "referente", [barrioA]],
    ["Vol", "vol@test.ar", "voluntario", [barrioA]],
  ] as const) {
    const r = await comando.post("/api/usuarios", { nombre: n, email: e, rol, barrioIds: bs, password: "secreto123" });
    expect(r.statusCode, r.body).toBe(200);
  }
  prensa = como(await login("prensa@test.ar", "secreto123"));
  referente = como(await login("ref@test.ar", "secreto123"));
  voluntario = como(await login("vol@test.ar", "secreto123"));
});

afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("núcleo", () => {
  it("rechaza crear campañas sin token y credenciales incorrectas", async () => {
    expect((await anonimo.post("/api/plataforma/campanias", {})).statusCode).toBe(403);
    expect((await anonimo.post("/api/auth/login", { campania: "test", email: "admin@test.ar", password: "mal" })).statusCode).toBe(401);
    expect((await anonimo.get("/api/catalogos")).statusCode).toBe(401);
  });

  it("comunicación no necesita barrios y no puede tocar la configuración ni el equipo", async () => {
    expect((await prensa.put("/api/config", { lema: "x" })).statusCode).toBe(403);
    expect((await prensa.post("/api/usuarios", { nombre: "X", email: "x@x.ar", rol: "comando", password: "secreto123" })).statusCode).toBe(403);
  });

  it("no permite dejar la campaña sin comando", async () => {
    const admin = (await comando.get("/api/usuarios")).json().find((u: any) => u.rol === "comando");
    expect((await comando.put(`/api/usuarios/${admin.id}`, { ...admin, rol: "comunicacion" })).statusCode).toBe(409);
  });
});

describe("noticias", () => {
  let publicaId: string;

  it("solo comando y comunicación publican", async () => {
    expect((await voluntario.post("/api/noticias", { titulo: "Hola mundo" })).statusCode).toBe(403);
    expect((await referente.get("/api/noticias")).statusCode).toBe(403);
    const r = await prensa.post("/api/noticias", { titulo: "Plan de bacheo", bajada: "Barrio por barrio", cuerpo: "## Qué\n- uno\n- dos", temaId, estado: "publicada" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().slug).toBe("plan-de-bacheo");
    expect(r.json().fecha).toBeTruthy();
    publicaId = r.json().id;
  });

  it("genera slugs únicos y mantiene el link al editar una nota publicada", async () => {
    const b = (await prensa.post("/api/noticias", { titulo: "Plan de bacheo" })).json();
    expect(b.slug).toBe("plan-de-bacheo-2");
    const editada = (await prensa.put(`/api/noticias/${publicaId}`, { titulo: "Plan de bacheo 2027", cuerpo: "x", estado: "publicada" })).json();
    expect(editada.slug).toBe("plan-de-bacheo");
  });

  it("deja una sola noticia destacada", async () => {
    const a = (await prensa.post("/api/noticias", { titulo: "Nota A", estado: "publicada", destacada: true })).json();
    await prensa.post("/api/noticias", { titulo: "Nota B", estado: "publicada", destacada: true });
    expect((await prensa.get(`/api/noticias/${a.id}`)).json().destacada).toBe(false);
  });

  it("el sitio muestra publicadas, oculta borradores y programadas", async () => {
    await comando.put("/api/sitio/config", { publicado: true });
    await prensa.post("/api/noticias", { titulo: "Nota programada futura", estado: "publicada", fecha: new Date(Date.now() + 86_400_000).toISOString() });
    await prensa.post("/api/noticias", { titulo: "Nota en borrador oculta" });
    const lista = await anonimo.get("/s/test/noticias");
    expect(lista.statusCode).toBe(200);
    expect(lista.body).toContain("Plan de bacheo 2027");
    expect(lista.body).not.toContain("Nota programada futura");
    expect(lista.body).not.toContain("Nota en borrador oculta");
    expect((await anonimo.get("/s/test/noticias/nota-en-borrador-oculta")).statusCode).toBe(404);
    const nota = await anonimo.get("/s/test/noticias/plan-de-bacheo");
    expect(nota.statusCode).toBe(200);
    expect(nota.body).toContain('<meta property="og:title" content="Plan de bacheo 2027">');
    expect(nota.body).toContain("wa.me/?text=");
  });

  it("escapa HTML del contenido (no se puede inyectar código)", async () => {
    await prensa.post("/api/noticias", { titulo: 'Nota <script>alert("x")</script>', cuerpo: "<img src=x onerror=alert(1)> **ok**", estado: "publicada" });
    const html = (await anonimo.get("/s/test/noticias")).body;
    expect(html).not.toContain("<script>alert");
    const nota = (await anonimo.get("/s/test/noticias/nota-script-alert-x-script")).body;
    expect(nota).not.toContain("<img src=x");
    expect(nota).toContain("<strong>ok</strong>");
  });
});

describe("sitio público", () => {
  it("si no está publicado muestra 'Muy pronto', salvo al equipo con sesión", async () => {
    await comando.put("/api/sitio/config", { publicado: false });
    expect((await anonimo.get("/s/test/")).body).toContain("Estamos preparando el sitio");
    const previa = await prensa.get("/s/test/");
    expect(previa.body).toContain("Vista previa");
    expect(previa.headers["cache-control"]).toContain("no-store");
    await comando.put("/api/sitio/config", { publicado: true, titular: "Una ciudad que escucha" });
    expect((await anonimo.get("/s/test/")).body).toContain("Una ciudad que escucha");
    expect((await anonimo.get("/s/no-existe/")).statusCode).toBe(404);
  });

  it("la agenda pública no expone actividades internas ni notas", async () => {
    const ini = new Date(Date.now() + 86_400_000).toISOString();
    await comando.post("/api/actividades", { titulo: "Caminata pública", tipo: "caminata", inicio: ini, publica: true, descripcionPublica: "Te esperamos", notas: "NOTA-SECRETA" });
    await comando.post("/api/actividades", { titulo: "Reunión interna", tipo: "reunion", inicio: ini, publica: false });
    const html = (await anonimo.get("/s/test/agenda")).body;
    expect(html).toContain("Caminata pública");
    expect(html).toContain("Te esperamos");
    expect(html).not.toContain("Reunión interna");
    expect(html).not.toContain("NOTA-SECRETA");
  });

  it("propuestas visibles agrupadas por tema y ocultas no", async () => {
    await prensa.post("/api/propuestas", { titulo: "Mapa de obras", descripcion: "Cada obra con su fecha", temaId });
    await prensa.post("/api/propuestas", { titulo: "Propuesta oculta", descripcion: "Todavía no se publica", temaId, publicada: false });
    const html = (await anonimo.get("/s/test/propuestas")).body;
    expect(html).toContain("Mapa de obras");
    expect(html).not.toContain("Propuesta oculta");
  });

  it("dominio propio: el host sirve el sitio en la raíz", async () => {
    app.registro.plataforma.prepare("INSERT INTO dominios (host, campania) VALUES (?, ?)").run("anatest.com.ar", "test");
    const r = await anonimo.get("/noticias", { host: "www.anatest.com.ar" });
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain('href="/noticias/plan-de-bacheo"');
  });
});

describe("Sumate", () => {
  it("guarda con consentimiento y responde con redirección", async () => {
    const r = await formulario("/s/test/sumate", { nombre: "Rosa", apellido: "Pérez", telefono: "3571 15 401234", barrioId: barrioA, ayudas: ["fiscal", "redes"], consentimiento: "1" });
    expect(r.statusCode).toBe(303);
    expect(r.headers.location).toBe("/s/test/sumate?ok=1");
    const lista = (await comando.get("/api/adhesiones")).json();
    expect(lista).toHaveLength(1);
    expect(lista[0].ayudas).toEqual(["fiscal", "redes"]);
    expect(lista[0].consentimientoFecha).toBeTruthy();
  });

  it("sin consentimiento no guarda", async () => {
    const r = await formulario("/s/test/sumate", { nombre: "Sin", telefono: "3571 15 409999" });
    expect(r.statusCode).toBe(400);
    expect(r.body).toContain("aceptes el uso de tus datos");
    expect((await comando.get("/api/adhesiones")).json()).toHaveLength(1);
  });

  it("ignora bots (campo trampa) y no duplica por teléfono", async () => {
    await formulario("/s/test/sumate", { nombre: "Bot", telefono: "3571 15 400000", consentimiento: "1", sitio_web: "spam" });
    await formulario("/s/test/sumate", { nombre: "Rosa", telefono: "+54 9 3571 401234", ayudas: "timbreo", consentimiento: "1" });
    const lista = (await comando.get("/api/adhesiones")).json();
    expect(lista).toHaveLength(1);
    expect(lista[0].ayudas.sort()).toEqual(["fiscal", "redes", "timbreo"]);
  });

  it("alcance: referente ve su barrio, comunicación y voluntario no ven datos", async () => {
    await formulario("/s/test/sumate", { nombre: "Juan", telefono: "3571 15 405555", barrioId: barrioB, consentimiento: "1" });
    expect((await referente.get("/api/adhesiones")).json().map((a: any) => a.nombre)).toEqual(["Rosa"]);
    expect((await prensa.get("/api/adhesiones")).statusCode).toBe(403);
    expect((await voluntario.get("/api/adhesiones")).statusCode).toBe(403);
    expect((await prensa.get("/api/sitio/resumen")).json().adhesiones).toBe(0);
  });

  it("marcar contactado, exportar CSV (solo comando) y borrar datos", async () => {
    const a = (await comando.get("/api/adhesiones")).json().find((x: any) => x.nombre === "Rosa");
    expect((await referente.patch(`/api/adhesiones/${(await comando.get("/api/adhesiones")).json().find((x: any) => x.nombre === "Juan").id}`, { contactado: true })).statusCode).toBe(403);
    expect((await referente.patch(`/api/adhesiones/${a.id}`, { contactado: true })).json().contactado).toBe(true);
    expect((await referente.get("/api/adhesiones/exportar.csv")).statusCode).toBe(403);
    const csv = await comando.get("/api/adhesiones/exportar.csv");
    expect(csv.body.split("\r\n")[0]).toContain("Nombre;Apellido;Teléfono");
    expect((await comando.del(`/api/adhesiones/${a.id}`)).statusCode).toBe(200);
    expect((await comando.get("/api/adhesiones")).json().some((x: any) => x.id === a.id)).toBe(false);
  });
});

describe("imágenes", () => {
  it("sube, genera variantes livianas y las sirve con caché", async () => {
    const png = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#0f766e" } }).png().toBuffer();
    const limite = "----aci";
    const cuerpo = Buffer.concat([
      Buffer.from(`--${limite}\r\nContent-Disposition: form-data; name="archivo"; filename="foto.png"\r\nContent-Type: image/png\r\n\r\n`),
      png,
      Buffer.from(`\r\n--${limite}--\r\n`),
    ]);
    const cookie = (await login("prensa@test.ar", "secreto123")) as string;
    const r = await app.inject({ method: "POST", url: "/api/imagenes", payload: cuerpo, headers: { cookie, "content-type": `multipart/form-data; boundary=${limite}` } });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().ancho).toBe(1600);
    const og = await anonimo.get(`/m/test/${r.json().id}-og.jpg`);
    expect(og.statusCode).toBe(200);
    expect(og.headers["cache-control"]).toContain("immutable");
    const meta = await sharp(og.rawPayload).metadata();
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect((await anonimo.get(`/m/test/../plataforma.db`)).statusCode).toBe(404);
  });

  it("rechaza archivos que no son imágenes", async () => {
    const cookie = await login("prensa@test.ar", "secreto123");
    const cuerpo = `--x\r\nContent-Disposition: form-data; name="archivo"; filename="a.txt"\r\nContent-Type: text/plain\r\n\r\nhola\r\n--x--\r\n`;
    const r = await app.inject({ method: "POST", url: "/api/imagenes", payload: cuerpo, headers: { cookie, "content-type": "multipart/form-data; boundary=x" } });
    expect(r.statusCode).toBe(400);
  });
});

describe("utilidades", () => {
  it("teléfonos, slugs, formato y extractos", () => {
    expect(telefonoWhatsApp("3571 15 401234")).toBe("5493571401234");
    expect(slugificar("¡Más luz en Barrio Norte!")).toBe("mas-luz-en-barrio-norte");
    expect(formatoATexto("## T\n- a\n1. b\n> c")).toBe("<h2>T</h2>\n<ul><li>a</li></ul>\n<ol><li>b</li></ol>\n<blockquote>c</blockquote>");
    expect(formatoATexto("[x](javascript:alert(1))")).not.toContain("href");
    expect(extracto("**Hola** mundo ".repeat(30), 40).length).toBeLessThanOrEqual(40);
  });
});
