import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Barrio, ConfigCampania, Rol, Sesion, SitioConfig, Tema } from "@aci/shared";
import { api, ApiError } from "./api";

export interface Catalogos {
  config: ConfigCampania;
  sitio: SitioConfig;
  barrios: Barrio[];
  temas: Tema[];
  equipo: { id: string; nombre: string; rol: Rol }[];
}

interface Estado {
  sesion: Sesion | null;
  catalogos: Catalogos | null;
  cargando: boolean;
  ingresar: (s: Sesion) => Promise<void>;
  salir: () => Promise<void>;
  recargarCatalogos: () => Promise<void>;
  /** Barrios visibles para el usuario actual. */
  misBarrios: Barrio[];
  nombreBarrio: (id: string | null | undefined) => string;
  nombreTema: (id: string | null | undefined) => string;
  /** Dirección del sitio público de la campaña. */
  urlSitio: string;
  puede: (...roles: Rol[]) => boolean;
}

const Ctx = createContext<Estado | null>(null);

export function useEstado() {
  const e = useContext(Ctx);
  if (!e) throw new Error("useEstado fuera del proveedor");
  return e;
}

function aplicarTema(c: ConfigCampania | undefined) {
  if (!c) return;
  const r = document.documentElement.style;
  r.setProperty("--primario", c.colorPrimario);
  r.setProperty("--secundario", c.colorSecundario);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.colorPrimario);
  document.title = `${c.candidato} · Panel`;
}

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargarCatalogos = useCallback(async () => {
    const c = await api.get<Catalogos>("/catalogos");
    setCatalogos(c);
    aplicarTema(c.config);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<Sesion>("/auth/sesion");
        setSesion(s);
        aplicarTema(s.campania);
        await recargarCatalogos();
      } catch (e) {
        if (!(e instanceof ApiError)) console.error(e);
      } finally {
        setCargando(false);
      }
    })();
  }, [recargarCatalogos]);

  const ingresar = useCallback(
    async (s: Sesion) => {
      setSesion(s);
      aplicarTema(s.campania);
      await recargarCatalogos();
    },
    [recargarCatalogos],
  );

  const salir = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* igual limpiamos */
    }
    setSesion(null);
    setCatalogos(null);
  }, []);

  const rol = sesion?.usuario.rol;
  const misBarrios =
    catalogos && sesion
      ? rol === "referente" || rol === "voluntario"
        ? catalogos.barrios.filter((b) => sesion.usuario.barrioIds.includes(b.id))
        : catalogos.barrios
      : [];

  const valor: Estado = {
    sesion,
    catalogos,
    cargando,
    ingresar,
    salir,
    recargarCatalogos,
    misBarrios,
    nombreBarrio: (id) => catalogos?.barrios.find((b) => b.id === id)?.nombre ?? "—",
    nombreTema: (id) => catalogos?.temas.find((t) => t.id === id)?.nombre ?? "—",
    urlSitio: sesion ? `/s/${sesion.campania.slug}/` : "/",
    puede: (...roles) => Boolean(rol && roles.includes(rol)),
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
