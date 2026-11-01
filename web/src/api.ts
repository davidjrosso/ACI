/** Cliente HTTP mínimo. Toda la API vive bajo /api y usa cookie de sesión. */

export class ApiError extends Error {
  constructor(public status: number, message: string, public codigo?: string, public detalle?: string[]) {
    super(message);
  }
  /** true si el error es por falta de conexión (no hubo respuesta del servidor). */
  get sinConexion() {
    return this.status === 0;
  }
}

async function pedir<T>(metodo: string, url: string, cuerpo?: unknown): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`/api${url}`, {
      method: metodo,
      credentials: "same-origin",
      headers: cuerpo !== undefined ? { "content-type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
  } catch {
    throw new ApiError(0, "Sin conexión con el servidor", "sin_conexion");
  }
  const tipo = r.headers.get("content-type") ?? "";
  const datos = tipo.includes("application/json") ? await r.json() : await r.text();
  if (!r.ok) {
    const d = typeof datos === "object" && datos ? (datos as any) : {};
    throw new ApiError(r.status, d.error ?? `Error ${r.status}`, d.codigo, d.detalle);
  }
  return datos as T;
}

export const api = {
  get: <T>(url: string) => pedir<T>("GET", url),
  post: <T>(url: string, cuerpo?: unknown) => pedir<T>("POST", url, cuerpo ?? {}),
  put: <T>(url: string, cuerpo: unknown) => pedir<T>("PUT", url, cuerpo),
  patch: <T>(url: string, cuerpo: unknown) => pedir<T>("PATCH", url, cuerpo),
  del: <T>(url: string) => pedir<T>("DELETE", url),
};

/** Arma un query string ignorando valores vacíos. */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) return e.detalle?.length ? `${e.message}: ${e.detalle.join(" · ")}` : e.message;
  return "Ocurrió un error inesperado";
}
