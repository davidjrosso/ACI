/**
 * Contrato compartido entre servidor y web.
 * Todo lo que viaja por la API se valida con estos esquemas (zod),
 * así un cambio de modelo se refleja en ambos lados al compilar.
 */
import { z } from "zod";

// ---------- Enumeraciones fijas del dominio ----------

export const ROLES = ["comando", "referente", "voluntario"] as const;
export type Rol = (typeof ROLES)[number];

export const APOYOS = ["apoya", "indeciso", "no_apoya", "sin_dato"] as const;
export type Apoyo = (typeof APOYOS)[number];

export const APOYO_LABEL: Record<Apoyo, string> = {
  apoya: "Apoya",
  indeciso: "Indeciso",
  no_apoya: "No apoya",
  sin_dato: "Sin dato",
};

export const CANALES = ["puerta", "whatsapp", "telefono", "evento"] as const;
export type Canal = (typeof CANALES)[number];

export const RESULTADOS = ["atendio", "no_estaba", "no_quiso"] as const;
export type Resultado = (typeof RESULTADOS)[number];

export const RESULTADO_LABEL: Record<Resultado, string> = {
  atendio: "Atendió",
  no_estaba: "No estaba",
  no_quiso: "No quiso hablar",
};

export const TIPOS_RECLAMO = ["reclamo", "propuesta"] as const;
export const ESTADOS_RECLAMO = ["nuevo", "en_curso", "resuelto"] as const;
export type EstadoReclamo = (typeof ESTADOS_RECLAMO)[number];

export const TIPOS_ACTIVIDAD = ["timbreo", "reunion", "acto", "caminata", "medios", "otro"] as const;

// ---------- Primitivas ----------

const id = z.string().uuid();
const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) => texto(max).optional().nullable().transform((v) => (v ? v : null));
const fechaIso = z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/));
const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color inválido (usar #RRGGBB)");
const slug = z.string().regex(/^[a-z0-9-]{3,40}$/, "Solo minúsculas, números y guiones (3 a 40)");

// ---------- Campaña / configuración ----------

export const ConfigCampaniaSchema = z.object({
  nombre: texto(80).min(2),
  candidato: texto(80).min(2),
  ciudad: texto(80).min(2),
  lema: opcional(140),
  colorPrimario: colorHex,
  colorSecundario: colorHex,
  fechaEleccion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  mapaCentro: z.tuple([z.number(), z.number()]).optional().nullable(),
  mapaZoom: z.number().int().min(1).max(19).optional().nullable(),
  mapaConTiles: z.boolean().default(true),
  configuracionCompleta: z.boolean().default(false),
});
export type ConfigCampania = z.infer<typeof ConfigCampaniaSchema>;

export const CrearCampaniaSchema = z.object({
  slug,
  config: ConfigCampaniaSchema.pick({ nombre: true, candidato: true, ciudad: true, colorPrimario: true, colorSecundario: true }),
  admin: z.object({ nombre: texto(80).min(2), email: z.string().email(), password: z.string().min(8) }),
});
export type CrearCampania = z.infer<typeof CrearCampaniaSchema>;

// GeoJSON mínimo: un polígono (anillo exterior) en [lng, lat]
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
export interface Tema { id: string; nombre: string; color: string | null }

export const PlantillaInputSchema = z.object({ titulo: texto(60).min(2), texto: texto(1000).min(5) });
export type PlantillaInput = z.infer<typeof PlantillaInputSchema>;
export interface Plantilla extends PlantillaInput { id: string }

// ---------- Usuarios ----------

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
  campania: slug,
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export interface Sesion {
  usuario: Usuario;
  campania: { slug: string } & ConfigCampania;
}

// ---------- Vecinos ----------

export const VecinoInputSchema = z.object({
  id: id.optional(), // permite crear desde el celular sin conexión
  nombre: texto(80).min(1),
  apellido: opcional(80),
  telefono: opcional(30),
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  direccion: opcional(120),
  barrioId: id,
  apoyo: z.enum(APOYOS).default("sin_dato"),
  etiquetas: z.array(texto(30).min(1)).max(20).default([]),
  notas: opcional(2000),
  consentimiento: z.boolean().default(false),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
});
export type VecinoInput = z.infer<typeof VecinoInputSchema>;

export interface Vecino extends Omit<VecinoInput, "id"> {
  id: string;
  consentimientoFecha: string | null;
  creadoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
  ultimaInteraccion: string | null;
}

// ---------- Interacciones (timbreo, WhatsApp, llamadas) ----------

export const InteraccionInputSchema = z.object({
  id, // generado en el cliente: idempotencia para la sincronización offline
  vecinoId: id.optional().nullable(),
  barrioId: id,
  canal: z.enum(CANALES),
  resultado: z.enum(RESULTADOS),
  apoyo: z.enum(APOYOS).optional().nullable(),
  temaId: id.optional().nullable(),
  direccion: opcional(120),
  nota: opcional(1000),
  fecha: fechaIso,
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  // Si el voluntario carga un vecino nuevo en la puerta, viaja junto con la visita
  vecinoNuevo: VecinoInputSchema.optional().nullable(),
});
export type InteraccionInput = z.infer<typeof InteraccionInputSchema>;

export const LoteInteraccionesSchema = z.object({ interacciones: z.array(InteraccionInputSchema).max(500) });

export interface Interaccion extends Omit<InteraccionInput, "vecinoNuevo"> {
  usuarioId: string;
  usuarioNombre?: string;
  vecinoNombre?: string | null;
}

// ---------- Reclamos y propuestas ----------

export const ReclamoInputSchema = z.object({
  tipo: z.enum(TIPOS_RECLAMO),
  temaId: id,
  barrioId: id,
  vecinoId: id.optional().nullable(),
  descripcion: texto(2000).min(5),
  direccion: opcional(120),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  estado: z.enum(ESTADOS_RECLAMO).default("nuevo"),
});
export type ReclamoInput = z.infer<typeof ReclamoInputSchema>;
export interface Reclamo extends ReclamoInput {
  id: string;
  creadoPor: string | null;
  creadoEn: string;
}

// ---------- Agenda ----------

export const ActividadInputSchema = z.object({
  titulo: texto(120).min(2),
  tipo: z.enum(TIPOS_ACTIVIDAD),
  inicio: fechaIso,
  fin: fechaIso.optional().nullable(),
  lugar: opcional(160),
  barrioId: id.optional().nullable(),
  responsableId: id.optional().nullable(),
  conCandidato: z.boolean().default(false),
  notas: opcional(2000),
});
export type ActividadInput = z.infer<typeof ActividadInputSchema>;
export interface Actividad extends ActividadInput { id: string }

// ---------- Tablero ----------

export interface Tablero {
  totales: { vecinos: number; interacciones: number; interacciones7d: number; reclamosAbiertos: number; voluntariosActivos7d: number };
  apoyo: Record<Apoyo, number>;
  porBarrio: Array<{ barrioId: string; nombre: string; vecinos: number; objetivo: number | null; apoya: number; indeciso: number; noApoya: number; sinDato: number; interacciones7d: number; reclamosAbiertos: number }>;
  porSemana: Array<{ semana: string; interacciones: number }>;
  reclamosPorTema: Array<{ temaId: string; nombre: string; cantidad: number }>;
  rankingVoluntarios: Array<{ usuarioId: string; nombre: string; interacciones: number }>;
  diasParaEleccion: number | null;
}

// ---------- Utilidades compartidas ----------

/** Normaliza un teléfono argentino a formato internacional para wa.me (54 9 + área + número). */
export function telefonoWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let d = tel.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("54")) d = d.slice(2);
  if (d.startsWith("9")) d = d.slice(1);
  if (d.startsWith("0")) d = d.slice(1);
  // quitar el "15" del celular cuando viene después del código de área (2 a 4 dígitos)
  const m = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (m && (m[1] + m[2]).length === 10) d = m[1] + m[2];
  if (d.length !== 10) return null;
  return `549${d}`;
}

/** Reemplaza {nombre}, {barrio}, {candidato} en una plantilla de mensaje. */
export function completarPlantilla(texto: string, datos: Record<string, string | null | undefined>): string {
  return texto.replace(/\{(\w+)\}/g, (_, k: string) => datos[k] ?? "");
}
