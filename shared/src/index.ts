/**
 * Contrato compartido entre servidor y web (ACI).
 * Todo lo que viaja por la API se valida con estos esquemas (zod).
 *
 * Módulo 1: Núcleo (campaña, equipo, barrios, temas) + Sitio del candidato
 * (noticias, propuestas, agenda pública, Sumate).
 */
import { z } from "zod";

export const PRODUCTO = "ACI";

// ======================================================================
// Núcleo
// ======================================================================

export const ROLES = ["comando", "comunicacion", "referente", "voluntario"] as const;
export type Rol = (typeof ROLES)[number];
export const ROL_LABEL: Record<Rol, string> = {
  comando: "Comando",
  comunicacion: "Comunicación",
  referente: "Referente",
  voluntario: "Voluntario/a",
};
/** Roles que pueden publicar en el sitio. */
export const ROLES_SITIO: Rol[] = ["comando", "comunicacion"];
/** Roles con alcance territorial (solo ven sus barrios). */
export const ROLES_TERRITORIALES: Rol[] = ["referente", "voluntario"];

const id = z.string().uuid();
const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) => texto(max).optional().nullable().transform((v) => (v ? v : null));
const fechaIso = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/));
const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usar #RRGGBB)");
export const SlugSchema = z.string().regex(/^[a-z0-9-]{3,40}$/, "Solo minúsculas, números y guiones (3 a 40)");

export const ConfigCampaniaSchema = z.object({
  nombre: texto(80).min(2),
  candidato: texto(80).min(2),
  cargo: texto(60).default("Intendente"),
  ciudad: texto(80).min(2),
  lema: opcional(140),
  colorPrimario: colorHex,
  colorSecundario: colorHex,
  fechaEleccion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  configuracionCompleta: z.boolean().default(false),
});
export type ConfigCampania = z.infer<typeof ConfigCampaniaSchema>;

export const CrearCampaniaSchema = z.object({
  slug: SlugSchema,
  config: ConfigCampaniaSchema.pick({ nombre: true, candidato: true, ciudad: true, colorPrimario: true, colorSecundario: true }),
  admin: z.object({ nombre: texto(80).min(2), email: z.string().email(), password: z.string().min(8) }),
});
export type CrearCampania = z.infer<typeof CrearCampaniaSchema>;

export const GeometriaSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
});
export type Geometria = z.infer<typeof GeometriaSchema>;

export const BarrioInputSchema = z.object({
  nombre: texto(80).min(2),
  geometria: GeometriaSchema.optional().nullable(),
  objetivoContactos: z.number().int().min(0).optional().nullable(),
});
export type BarrioInput = z.infer<typeof BarrioInputSchema>;
export interface Barrio extends BarrioInput {
  id: string;
}

export const TemaInputSchema = z.object({ nombre: texto(60).min(2), color: colorHex.optional().nullable() });
export type TemaInput = z.infer<typeof TemaInputSchema>;
export interface Tema {
  id: string;
  nombre: string;
  color: string | null;
}

export const UsuarioInputSchema = z.object({
  nombre: texto(80).min(2),
  email: z.string().trim().toLowerCase().email(),
  telefono: opcional(30),
  rol: z.enum(ROLES),
  barrioIds: z.array(id).default([]),
  password: z.string().min(8).optional(),
  activo: z.boolean().default(true),
});
export type UsuarioInput = z.infer<typeof UsuarioInputSchema>;
export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  barrioIds: string[];
  activo: boolean;
}

export const LoginSchema = z.object({
  campania: SlugSchema,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export interface Sesion {
  usuario: Usuario;
  campania: { slug: string } & ConfigCampania;
}

// ======================================================================
// Sitio del candidato
// ======================================================================

const url = z.string().trim().url().max(300).optional().nullable().or(z.literal("").transform(() => null));

export const AYUDAS = ["timbreo", "fiscal", "redes", "eventos", "aporte", "otro"] as const;
export type Ayuda = (typeof AYUDAS)[number];
export const AYUDA_LABEL: Record<Ayuda, string> = {
  timbreo: "Recorrer el barrio",
  fiscal: "Ser fiscal el día de la elección",
  redes: "Difundir en redes",
  eventos: "Ayudar en actividades",
  aporte: "Aportar materiales o recursos",
  otro: "Otra forma",
};

export const SitioConfigSchema = z.object({
  publicado: z.boolean().default(false),
  titular: opcional(120), // frase grande del inicio
  bajada: opcional(300),
  biografia: opcional(8000), // texto con formato simple
  fotoId: id.optional().nullable(),
  portadaId: id.optional().nullable(),
  textoSumate: opcional(400),
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  whatsapp: opcional(30), // número público de contacto (click-to-chat)
  instagram: url,
  facebook: url,
  x: url,
  tiktok: url,
  youtube: url,
  politicaPrivacidad: opcional(6000),
  responsableDatos: opcional(160), // quién es responsable de la base (Ley 25.326)
});
export type SitioConfig = z.infer<typeof SitioConfigSchema>;

export const ESTADOS_NOTICIA = ["borrador", "publicada"] as const;
export type EstadoNoticia = (typeof ESTADOS_NOTICIA)[number];

export const NoticiaInputSchema = z.object({
  titulo: texto(140).min(4),
  bajada: opcional(300),
  cuerpo: texto(30000).default(""),
  imagenId: id.optional().nullable(),
  temaId: id.optional().nullable(),
  barrioId: id.optional().nullable(),
  estado: z.enum(ESTADOS_NOTICIA).default("borrador"),
  destacada: z.boolean().default(false),
  /** Fecha visible de la nota; si no se indica, se usa el momento de publicación. */
  fecha: fechaIso.optional().nullable(),
});
export type NoticiaInput = z.infer<typeof NoticiaInputSchema>;
export interface Noticia extends Omit<NoticiaInput, "fecha"> {
  id: string;
  slug: string;
  fecha: string | null;
  autorId: string | null;
  autorNombre?: string | null;
  creadaEn: string;
  actualizadaEn: string;
}

export const PropuestaInputSchema = z.object({
  titulo: texto(140).min(4),
  descripcion: texto(4000).min(10),
  temaId: id.optional().nullable(),
  orden: z.number().int().default(0),
  publicada: z.boolean().default(true),
});
export type PropuestaInput = z.infer<typeof PropuestaInputSchema>;
export interface Propuesta extends PropuestaInput {
  id: string;
}

export const TIPOS_ACTIVIDAD = ["caminata", "reunion", "acto", "medios", "timbreo", "otro"] as const;
export const TIPO_ACTIVIDAD_LABEL: Record<(typeof TIPOS_ACTIVIDAD)[number], string> = {
  caminata: "Caminata",
  reunion: "Reunión",
  acto: "Acto",
  medios: "Medios",
  timbreo: "Timbreo",
  otro: "Otro",
};
export const ActividadInputSchema = z.object({
  titulo: texto(120).min(2),
  tipo: z.enum(TIPOS_ACTIVIDAD),
  inicio: fechaIso,
  fin: fechaIso.optional().nullable(),
  lugar: opcional(160),
  barrioId: id.optional().nullable(),
  responsableId: id.optional().nullable(),
  conCandidato: z.boolean().default(false),
  /** Visible en la agenda del sitio público. */
  publica: z.boolean().default(false),
  descripcionPublica: opcional(600),
  notas: opcional(2000),
});
export type ActividadInput = z.infer<typeof ActividadInputSchema>;
export interface Actividad extends ActividadInput {
  id: string;
}

/** Formulario público "Sumate". `sitio_web` es un campo trampa (honeypot) que un humano no completa. */
export const SumateSchema = z.object({
  nombre: texto(80).min(2),
  apellido: opcional(80),
  telefono: texto(30).min(6),
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  barrioId: id.optional().nullable().or(z.literal("").transform(() => null)),
  ayudas: z.array(z.enum(AYUDAS)).max(AYUDAS.length).default([]),
  mensaje: opcional(600),
  consentimiento: z.literal(true, { errorMap: () => ({ message: "Necesitamos tu consentimiento para guardar tus datos" }) }),
  sitio_web: z.string().max(0).optional().default(""),
});
export type Sumate = z.infer<typeof SumateSchema>;

/** Vecino tal como lo ve el módulo 1 (los que se sumaron desde el sitio). */
export interface Adhesion {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  email: string | null;
  barrioId: string | null;
  ayudas: Ayuda[];
  mensaje: string | null;
  origen: string;
  consentimientoFecha: string | null;
  creadoEn: string;
  contactado: boolean;
}

export interface Imagen {
  id: string;
  ancho: number;
  alto: number;
  alt: string | null;
  creadaEn: string;
}

export interface ResumenSitio {
  publicado: boolean;
  url: string;
  noticiasPublicadas: number;
  borradores: number;
  adhesiones: number;
  adhesiones7d: number;
  sinContactar: number;
  proximasPublicas: number;
  porAyuda: Array<{ ayuda: Ayuda; cantidad: number }>;
  porSemana: Array<{ semana: string; cantidad: number }>;
  diasParaEleccion: number | null;
}

// ======================================================================
// Utilidades compartidas
// ======================================================================

/** Normaliza un teléfono argentino a formato internacional para wa.me (54 9 + área + número). */
export function telefonoWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1]! + m[2]!).length === 10) d = m[1]! + m[2]!;
  if (d.length !== 10) return null;
  return `549${d}`;
}

/** "Más luz en Barrio Norte!" → "mas-luz-en-barrio-norte" */
export function slugificar(t: string): string {
  return (
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 70)
      .replace(/-+$/g, "") || "nota"
  );
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
export { escapar as escaparHtml };

function enLinea(s: string): string {
  // s ya viene escapado
  return s
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t: string, u: string) => `<a href="${u}" rel="noopener nofollow" target="_blank">${t}</a>`);
}

/**
 * Formato simple y seguro para noticias y biografía (subconjunto de Markdown):
 *   ## Subtítulo   **negrita**   *cursiva*   [texto](https://link)
 *   - lista   1. lista numerada   > cita   párrafos separados por línea en blanco
 * Todo el HTML del usuario se escapa: no se puede inyectar código.
 */
export function formatoATexto(md: string | null | undefined): string {
  if (!md) return "";
  const salida: string[] = [];
  let tipo: "p" | "ul" | "ol" | "cita" | null = null;
  let acum: string[] = [];
  const cerrar = () => {
    if (!tipo || !acum.length) {
      tipo = null;
      acum = [];
      return;
    }
    if (tipo === "p") salida.push(`<p>${acum.map(enLinea).join("<br>")}</p>`);
    else if (tipo === "cita") salida.push(`<blockquote>${acum.map(enLinea).join("<br>")}</blockquote>`);
    else salida.push(`<${tipo}>${acum.map((l) => `<li>${enLinea(l)}</li>`).join("")}</${tipo}>`);
    tipo = null;
    acum = [];
  };
  for (const cruda of escapar(md.replace(/\r\n/g, "\n")).split("\n")) {
    const l = cruda.trim();
    let m: RegExpMatchArray | null;
    if (!l) cerrar();
    else if ((m = l.match(/^#{1,3}\s+(.+)$/))) {
      cerrar();
      salida.push(`<h2>${enLinea(m[1]!)}</h2>`);
    } else if ((m = l.match(/^[-•*]\s+(.+)$/))) {
      if (tipo !== "ul") cerrar();
      tipo = "ul";
      acum.push(m[1]!);
    } else if ((m = l.match(/^\d+[.)]\s+(.+)$/))) {
      if (tipo !== "ol") cerrar();
      tipo = "ol";
      acum.push(m[1]!);
    } else if ((m = l.match(/^&gt;\s?(.*)$/))) {
      if (tipo !== "cita") cerrar();
      tipo = "cita";
      acum.push(m[1]!);
    } else {
      if (tipo !== "p") cerrar();
      tipo = "p";
      acum.push(l);
    }
  }
  cerrar();
  return salida.join("\n");
}

/** Texto plano corto (para resúmenes y descripciones de Open Graph). */
export function extracto(md: string | null | undefined, max = 180): string {
  if (!md) return "";
  const plano = md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*#>_`]/g, "")
    .replace(/^\s*-\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  return plano.length > max ? plano.slice(0, max - 1).replace(/\s+\S*$/, "") + "…" : plano;
}
