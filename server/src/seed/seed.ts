/**
 * Datos de ejemplo: "Valle Esmeralda", una ciudad inventada de ~40.000 habitantes.
 * Crea dos campañas:
 *   - demo    → campaña en marcha con datos (para mostrar el producto)
 *   - prueba  → campaña recién creada, sin configurar (para mostrar el asistente)
 *
 * Uso: npm run seed            (no pisa campañas existentes)
 *      npm run seed -- --reset (borra y vuelve a crear demo y prueba)
 */
import { rmSync } from "node:fs";
import { config } from "../config.js";
import { RegistroBases } from "../db/registro.js";
import type { DB } from "../db/conexion.js";
import { crearCampania } from "../servicios/campanias.js";
import { crearBarrio, crearTema, guardarConfig } from "../servicios/configuracion.js";
import { crearUsuario } from "../servicios/usuarios.js";
import type { Apoyo, Geometria, Usuario } from "@territorio/shared";

// PRNG determinístico: mismos datos en cada corrida
let semilla = 20261101;
const rnd = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
};
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const NOMBRES = ["María", "José", "Ana", "Juan", "Lucía", "Carlos", "Sofía", "Miguel", "Valentina", "Jorge", "Camila", "Luis", "Florencia", "Diego", "Paula", "Martín", "Gabriela", "Pablo", "Romina", "Sergio", "Natalia", "Ricardo", "Agustina", "Hugo", "Carolina", "Daniel", "Silvia", "Raúl", "Mónica", "Facundo", "Julieta", "Héctor", "Marta", "Nicolás", "Graciela", "Matías", "Beatriz", "Gustavo", "Noelia", "Ramón"];
const APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Suárez", "Aguirre", "Giménez", "Gutiérrez", "Pereyra", "Molina", "Castro", "Ortiz", "Ferreyra", "Moreno", "Quiroga", "Luna", "Bustos", "Ledesma", "Vera", "Ponce"];
const CALLES = ["San Martín", "Belgrano", "Sarmiento", "Rivadavia", "Mitre", "Moreno", "Alberdi", "Urquiza", "Colón", "Las Heras", "Lavalle", "Güemes", "Italia", "España", "Brasil", "Los Álamos", "Las Rosas", "Libertad", "Independencia", "9 de Julio", "25 de Mayo", "Pellegrini", "Dorrego", "Maipú", "Chacabuco"];

const NOMBRES_BARRIOS = [
  ["Altos del Río", "Barrio Norte", "Los Paraísos", "El Molino"],
  ["Las Acacias", "Centro", "San Martín", "Villa del Parque"],
  ["Los Sauces", "La Estación", "Sarmiento", "Barrio Jardín"],
] as const;

// Perfil político inventado por barrio: probabilidad de [apoya, indeciso, no_apoya]
const PERFIL: Record<string, [number, number, number]> = {
  "Altos del Río": [0.25, 0.35, 0.4],
  "Barrio Norte": [0.3, 0.4, 0.3],
  "Los Paraísos": [0.5, 0.3, 0.2],
  "El Molino": [0.55, 0.3, 0.15],
  "Las Acacias": [0.35, 0.4, 0.25],
  Centro: [0.3, 0.3, 0.4],
  "San Martín": [0.45, 0.35, 0.2],
  "Villa del Parque": [0.4, 0.45, 0.15],
  "Los Sauces": [0.2, 0.4, 0.4],
  "La Estación": [0.5, 0.25, 0.25],
  Sarmiento: [0.35, 0.45, 0.2],
  "Barrio Jardín": [0.3, 0.5, 0.2],
};

const TEMAS = [
  { nombre: "Calles y bacheo", color: "#8d6e63" },
  { nombre: "Seguridad", color: "#c62828" },
  { nombre: "Alumbrado", color: "#f9a825" },
  { nombre: "Limpieza y residuos", color: "#2e7d32" },
  { nombre: "Salud", color: "#0277bd" },
  { nombre: "Empleo", color: "#6a1b9a" },
  { nombre: "Transporte", color: "#00838f" },
  { nombre: "Desagües e inundaciones", color: "#1565c0" },
];

const RECLAMOS_EJEMPLO: Record<string, string[]> = {
  "Calles y bacheo": ["Pozo grande en la esquina, ya se rompieron dos autos", "La calle de tierra se vuelve intransitable cuando llueve", "Falta cordón cuneta en toda la cuadra"],
  Seguridad: ["Robos reiterados en la parada del colectivo", "Pedimos más patrullaje a la noche", "Plaza sin iluminación, se junta gente a la noche"],
  Alumbrado: ["Tres luminarias apagadas hace un mes", "Pedido de luces LED en la plaza", "El poste de la esquina está inclinado"],
  "Limpieza y residuos": ["Microbasural en el terreno baldío", "El camión no pasa los jueves", "Faltan contenedores de reciclaje"],
  Salud: ["El dispensario no tiene pediatra los martes", "Pedido de operativo de vacunación en el barrio", "Falta ambulancia de guardia en la zona"],
  Empleo: ["Propuesta: capacitación en oficios para jóvenes", "Feria de emprendedores mensual en la plaza", "Bolsa de trabajo municipal online"],
  Transporte: ["El colectivo pasa cada 50 minutos", "Propuesta: ciclovía hasta el centro", "Falta refugio en la parada de la escuela"],
  "Desagües e inundaciones": ["Se inunda la esquina con cada tormenta", "Limpieza del canal que está tapado", "Las bocas de tormenta están obstruidas"],
};

// ---------- Geometría: grilla de 4x3 con vértices compartidos y desplazados ----------
// Coordenadas inventadas (sin mapa de fondo: la ciudad no existe)
const LNG0 = -64.1,
  LAT0 = -32.17,
  DX = 0.012,
  DY = 0.01;
function vertices() {
  const v: [number, number][][] = [];
  for (let f = 0; f <= 3; f++) {
    v[f] = [];
    for (let c = 0; c <= 4; c++) {
      const borde = f === 0 || f === 3 || c === 0 || c === 4;
      const j = borde ? 0.25 : 0.35;
      v[f]![c] = [LNG0 + c * DX + (rnd() - 0.5) * DX * j, LAT0 - f * DY + (rnd() - 0.5) * DY * j];
    }
  }
  return v;
}
function celda(v: [number, number][][], f: number, c: number): Geometria {
  const a = v[f]![c]!,
    b = v[f]![c + 1]!,
    cc = v[f + 1]![c + 1]!,
    d = v[f + 1]![c]!;
  return { type: "Polygon", coordinates: [[a, b, cc, d, a]] };
}
/** Punto aleatorio dentro de un cuadrilátero (interpolación bilineal). */
function puntoEn(g: Geometria): { lat: number; lng: number } {
  const [a, b, c, d] = g.coordinates[0]!;
  const u = 0.1 + rnd() * 0.8,
    w = 0.1 + rnd() * 0.8;
  const lng = (1 - w) * ((1 - u) * a![0] + u * b![0]) + w * ((1 - u) * d![0] + u * c![0]);
  const lat = (1 - w) * ((1 - u) * a![1] + u * b![1]) + w * ((1 - u) * d![1] + u * c![1]);
  return { lat, lng };
}

function iso(diasAtras: number, hora = entre(10, 20)) {
  const d = new Date(Date.now() - diasAtras * 86_400_000);
  d.setHours(hora, entre(0, 59), 0, 0);
  return d.toISOString();
}

function poblarDemo(db: DB) {
  guardarConfig(db, {
    lema: "Valle Esmeralda, barrio por barrio",
    fechaEleccion: new Date(Date.now() + 75 * 86_400_000).toISOString().slice(0, 10),
    mapaConTiles: false,
    mapaZoom: 14,
    mapaCentro: [LAT0 - 1.5 * DY, LNG0 + 2 * DX],
    configuracionCompleta: true,
  });

  const v = vertices();
  const barrios: { id: string; nombre: string; geo: Geometria }[] = [];
  for (let f = 0; f < 3; f++)
    for (let c = 0; c < 4; c++) {
      const geo = celda(v, f, c);
      const nombre = NOMBRES_BARRIOS[f]![c]!;
      const b = crearBarrio(db, { nombre, geometria: geo, objetivoContactos: entre(8, 14) * 10 });
      barrios.push({ id: b.id, nombre, geo });
    }
  const temas = TEMAS.map((t) => crearTema(db, t));

  const pass = "demo1234";
  const comando = db.prepare("SELECT id FROM usuarios WHERE rol = 'comando'").get() as { id: string };
  crearUsuario(db, { nombre: "Equipo de Datos", email: "datos@valle-esmeralda.demo", telefono: null, rol: "comando", barrioIds: [], password: pass, activo: true });
  const ref = (nombre: string, email: string, idx: number[]) =>
    crearUsuario(db, { nombre, email, telefono: "3571 15 40" + entre(1000, 9999), rol: "referente", barrioIds: idx.map((i) => barrios[i]!.id), password: pass, activo: true });
  const referentes = [
    ref("Marcela Quiroga", "referente@valle-esmeralda.demo", [0, 1, 4, 5]),
    ref("Ezequiel Bustos", "ezequiel@valle-esmeralda.demo", [2, 3, 6, 7]),
    ref("Analía Vera", "analia@valle-esmeralda.demo", [8, 9, 10, 11]),
  ];
  const voluntarios: Usuario[] = [];
  const nombresVol = ["Tomás Ledesma", "Brenda Ortiz", "Lautaro Molina", "Micaela Castro", "Franco Aguirre", "Rocío Luna", "Joaquín Ponce", "Milagros Herrera", "Bruno Acosta"];
  nombresVol.forEach((n, i) => {
    const email = i === 0 ? "voluntario@valle-esmeralda.demo" : n.toLowerCase().split(" ")[0]!.normalize("NFD").replace(/[̀-ͯ]/g, "") + "@valle-esmeralda.demo";
    const bs = [barrios[(i * 4) % 12]!.id, barrios[(i * 4 + 1) % 12]!.id];
    voluntarios.push(crearUsuario(db, { nombre: n, email, telefono: null, rol: "voluntario", barrioIds: bs, password: pass, activo: true }));
  });
  const equipo = [...referentes, ...voluntarios];

  // ----- Vecinos e interacciones -----
  const insV = db.prepare(
    `INSERT INTO vecinos (id, nombre, apellido, telefono, direccion, barrio_id, apoyo, etiquetas, notas, consentimiento, consentimiento_fecha, lat, lng, creado_por, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insI = db.prepare(
    `INSERT INTO interacciones (id, vecino_id, barrio_id, usuario_id, canal, resultado, apoyo, tema_id, direccion, nota, fecha, lat, lng)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ETIQUETAS = ["fiscal", "comerciante", "docente", "jubilado/a", "joven", "club", "centro vecinal", "quiere colaborar", "cartel en casa"];
  const NOTAS = ["Preocupado por las calles", "Pide más luz en la cuadra", "Le interesa colaborar el día de la elección", "Vota por primera vez", "Tiene un comercio en la esquina", null, null, null];

  db.transaction(() => {
    for (const b of barrios) {
      const perfil = PERFIL[b.nombre]!;
      const cant = entre(55, 95);
      const enBarrio = equipo.filter((u) => u.rol === "referente" ? u.barrioIds.includes(b.id) : u.barrioIds.includes(b.id));
      const autores = enBarrio.length ? enBarrio : referentes;
      for (let i = 0; i < cant; i++) {
        const r = rnd();
        const apoyo: Apoyo = rnd() < 0.15 ? "sin_dato" : r < perfil[0] ? "apoya" : r < perfil[0] + perfil[1] ? "indeciso" : "no_apoya";
        const { lat, lng } = puntoEn(b.geo);
        const id = crypto.randomUUID();
        const alta = entre(3, 56);
        const consent = rnd() < 0.62;
        const etiquetas = rnd() < 0.35 ? [elegir(ETIQUETAS)] : [];
        if (apoyo === "apoya" && rnd() < 0.25) etiquetas.push("quiere colaborar");
        const tel = rnd() < 0.8 ? `3571 15 ${entre(40, 69)}${entre(1000, 9999)}` : null;
        const autor = elegir(autores);
        insV.run(id, elegir(NOMBRES), elegir(APELLIDOS), tel, `${elegir(CALLES)} ${entre(1, 25) * 100 + entre(0, 99)}`, b.id, apoyo, JSON.stringify([...new Set(etiquetas)]), elegir(NOTAS), consent ? 1 : 0, consent ? iso(alta) : null, lat, lng, autor.id, iso(alta), iso(Math.max(0, alta - entre(0, 3))));
        // 1 a 3 contactos por vecino
        const n = entre(1, 3);
        for (let k = 0; k < n; k++) {
          const dias = Math.max(0, alta - k * entre(3, 12));
          const canal = rnd() < 0.78 ? "puerta" : rnd() < 0.6 ? "whatsapp" : "telefono";
          insI.run(crypto.randomUUID(), id, b.id, autor.id, canal, "atendio", apoyo, rnd() < 0.5 ? elegir(temas).id : null, null, null, iso(dias), lat, lng);
        }
      }
      // Timbres sin respuesta (no generan vecino)
      for (let i = 0; i < entre(20, 45); i++) {
        const { lat, lng } = puntoEn(b.geo);
        insI.run(crypto.randomUUID(), null, b.id, elegir(autores).id, "puerta", rnd() < 0.85 ? "no_estaba" : "no_quiso", null, null, `${elegir(CALLES)} ${entre(1, 25) * 100 + entre(0, 99)}`, null, iso(entre(0, 55)), lat, lng);
      }
    }

    // ----- Reclamos -----
    const insR = db.prepare(
      `INSERT INTO reclamos (id, tipo, tema_id, barrio_id, descripcion, direccion, lat, lng, estado, creado_por, creado_en, actualizado_en) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let i = 0; i < 140; i++) {
      const b = elegir(barrios);
      // Algunos barrios tienen problemas dominantes, para que el mapa "cuente algo"
      const tema = b.nombre === "Los Sauces" || b.nombre === "Altos del Río" ? (rnd() < 0.55 ? temas[7]! : elegir(temas)) : b.nombre === "Centro" ? (rnd() < 0.5 ? temas[1]! : elegir(temas)) : elegir(temas);
      const desc = elegir(RECLAMOS_EJEMPLO[tema.nombre]!);
      const tipo = desc.startsWith("Propuesta") || tema.nombre === "Empleo" ? "propuesta" : "reclamo";
      const { lat, lng } = puntoEn(b.geo);
      const d = iso(entre(0, 50));
      insR.run(crypto.randomUUID(), tipo, tema.id, b.id, desc, `${elegir(CALLES)} ${entre(1, 25) * 100}`, lat, lng, rnd() < 0.55 ? "nuevo" : rnd() < 0.6 ? "en_curso" : "resuelto", elegir(equipo).id, d, d);
    }

    // ----- Agenda: dos semanas atrás y tres adelante -----
    const insA = db.prepare(
      `INSERT INTO actividades (id, titulo, tipo, inicio, fin, lugar, barrio_id, responsable_id, con_candidato, notas, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const plan: Array<[string, string, number, number, boolean]> = [
      ["Timbreo", "timbreo", -12, 10, false],
      ["Caminata con la candidata", "caminata", -9, 17, true],
      ["Reunión con centro vecinal", "reunion", -6, 19, true],
      ["Timbreo", "timbreo", -4, 10, false],
      ["Entrevista radio FM Valle", "medios", -2, 9, true],
      ["Timbreo", "timbreo", 0, 10, false],
      ["Reunión de referentes", "reunion", 0, 20, false],
      ["Caminata con la candidata", "caminata", 1, 17, true],
      ["Timbreo", "timbreo", 2, 10, false],
      ["Encuentro con comerciantes", "reunion", 3, 19, true],
      ["Timbreo", "timbreo", 5, 10, false],
      ["Acto en la plaza", "acto", 6, 18, true],
      ["Capacitación de fiscales", "reunion", 8, 19, false],
      ["Caminata con la candidata", "caminata", 9, 17, true],
      ["Timbreo", "timbreo", 12, 10, false],
      ["Entrevista canal local", "medios", 13, 9, true],
      ["Timbreo", "timbreo", 16, 10, false],
      ["Caminata con la candidata", "caminata", 19, 17, true],
    ];
    for (const [titulo, tipo, dia, hora, conCand] of plan) {
      const b = elegir(barrios);
      const ini = new Date(Date.now() + dia * 86_400_000);
      ini.setHours(hora, 0, 0, 0);
      const fin = new Date(ini.getTime() + (tipo === "medios" ? 1 : 2) * 3600_000);
      const resp = elegir(referentes.filter((r) => r.barrioIds.includes(b.id)));
      insA.run(crypto.randomUUID(), `${titulo} en ${b.nombre}`, tipo, ini.toISOString(), fin.toISOString(), tipo === "medios" ? "Estudio" : tipo === "acto" ? `Plaza de ${b.nombre}` : `${elegir(CALLES)} y ${elegir(CALLES)}`, tipo === "medios" ? null : b.id, resp?.id ?? null, conCand ? 1 : 0, null, comando.id);
    }
  })();
}

function main() {
  const reset = process.argv.includes("--reset");
  const registro = new RegistroBases(config.dataDir);
  for (const slug of ["demo", "prueba"]) {
    if (registro.existe(slug)) {
      if (!reset) {
        console.log(`La campaña "${slug}" ya existe (usá --reset para recrearla)`);
        continue;
      }
      registro.plataforma.prepare("DELETE FROM campanias WHERE slug = ?").run(slug);
      rmSync(registro.rutaCampania(slug), { force: true });
      rmSync(registro.rutaCampania(slug) + "-wal", { force: true });
      rmSync(registro.rutaCampania(slug) + "-shm", { force: true });
    }
    if (slug === "demo") {
      crearCampania(registro, {
        slug,
        config: { nombre: "Frente Vecinal Valle Esmeralda", candidato: "Laura Medina", ciudad: "Valle Esmeralda", colorPrimario: "#0f766e", colorSecundario: "#f59e0b" },
        admin: { nombre: "Coordinación General", email: "comando@valle-esmeralda.demo", password: "demo1234" },
      });
      poblarDemo(registro.campania(slug));
    } else {
      crearCampania(registro, {
        slug,
        config: { nombre: "Campaña nueva", candidato: "Candidato/a", ciudad: "Mi ciudad", colorPrimario: "#1d4ed8", colorSecundario: "#f97316" },
        admin: { nombre: "Administrador", email: "admin@prueba.demo", password: "prueba1234" },
      });
    }
    console.log(`Campaña "${slug}" creada`);
  }
  registro.cerrar();
  console.log(`
Accesos de ejemplo (código de campaña / email / contraseña):
  demo   / comando@valle-esmeralda.demo     / demo1234   (Comando: ve todo)
  demo   / referente@valle-esmeralda.demo   / demo1234   (Referente: 4 barrios)
  demo   / voluntario@valle-esmeralda.demo  / demo1234   (Voluntario: 2 barrios)
  prueba / admin@prueba.demo                / prueba1234 (Campaña sin configurar: asistente)
`);
}

main();
