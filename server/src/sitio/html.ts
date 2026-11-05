import { escaparHtml } from "@aci/shared";

/** Fragmento HTML ya seguro (no se vuelve a escapar). */
export class Crudo {
  constructor(public readonly valor: string) {}
  toString() {
    return this.valor;
  }
}
export const crudo = (s: string) => new Crudo(s);

type Valor = string | number | null | undefined | false | Crudo | Valor[];

function aTexto(v: Valor): string {
  if (v === null || v === undefined || v === false) return "";
  if (v instanceof Crudo) return v.valor;
  if (Array.isArray(v)) return v.map(aTexto).join("");
  return escaparHtml(String(v));
}

/**
 * Plantilla HTML con escape automático: html`<p>${texto}</p>`.
 * Todo lo interpolado se escapa salvo que sea `crudo(...)` u otra plantilla `html`.
 */
export function html(partes: TemplateStringsArray, ...valores: Valor[]): Crudo {
  let s = partes[0]!;
  valores.forEach((v, i) => (s += aTexto(v) + partes[i + 1]!));
  return new Crudo(s);
}

/** Elige texto blanco o casi negro según el color de fondo (contraste WCAG). */
export function textoSobre(hex: string): string {
  const c = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  return (1.05 / (lum + 0.05)) >= 4.5 ? "#ffffff" : "#141413";
}

/** Oscurece un color hex (para hover y fondos profundos). */
export function oscurecer(hex: string, f = 0.25): string {
  const c = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - f)));
  return "#" + ch.map((x) => x.toString(16).padStart(2, "0")).join("");
}

const TZ = "America/Argentina/Buenos_Aires";
const fFecha = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const fDia = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
const fHora = new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
const fDiaNum = new Intl.DateTimeFormat("es-AR", { day: "numeric", timeZone: TZ });
const fMes = new Intl.DateTimeFormat("es-AR", { month: "short", timeZone: TZ });
export const fecha = (iso: string | null | undefined) => (iso ? fFecha.format(new Date(iso)) : "");
export const dia = (iso: string) => {
  const t = fDia.format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
};
export const hora = (iso: string) => fHora.format(new Date(iso));
export const diaNum = (iso: string) => fDiaNum.format(new Date(iso));
export const mes = (iso: string) => fMes.format(new Date(iso)).replace(".", "");
