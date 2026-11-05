/**
 * Datos de ejemplo: "Valle Esmeralda", una ciudad inventada de ~40.000 habitantes.
 *   - demo    → campaña con sitio publicado, noticias, propuestas, agenda y personas sumadas
 *   - prueba  → campaña recién creada, sin configurar (muestra el asistente)
 *
 * Uso: npm run seed            (no pisa campañas existentes)
 *      npm run seed -- --reset (borra y vuelve a crear demo y prueba)
 */
import { rmSync } from "node:fs";
import sharp from "sharp";
import type { Ayuda } from "@aci/shared";
import { config } from "../config.js";
import { RegistroBases } from "../db/registro.js";
import type { DB } from "../db/conexion.js";
import { crearCampania } from "../servicios/campanias.js";
import { crearBarrio, crearTema, guardarConfig, guardarSitio } from "../servicios/configuracion.js";
import { crearUsuario } from "../servicios/usuarios.js";
import { guardarImagen } from "../servicios/imagenes.js";
import { crearNoticia, crearPropuesta } from "../servicios/noticias.js";
import { crearActividad } from "../servicios/actividades.js";
import { ilustracion, retrato, portada } from "./ilustraciones.js";

let semilla = 20261105;
const rnd = () => {
  semilla = (semilla * 1664525 + 1013904223) % 4294967296;
  return semilla / 4294967296;
};
const elegir = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)]!;
const entre = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

const NOMBRES = ["María", "José", "Ana", "Juan", "Lucía", "Carlos", "Sofía", "Miguel", "Valentina", "Jorge", "Camila", "Luis", "Florencia", "Diego", "Paula", "Martín", "Gabriela", "Pablo", "Romina", "Sergio", "Natalia", "Agustina", "Facundo", "Julieta", "Matías"];
const APELLIDOS = ["González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Flores", "Benítez", "Acosta", "Medina", "Herrera", "Suárez", "Aguirre", "Ferreyra", "Quiroga", "Luna"];

const BARRIOS = [
  ["Altos del Río", "Barrio Norte", "Los Paraísos", "El Molino"],
  ["Las Acacias", "Centro", "San Martín", "Villa del Parque"],
  ["Los Sauces", "La Estación", "Sarmiento", "Barrio Jardín"],
];

const TEMAS = [
  { nombre: "Calles y bacheo", color: "#8d6e63" },
  { nombre: "Seguridad", color: "#c62828" },
  { nombre: "Alumbrado", color: "#f9a825" },
  { nombre: "Ambiente y limpieza", color: "#2e7d32" },
  { nombre: "Salud", color: "#0277bd" },
  { nombre: "Empleo", color: "#6a1b9a" },
  { nombre: "Transporte", color: "#00838f" },
  { nombre: "Desagües e inundaciones", color: "#1565c0" },
];

// Polígonos inventados (grilla 4x3 con vértices desplazados), listos para el módulo de Territorio
const LNG0 = -64.1,
  LAT0 = -32.17,
  DX = 0.012,
  DY = 0.01;
function vertices() {
  const v: [number, number][][] = [];
  for (let f = 0; f <= 3; f++) {
    v[f] = [];
    for (let c = 0; c <= 4; c++) {
      const j = f === 0 || f === 3 || c === 0 || c === 4 ? 0.25 : 0.35;
      v[f]![c] = [LNG0 + c * DX + (rnd() - 0.5) * DX * j, LAT0 - f * DY + (rnd() - 0.5) * DY * j];
    }
  }
  return v;
}

const haceDias = (d: number, h = 10) => {
  const x = new Date(Date.now() - d * 86_400_000);
  x.setHours(h, 0, 0, 0);
  return x.toISOString();
};

async function imagen(db: DB, carpeta: string, svg: string, alt: string, autor: string) {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return (await guardarImagen(db, carpeta, png, "image/png", autor, alt)).id;
}

async function poblarDemo(registro: RegistroBases, slug: string) {
  const db = registro.campania(slug);
  const media = registro.rutaMedia(slug);
  guardarConfig(db, {
    cargo: "Intendenta",
    lema: "Valle Esmeralda, barrio por barrio",
    fechaEleccion: new Date(Date.now() + 75 * 86_400_000).toISOString().slice(0, 10),
    configuracionCompleta: true,
  });

  const v = vertices();
  const barrios: { id: string; nombre: string }[] = [];
  for (let f = 0; f < 3; f++)
    for (let c = 0; c < 4; c++) {
      const a = v[f]![c]!,
        b = v[f]![c + 1]!,
        cc = v[f + 1]![c + 1]!,
        d = v[f + 1]![c]!;
      const br = crearBarrio(db, { nombre: BARRIOS[f]![c]!, geometria: { type: "Polygon", coordinates: [[a, b, cc, d, a]] }, objetivoContactos: entre(8, 14) * 10 });
      barrios.push({ id: br.id, nombre: br.nombre });
    }
  const temas = TEMAS.map((t) => crearTema(db, t));
  const T = (n: string) => temas.find((t) => t.nombre === n)!.id;
  const B = (n: string) => barrios.find((b) => b.nombre === n)!.id;

  const pass = "demo1234";
  const comando = (db.prepare("SELECT id FROM usuarios WHERE rol = 'comando'").get() as { id: string }).id;
  const prensa = crearUsuario(db, { nombre: "Sofía Ledesma", email: "prensa@valle-esmeralda.demo", telefono: null, rol: "comunicacion", barrioIds: [], password: pass, activo: true });
  const ref = crearUsuario(db, { nombre: "Marcela Quiroga", email: "referente@valle-esmeralda.demo", telefono: null, rol: "referente", barrioIds: [B("Altos del Río"), B("Barrio Norte"), B("Las Acacias"), B("Centro")], password: pass, activo: true });
  crearUsuario(db, { nombre: "Ezequiel Bustos", email: "ezequiel@valle-esmeralda.demo", telefono: null, rol: "referente", barrioIds: [B("Los Paraísos"), B("El Molino"), B("San Martín"), B("Villa del Parque")], password: pass, activo: true });
  crearUsuario(db, { nombre: "Tomás Ledesma", email: "voluntario@valle-esmeralda.demo", telefono: null, rol: "voluntario", barrioIds: [B("Altos del Río"), B("Barrio Norte")], password: pass, activo: true });

  // ----- Imágenes ilustradas (inventadas, sin personas reales) -----
  const fotoId = await imagen(db, media, retrato("#0f766e", "#f59e0b"), "Retrato ilustrado de la candidata", comando);
  const portadaId = await imagen(db, media, portada("#0f766e", "#f59e0b"), "Ilustración de la ciudad", comando);

  guardarSitio(db, {
    publicado: true,
    titular: "Una ciudad que escucha a cada barrio",
    bajada: "Soy Laura Medina. Vivo en Valle Esmeralda hace 40 años y quiero que la Municipalidad llegue a cada cuadra: calles, luz, salud y trabajo, con los vecinos adentro.",
    fotoId,
    portadaId,
    textoSumate: "Recorremos los barrios todas las semanas. Dejanos tus datos y te contamos cómo sumarte: con una hora por semana ya ayudás.",
    email: "contacto@valle-esmeralda.demo",
    responsableDatos: "Frente Vecinal Valle Esmeralda",
    biografia: `Nací en **Valle Esmeralda** en 1978 y crecí en el barrio La Estación, donde mi papá tenía el almacén de la esquina.

## Trayectoria
- Maestra de grado durante 15 años en la Escuela Sarmiento.
- Presidenta del centro vecinal de La Estación (2012–2018).
- Concejala desde 2021: impulsé la ordenanza de presupuesto participativo por barrio.

## Por qué me presento
Porque conozco la ciudad cuadra por cuadra y sé que los problemas se resuelven escuchando a quienes los viven todos los días.

> "La Municipalidad tiene que estar donde están los vecinos, no al revés."

Estoy casada, tengo dos hijos y los domingos me vas a encontrar en la feria de la plaza.`,
  });

  // ----- Noticias -----
  const notas: Array<{ t: string; b: string; c: string; tema: string; barrio?: string; dias: number; dest?: boolean; estado?: "borrador" | "publicada"; motivo: Parameters<typeof ilustracion>[0] }> = [
    {
      t: "Presentamos el plan de bacheo barrio por barrio",
      b: "Un mapa abierto con cada calle a reparar y un calendario público de obras para los primeros 18 meses.",
      tema: "Calles y bacheo",
      dias: 1,
      dest: true,
      motivo: "calles",
      c: `Después de recorrer los 12 barrios, presentamos el **Plan de Calles 2027-2029**: un relevamiento de 340 cuadras con pozos, cordón cuneta faltante o calles de tierra.

## Qué proponemos
- Publicar en la web de la Municipalidad un mapa con cada obra y su fecha estimada.
- Priorizar las calles que llevan a escuelas, dispensarios y paradas de colectivo.
- Un equipo de respuesta rápida para pozos peligrosos: menos de 72 horas.

## Cómo se financia
Con una reasignación del 4% del presupuesto de obras y el fondo provincial de infraestructura vial.

> "No se trata de prometer asfalto en todos lados, sino de decir qué se hace, cuándo y con qué plata."

Si querés sumar una calle de tu barrio al relevamiento, dejanos tus datos en la sección Sumate o acercate a la próxima caminata.`,
    },
    {
      t: "Caminata por Los Sauces: el agua sigue siendo el reclamo número uno",
      b: "Recorrimos 22 cuadras con vecinos que cada tormenta ven sus calles convertidas en ríos.",
      tema: "Desagües e inundaciones",
      barrio: "Los Sauces",
      dias: 3,
      motivo: "agua",
      c: `El sábado caminamos Los Sauces junto a la comisión vecinal. En casi todas las casas nos contaron lo mismo: **el canal de calle Moreno está tapado** y con cada lluvia fuerte el agua entra a las viviendas.

## Lo que vimos
- Bocas de tormenta obstruidas en 9 esquinas.
- Un tramo del canal sin limpieza desde hace dos años.

Nos comprometimos a presentar un pedido de informes en el Concejo esta misma semana y a incluir Los Sauces en la primera etapa del plan hídrico.`,
    },
    {
      t: "Luces LED en todas las plazas en el primer año",
      b: "Plazas iluminadas son plazas que se usan. Proponemos recambio total con un sistema de reporte de luminarias apagadas.",
      tema: "Alumbrado",
      dias: 6,
      motivo: "luz",
      c: `Hoy Valle Esmeralda tiene 31 plazas y solo 8 tienen iluminación LED completa.

Proponemos completar el **recambio en 12 meses** y habilitar un número de WhatsApp municipal para reportar luminarias apagadas, con respuesta en 5 días hábiles.

El ahorro de energía estimado (cerca del 45%) se vuelca al mantenimiento de las propias plazas.`,
    },
    {
      t: "Reunión con comerciantes del Centro",
      b: "Más de 40 comerciantes nos plantearon sus prioridades: seguridad, estacionamiento y menos trámites.",
      tema: "Empleo",
      barrio: "Centro",
      dias: 9,
      motivo: "comercio",
      c: `En el salón de la Cámara de Comercio escuchamos a más de 40 comerciantes.

## Tres compromisos
1. **Ventanilla única** para habilitaciones: un solo trámite, en línea, con plazo máximo de 15 días.
2. Corredor seguro con cámaras y presencia policial en el horario de cierre.
3. Una mesa mensual entre la Municipalidad y el comercio local.

Seguimos recorriendo: el próximo encuentro es con emprendedores de la feria.`,
    },
    {
      t: "Un dispensario abierto hasta las 22 en cada zona",
      b: "Propuesta para que nadie tenga que ir a la guardia del hospital por una consulta simple.",
      tema: "Salud",
      dias: 13,
      motivo: "salud",
      c: `La guardia del hospital está saturada porque los dispensarios cierran a las 14. Proponemos **dividir la ciudad en cuatro zonas** y que en cada una haya un dispensario con atención hasta las 22 h, con pediatría y enfermería.

El costo se cubre reorganizando turnos y sumando 12 profesionales con el programa provincial de atención primaria.`,
    },
    {
      t: "Jóvenes de Villa del Parque: deporte y primer empleo",
      b: "Charla abierta en el club con chicos y chicas de 16 a 24 años.",
      tema: "Empleo",
      barrio: "Villa del Parque",
      dias: 18,
      motivo: "jovenes",
      c: `Más de 60 jóvenes participaron de la charla en el Club Villa del Parque. Nos pidieron **cursos de oficios con salida laboral** y que el polideportivo abra también los fines de semana.

Tomamos las dos propuestas para el programa de gobierno.`,
    },
    {
      t: "Colectivo cada 20 minutos: la propuesta de transporte",
      b: "Rediseño de las líneas urbanas con horarios publicados en tiempo real.",
      tema: "Transporte",
      dias: 24,
      motivo: "transporte",
      c: `Hoy hay barrios donde el colectivo pasa cada 50 minutos. Proponemos rediseñar el recorrido para que **ninguna parada tenga más de 20 minutos de espera** en horario pico, y publicar la ubicación de cada unidad en tiempo real.`,
    },
    {
      t: "Separación en origen: el reciclaje empieza en casa",
      b: "Puntos verdes en cada barrio y recolección diferenciada dos veces por semana.",
      tema: "Ambiente y limpieza",
      dias: 31,
      motivo: "ambiente",
      c: `Proponemos instalar **un punto verde por barrio** y sumar recolección diferenciada los martes y viernes, en alianza con la cooperativa de recuperadores urbanos.`,
    },
    {
      t: "Borrador: propuesta de seguridad con cámaras por barrio",
      b: "En preparación con el equipo técnico.",
      tema: "Seguridad",
      dias: 0,
      estado: "borrador",
      motivo: "seguridad",
      c: `Texto en preparación.`,
    },
  ];
  for (const n of notas) {
    const imagenId = await imagen(db, media, ilustracion(n.motivo, TEMAS.find((t) => t.nombre === n.tema)!.color), n.t, prensa.id);
    crearNoticia(db, prensa.id, {
      titulo: n.t,
      bajada: n.b,
      cuerpo: n.c,
      imagenId,
      temaId: T(n.tema),
      barrioId: n.barrio ? B(n.barrio) : null,
      estado: n.estado ?? "publicada",
      destacada: Boolean(n.dest),
      fecha: n.estado === "borrador" ? null : haceDias(n.dias, 9 + (n.dias % 8)),
    });
  }

  // ----- Propuestas -----
  const props: Array<[string, string, string]> = [
    ["Calles y bacheo", "Mapa público de obras", "Cada obra con su fecha estimada y su estado, publicada en la web municipal y actualizada todos los meses."],
    ["Calles y bacheo", "Respuesta rápida para pozos peligrosos", "Un equipo propio para reparar en menos de 72 horas los pozos que ponen en riesgo a vecinos y vehículos."],
    ["Seguridad", "Corredores seguros escolares", "Iluminación, cámaras y presencia en los horarios de entrada y salida de cada escuela."],
    ["Seguridad", "Centro de monitoreo abierto a los barrios", "Reuniones mensuales con cada centro vecinal para definir dónde ubicar nuevas cámaras."],
    ["Alumbrado", "Todas las plazas con LED en 12 meses", "Recambio completo y reporte de luminarias apagadas por WhatsApp con respuesta en 5 días hábiles."],
    ["Ambiente y limpieza", "Un punto verde por barrio", "Separación en origen con la cooperativa de recuperadores urbanos y recolección diferenciada dos veces por semana."],
    ["Ambiente y limpieza", "Fin de los microbasurales", "Relevamiento, limpieza y control de los 23 microbasurales detectados, con contenedores en los puntos críticos."],
    ["Salud", "Dispensarios hasta las 22 h", "Un dispensario por zona con atención vespertina, pediatría y enfermería."],
    ["Salud", "Turnos por WhatsApp", "Pedir turno en el dispensario sin hacer fila desde la madrugada."],
    ["Empleo", "Ventanilla única para comercios", "Habilitaciones en un solo trámite en línea, con plazo máximo de 15 días."],
    ["Empleo", "Escuela de oficios municipal", "Cursos de electricidad, gas, carpintería y programación con prácticas en empresas locales."],
    ["Transporte", "Colectivo cada 20 minutos", "Rediseño de recorridos y ubicación de las unidades en tiempo real."],
    ["Transporte", "Ciclovía Centro – La Estación", "Primera etapa de una red de ciclovías que conecte los barrios con el centro."],
    ["Desagües e inundaciones", "Plan hídrico en dos etapas", "Limpieza de canales y bocas de tormenta antes de cada temporada de lluvias, empezando por Los Sauces y Altos del Río."],
  ];
  props.forEach(([tema, t, d], i) => crearPropuesta(db, comando, { titulo: t, descripcion: d, temaId: T(tema), orden: i, publicada: true }));

  // ----- Agenda: actividades públicas e internas -----
  const usuarioComando = { id: comando, rol: "comando" as const, barrioIds: [], nombre: "", email: "", telefono: null, activo: true };
  const plan: Array<[string, "caminata" | "reunion" | "acto" | "medios" | "timbreo", number, number, string | null, string, boolean, string | null]> = [
    ["Caminata por Barrio Norte", "caminata", -6, 17, "Barrio Norte", "Plaza Belgrano", true, null],
    ["Caminata por Los Sauces", "caminata", 1, 17, "Los Sauces", "Moreno y 25 de Mayo", true, "Recorremos el barrio con la comisión vecinal. Traé tu reclamo."],
    ["Encuentro con jubilados", "reunion", 3, 16, "San Martín", "Centro de jubilados San Martín", true, "Charla abierta sobre salud y transporte."],
    ["Entrevista en Radio Valle", "medios", 4, 9, null, "FM 98.3", true, "Escuchala en vivo."],
    ["Reunión de equipo de comunicación", "reunion", 4, 20, null, "Sede", false, null],
    ["Feria de la plaza", "acto", 6, 11, "Centro", "Plaza San Martín", true, "Te esperamos en nuestra mesa con mate y propuestas."],
    ["Caminata por El Molino", "caminata", 8, 17, "El Molino", "Escuela El Molino", true, null],
    ["Charla con emprendedores", "reunion", 10, 19, "La Estación", "Club La Estación", true, "Ventanilla única y escuela de oficios: queremos tu opinión."],
    ["Capacitación de fiscales", "reunion", 12, 19, null, "Sede", false, null],
    ["Caminata por Altos del Río", "caminata", 15, 17, "Altos del Río", "Plaza Altos del Río", true, null],
    ["Acto de cierre de mes", "acto", 20, 19, "Centro", "Anfiteatro municipal", true, "Música, propuestas y la presentación del plan de gobierno."],
  ];
  for (const [titulo, tipo, d, h, barrio, lugar, publica, desc] of plan) {
    const ini = new Date(Date.now() + d * 86_400_000);
    ini.setHours(h, 0, 0, 0);
    crearActividad(db, usuarioComando, {
      titulo,
      tipo,
      inicio: ini.toISOString(),
      fin: new Date(ini.getTime() + 2 * 3600_000).toISOString(),
      lugar,
      barrioId: barrio ? B(barrio) : null,
      responsableId: ref.id,
      conCandidato: publica,
      publica,
      descripcionPublica: desc,
      notas: null,
    });
  }

  // ----- Personas que se sumaron desde el sitio -----
  const ins = db.prepare(
    `INSERT INTO vecinos (id, nombre, apellido, telefono, email, barrio_id, ayudas, mensaje, origen, etiquetas, contactado, consentimiento, consentimiento_fecha, creado_en, actualizado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sumate', '["sumate"]', ?, 1, ?, ?, ?)`,
  );
  const MENSAJES = [null, null, null, "Puedo los sábados a la mañana", "Tengo auto para llevar gente el día de la elección", "Soy docente, me interesa educación", "Quiero que arreglen mi calle", null];
  const AY: Ayuda[] = ["timbreo", "fiscal", "redes", "eventos", "aporte", "otro"];
  db.transaction(() => {
    for (let i = 0; i < 74; i++) {
      const dias = Math.floor(rnd() ** 1.6 * 55);
      const f = haceDias(dias, entre(8, 22));
      const ayudas = [...new Set(Array.from({ length: entre(1, 3) }, () => (rnd() < 0.35 ? "fiscal" : elegir(AY))))];
      const nom = elegir(NOMBRES);
      ins.run(
        crypto.randomUUID(),
        nom,
        elegir(APELLIDOS),
        `3571 15 ${entre(40, 69)}${entre(1000, 9999)}`,
        rnd() < 0.5 ? `${nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${entre(10, 99)}@correo.demo` : null,
        rnd() < 0.9 ? elegir(barrios).id : null,
        JSON.stringify(ayudas),
        elegir(MENSAJES),
        dias > 6 && rnd() < 0.7 ? 1 : 0,
        f,
        f,
        f,
      );
    }
  })();
}

async function main() {
  const reset = process.argv.includes("--reset");
  const registro = new RegistroBases(config.dataDir);
  for (const slug of ["demo", "prueba"]) {
    if (registro.existe(slug)) {
      if (!reset) {
        console.log(`La campaña "${slug}" ya existe (usá --reset para recrearla)`);
        continue;
      }
      registro.plataforma.prepare("DELETE FROM campanias WHERE slug = ?").run(slug);
      for (const suf of ["", "-wal", "-shm"]) rmSync(registro.rutaCampania(slug) + suf, { force: true });
      rmSync(registro.rutaMedia(slug), { recursive: true, force: true });
    }
    if (slug === "demo") {
      crearCampania(registro, {
        slug,
        config: { nombre: "Frente Vecinal Valle Esmeralda", candidato: "Laura Medina", ciudad: "Valle Esmeralda", colorPrimario: "#0f766e", colorSecundario: "#f59e0b" },
        admin: { nombre: "Coordinación General", email: "comando@valle-esmeralda.demo", password: "demo1234" },
      });
      await poblarDemo(registro, slug);
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
Sitio público de ejemplo: http://localhost:3000/s/demo/
Accesos al panel (código de campaña / email / contraseña):
  demo   / comando@valle-esmeralda.demo    / demo1234   (Comando)
  demo   / prensa@valle-esmeralda.demo     / demo1234   (Comunicación: solo el sitio)
  demo   / referente@valle-esmeralda.demo  / demo1234   (Referente: 4 barrios)
  prueba / admin@prueba.demo               / prueba1234 (Campaña sin configurar: asistente)
`);
}

await main();
