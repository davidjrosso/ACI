import { resolve } from "node:path";

/** Configuración por variables de entorno. Valores por defecto pensados para desarrollo. */
export const config = {
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "0.0.0.0",
  /** Carpeta de datos (plataforma.db + campanias/*.db). Por defecto: <repo>/data */
  dataDir: process.env.DATA_DIR === ":memory:" ? ":memory:" : resolve(process.env.DATA_DIR ?? resolve(import.meta.dirname, "../../data")),
  /** Token para crear campañas nuevas (POST /api/plataforma/campanias). Si no se define, la creación queda deshabilitada. */
  platformToken: process.env.PLATFORM_TOKEN ?? "",
  /** Días que dura una sesión iniciada. */
  sessionDays: Number(process.env.SESSION_DAYS ?? 30),
  /** Cookie Secure: activarlo en producción detrás de HTTPS. */
  cookieSecure: process.env.COOKIE_SECURE === "1",
  /** Carpeta del build de la web para servirla desde el mismo proceso. */
  webDist: process.env.WEB_DIST ? resolve(process.env.WEB_DIST) : resolve(import.meta.dirname, "../../web/dist"),
  logLevel: process.env.LOG_LEVEL ?? "info",
};

export type AppConfig = typeof config;
