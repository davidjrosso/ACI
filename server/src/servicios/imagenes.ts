import sharp from "sharp";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Imagen } from "@aci/shared";
import type { DB } from "../db/conexion.js";
import { ErrorApp, nuevoId } from "./comun.js";

/**
 * Variantes que se generan de cada imagen subida (WebP, livianas para celulares):
 *  - g: grande, hasta 1600 px de ancho (cuerpo de la noticia, portada)
 *  - m: mediana, 800 px (tarjetas del listado)
 *  - og: 1200×630 recortada (vista previa al compartir en WhatsApp / redes)
 */
export const VARIANTES = ["g", "m", "og"] as const;
export type Variante = (typeof VARIANTES)[number];

const MAX_BYTES = 8 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export async function guardarImagen(db: DB, carpeta: string, datos: Buffer, mime: string, usuarioId: string, alt?: string | null): Promise<Imagen> {
  if (!TIPOS.includes(mime)) throw new ErrorApp(400, "Formato no soportado. Usá JPG, PNG o WebP.");
  if (datos.length > MAX_BYTES) throw new ErrorApp(400, "La imagen pesa más de 8 MB.");
  let meta: sharp.Metadata;
  try {
    meta = await sharp(datos).metadata();
  } catch {
    throw new ErrorApp(400, "No se pudo leer la imagen.");
  }
  if (!meta.width || !meta.height) throw new ErrorApp(400, "No se pudo leer la imagen.");

  const id = nuevoId();
  mkdirSync(carpeta, { recursive: true });
  // .rotate() aplica la orientación EXIF (fotos de celular) y luego se descartan los metadatos (ubicación GPS incluida)
  const base = sharp(datos).rotate();
  const g = await base.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toFile(join(carpeta, `${id}-g.webp`));
  await base.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 76 }).toFile(join(carpeta, `${id}-m.webp`));
  await base.clone().resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toFile(join(carpeta, `${id}-og.jpg`));

  db.prepare("INSERT INTO imagenes (id, ancho, alto, alt, bytes, subida_por) VALUES (?, ?, ?, ?, ?, ?)").run(id, g.width, g.height, alt ?? null, g.size, usuarioId);
  return { id, ancho: g.width, alto: g.height, alt: alt ?? null, creadaEn: new Date().toISOString() };
}

export function archivoImagen(carpeta: string, id: string, variante: Variante): { ruta: string; tipo: string } | null {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const ext = variante === "og" ? "jpg" : "webp";
  const ruta = join(carpeta, `${id}-${variante}.${ext}`);
  return existsSync(ruta) ? { ruta, tipo: ext === "jpg" ? "image/jpeg" : "image/webp" } : null;
}

export function listarImagenes(db: DB): Imagen[] {
  return (db.prepare("SELECT id, ancho, alto, alt, creada_en FROM imagenes ORDER BY creada_en DESC LIMIT 200").all() as any[]).map((r) => ({
    id: r.id,
    ancho: r.ancho,
    alto: r.alto,
    alt: r.alt,
    creadaEn: r.creada_en,
  }));
}

export function borrarImagen(db: DB, carpeta: string, id: string) {
  const usada = db.prepare("SELECT (SELECT COUNT(*) FROM noticias WHERE imagen_id = ?) n").get(id) as { n: number };
  if (usada.n > 0) throw new ErrorApp(409, "La imagen está en uso en una noticia.");
  db.prepare("DELETE FROM imagenes WHERE id = ?").run(id);
  for (const v of VARIANTES) rmSync(join(carpeta, `${id}-${v}.${v === "og" ? "jpg" : "webp"}`), { force: true });
}
