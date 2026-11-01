/**
 * Soporte sin conexión.
 *  - "kv": sesión y catálogos guardados para abrir la app sin señal.
 *  - "cola": interacciones cargadas en la calle, pendientes de enviar.
 *  - "vecinos": copia local de los vecinos de los barrios del usuario (para buscar en la puerta).
 * La sincronización es idempotente: el id de cada interacción se genera acá, así reintentar no duplica.
 */
import { openDB, type IDBPDatabase } from "idb";
import type { InteraccionInput, Vecino } from "@territorio/shared";
import { api, ApiError } from "./api";

interface Pendiente {
  id: string;
  campania: string;
  datos: InteraccionInput;
  creadoEn: string;
  error?: string;
}

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB("territorio", 1, {
    upgrade(d) {
      d.createObjectStore("kv");
      const cola = d.createObjectStore("cola", { keyPath: "id" });
      cola.createIndex("campania", "campania");
      d.createObjectStore("vecinos");
    },
  });
  return dbp;
}

export async function guardarKV(clave: string, valor: unknown) {
  try {
    await (await db()).put("kv", valor, clave);
  } catch {
    /* almacenamiento no disponible (modo privado): la app sigue funcionando online */
  }
}
export async function leerKV<T>(clave: string): Promise<T | undefined> {
  try {
    return (await (await db()).get("kv", clave)) as T | undefined;
  } catch {
    return undefined;
  }
}

// ---------- Cola de interacciones ----------

const oyentes = new Set<() => void>();
export function suscribirCola(fn: () => void) {
  oyentes.add(fn);
  return (): void => {
    oyentes.delete(fn);
  };
}
const avisar = () => oyentes.forEach((f) => f());

export async function encolar(campania: string, datos: InteraccionInput) {
  await (await db()).put("cola", { id: datos.id, campania, datos, creadoEn: new Date().toISOString() } satisfies Pendiente);
  avisar();
  void sincronizar(campania);
}

export async function pendientes(campania: string): Promise<Pendiente[]> {
  try {
    return (await (await db()).getAllFromIndex("cola", "campania", campania)) as Pendiente[];
  } catch {
    return [];
  }
}

let sincronizando = false;
/** Envía la cola al servidor. Devuelve cuántas quedaron pendientes. */
export async function sincronizar(campania: string): Promise<number> {
  if (sincronizando) return (await pendientes(campania)).length;
  sincronizando = true;
  try {
    const lista = (await pendientes(campania)).filter((p) => !p.error);
    for (let i = 0; i < lista.length; i += 100) {
      const tramo = lista.slice(i, i + 100);
      const r = await api.post<{ aceptadas: string[]; duplicadas: string[]; rechazadas: { id: string; error: string }[] }>("/interacciones/lote", {
        interacciones: tramo.map((p) => p.datos),
      });
      const d = await db();
      for (const id of [...r.aceptadas, ...r.duplicadas]) await d.delete("cola", id);
      for (const x of r.rechazadas) {
        const p = tramo.find((t) => t.id === x.id);
        if (p) await d.put("cola", { ...p, error: x.error });
      }
    }
  } catch (e) {
    if (!(e instanceof ApiError && e.sinConexion)) console.warn("Error al sincronizar", e);
  } finally {
    sincronizando = false;
    avisar();
  }
  return (await pendientes(campania)).length;
}

export async function descartarPendiente(id: string) {
  await (await db()).delete("cola", id);
  avisar();
}

// ---------- Copia local de vecinos ----------

export async function guardarVecinosLocales(campania: string, vecinos: Vecino[]) {
  try {
    await (await db()).put("vecinos", { fecha: new Date().toISOString(), vecinos }, campania);
  } catch {
    /* sin almacenamiento */
  }
}
export async function leerVecinosLocales(campania: string): Promise<{ fecha: string; vecinos: Vecino[] } | undefined> {
  try {
    return await (await db()).get("vecinos", campania);
  } catch {
    return undefined;
  }
}

export async function borrarTodoLocal() {
  try {
    const d = await db();
    await Promise.all([d.clear("kv"), d.clear("vecinos")]);
  } catch {
    /* nada */
  }
}
