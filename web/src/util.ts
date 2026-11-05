export const uuid = () => crypto.randomUUID();

const fmtFecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDia = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const fmtHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtNum = new Intl.NumberFormat("es-AR");

export const fecha = (iso?: string | null) => (iso ? fmtFecha.format(new Date(iso)) : "—");
export const fechaHora = (iso?: string | null) => (iso ? fmtFechaHora.format(new Date(iso)) : "—");
export const dia = (iso: string) => fmtDia.format(new Date(iso));
export const hora = (iso: string) => fmtHora.format(new Date(iso));
export const num = (n: number) => fmtNum.format(n);
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** Tiempo relativo corto: "hace 3 días". */
export function hace(iso?: string | null): string {
  if (!iso) return "sin contacto";
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return "hoy";
  if (d < 2) return "ayer";
  if (d < 30) return `hace ${Math.floor(d)} días`;
  return fecha(iso);
}

/** Fecha/hora local para <input type="datetime-local"> */
export function aInputLocal(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const deInputLocal = (v: string) => new Date(v).toISOString();

/** Contraseña temporal legible para entregar a un voluntario. */
export function passwordTemporal(): string {
  const p = ["sol", "rio", "mate", "plaza", "barrio", "calle", "luna", "pino", "faro", "nube"];
  const a = p[Math.floor(Math.random() * p.length)]!;
  const b = p[Math.floor(Math.random() * p.length)]!;
  return `${a}-${b}-${Math.floor(100 + Math.random() * 900)}`;
}
