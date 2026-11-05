import { join } from "node:path";
import { existsSync } from "node:fs";
import { abrirBase, type DB } from "./conexion.js";

/**
 * Registro de bases: una base de plataforma + un archivo SQLite por campaña.
 * Las conexiones de campaña se abren a demanda y quedan en caché.
 */
export class RegistroBases {
  readonly plataforma: DB;
  private campanias = new Map<string, DB>();

  constructor(private dataDir: string) {
    this.plataforma = abrirBase(dataDir === ":memory:" ? ":memory:" : join(dataDir, "plataforma.db"), "platform");
  }

  rutaCampania(slug: string) {
    return join(this.dataDir, "campanias", `${slug}.db`);
  }

  /** Carpeta de imágenes de una campaña: <data>/media/<slug>/ */
  rutaMedia(slug: string) {
    return join(this.dataDir, "media", slug);
  }

  /** Campaña asociada a un dominio propio (ej. lauramedina.com.ar), o null. */
  campaniaPorHost(host: string | undefined): string | null {
    if (!host) return null;
    const limpio = host.split(":")[0]!.toLowerCase().replace(/^www\./, "");
    const fila = this.plataforma.prepare("SELECT campania FROM dominios WHERE host = ?").get(limpio) as { campania: string } | undefined;
    return fila?.campania ?? null;
  }

  existe(slug: string): boolean {
    const fila = this.plataforma.prepare("SELECT 1 FROM campanias WHERE slug = ? AND activa = 1").get(slug);
    return Boolean(fila);
  }

  /** Abre (o crea, si `crear`) la base de una campaña. */
  campania(slug: string, crear = false): DB {
    const abierta = this.campanias.get(slug);
    if (abierta) return abierta;
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) throw new Error("slug inválido");
    const enMemoria = this.dataDir === ":memory:";
    if (!crear && !this.existe(slug)) throw new Error(`La campaña ${slug} no existe`);
    if (!crear && !enMemoria && !existsSync(this.rutaCampania(slug))) throw new Error(`Falta el archivo de la campaña ${slug}`);
    const db = abrirBase(enMemoria ? ":memory:" : this.rutaCampania(slug), "campania");
    this.campanias.set(slug, db);
    return db;
  }

  listarSlugs(): string[] {
    return (this.plataforma.prepare("SELECT slug FROM campanias WHERE activa = 1 ORDER BY slug").all() as { slug: string }[]).map((r) => r.slug);
  }

  cerrar() {
    for (const db of this.campanias.values()) db.close();
    this.campanias.clear();
    this.plataforma.close();
  }
}
