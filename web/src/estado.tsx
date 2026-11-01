import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Barrio, ConfigCampania, Plantilla, Rol, Sesion, Tema } from "@territorio/shared";
import { api, ApiError } from "./api";
import { borrarTodoLocal, guardarKV, leerKV, pendientes, sincronizar, suscribirCola } from "./offline";

export interface Catalogos {
  config: ConfigCampania;
  barrios: Barrio[];
  temas: Tema[];
  plantillas: Plantilla[];
  equipo: { id: string; nombre: string; rol: Rol }[];
}

interface Estado {
  sesion: Sesion | null;
  catalogos: Catalogos | null;
  cargando: boolean;
  online: boolean;
  pendientes: number;
  ingresar: (s: Sesion) => Promise<void>;
  salir: () => Promise<void>;
  recargarCatalogos: () => Promise<void>;
  sincronizarAhora: () => Promise<void>;
  /** Barrios visibles para el usuario actual (comando: todos). */
  misBarrios: Barrio[];
  nombreBarrio: (id: string | null | undefined) => string;
  nombreTema: (id: string | null | undefined) => string;
}

const Ctx = createContext<Estado | null>(null);

export function useEstado() {
  const e = useContext(Ctx);
  if (!e) throw new Error("useEstado fuera del proveedor");
  return e;
}

/** Aplica los colores de la campaña como variables CSS. */
function aplicarTema(c: ConfigCampania | undefined) {
  if (!c) return;
  const r = document.documentElement.style;
  r.setProperty("--primario", c.colorPrimario);
  r.setProperty("--secundario", c.colorSecundario);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", c.colorPrimario);
  document.title = `${c.candidato} · ${c.nombre}`;
}

export function ProveedorEstado({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [online, setOnline] = useState(navigator.onLine);
  const [nPend, setNPend] = useState(0);

  const recargarCatalogos = useCallback(async () => {
    try {
      const c = await api.get<Catalogos>("/catalogos");
      setCatalogos(c);
      aplicarTema(c.config);
      await guardarKV("catalogos", c);
    } catch (e) {
      if (!(e instanceof ApiError && e.sinConexion)) throw e;
    }
  }, []);

  // Arranque: sesión del servidor, o la guardada si no hay señal
  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<Sesion>("/auth/sesion");
        setSesion(s);
        aplicarTema(s.campania);
        await guardarKV("sesion", s);
        await recargarCatalogos();
      } catch (e) {
        if (e instanceof ApiError && e.sinConexion) {
          const s = await leerKV<Sesion>("sesion");
          const c = await leerKV<Catalogos>("catalogos");
          if (s) {
            setSesion(s);
            aplicarTema(s.campania);
          }
          if (c) setCatalogos(c);
        }
      } finally {
        setCargando(false);
      }
    })();
  }, [recargarCatalogos]);

  // Conectividad y cola
  const slug = sesion?.campania.slug;
  useEffect(() => {
    if (!slug) return;
    const contar = () => pendientes(slug).then((p) => setNPend(p.length));
    const enLinea = () => {
      setOnline(true);
      void sincronizar(slug);
    };
    const sinLinea = () => setOnline(false);
    window.addEventListener("online", enLinea);
    window.addEventListener("offline", sinLinea);
    const quitar = suscribirCola(contar);
    void contar();
    void sincronizar(slug);
    const t = setInterval(() => navigator.onLine && void sincronizar(slug), 30_000);
    return () => {
      window.removeEventListener("online", enLinea);
      window.removeEventListener("offline", sinLinea);
      quitar();
      clearInterval(t);
    };
  }, [slug]);

  const ingresar = useCallback(
    async (s: Sesion) => {
      setSesion(s);
      aplicarTema(s.campania);
      await guardarKV("sesion", s);
      await recargarCatalogos();
    },
    [recargarCatalogos],
  );

  const salir = useCallback(async () => {
    if (slug && (await pendientes(slug)).length > 0) {
      if (!confirm("Tenés visitas sin enviar. Si salís ahora se pueden perder. ¿Salir igual?")) return;
    }
    try {
      await api.post("/auth/logout");
    } catch {
      /* sin conexión: igual limpiamos */
    }
    await borrarTodoLocal();
    setSesion(null);
    setCatalogos(null);
  }, [slug]);

  const misBarrios =
    catalogos && sesion ? (sesion.usuario.rol === "comando" ? catalogos.barrios : catalogos.barrios.filter((b) => sesion.usuario.barrioIds.includes(b.id))) : [];

  const valor: Estado = {
    sesion,
    catalogos,
    cargando,
    online,
    pendientes: nPend,
    ingresar,
    salir,
    recargarCatalogos,
    sincronizarAhora: async () => {
      if (slug) await sincronizar(slug);
    },
    misBarrios,
    nombreBarrio: (id) => catalogos?.barrios.find((b) => b.id === id)?.nombre ?? "—",
    nombreTema: (id) => catalogos?.temas.find((t) => t.id === id)?.nombre ?? "—",
  };
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
