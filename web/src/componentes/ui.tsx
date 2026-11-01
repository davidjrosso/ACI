import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { APOYO_LABEL, type Apoyo } from "@territorio/shared";

// ---------- Toast ----------
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ProveedorToast({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<number>();
  const mostrar = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      {msg && (
        <div className="toast" role="status" aria-live="polite">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  );
}

// ---------- Modal ----------
export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onCerrar]);
  return (
    <div className="modal-fondo" onClick={onCerrar}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <div className="fila-entre" style={{ marginBottom: ".75rem" }}>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <button className="chico-btn" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Apoyo ----------
export function ChipApoyo({ apoyo }: { apoyo: Apoyo }) {
  return (
    <span className="chip">
      <span className={`punto p-${apoyo}`} aria-hidden />
      {APOYO_LABEL[apoyo]}
    </span>
  );
}

export function LeyendaApoyo() {
  return (
    <div className="leyenda">
      {(["apoya", "indeciso", "no_apoya", "sin_dato"] as Apoyo[]).map((a) => (
        <span key={a}>
          <span className={`punto p-${a}`} aria-hidden />
          {APOYO_LABEL[a]}
        </span>
      ))}
    </div>
  );
}

// ---------- Tooltip que sigue al mouse (gráficos) ----------
export function useTooltip() {
  const [tip, setTip] = useState<{ x: number; y: number; contenido: ReactNode } | null>(null);
  const props = (contenido: ReactNode) => ({
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, contenido }),
    onMouseLeave: () => setTip(null),
  });
  const nodo = tip ? (
    <div className="tooltip" style={{ left: Math.min(tip.x + 14, window.innerWidth - 270), top: tip.y + 14 }}>
      {tip.contenido}
    </div>
  ) : null;
  return { props, nodo };
}

export function Campo({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: ReactNode }) {
  return (
    <div className="campo">
      <label>
        {etiqueta}
        <div style={{ marginTop: ".25rem", fontWeight: 400 }}>{children}</div>
      </label>
      {ayuda && <div className="ayuda">{ayuda}</div>}
    </div>
  );
}

export function Error({ msg }: { msg: string | null }) {
  return msg ? (
    <div className="error" role="alert">
      {msg}
    </div>
  ) : null;
}

/** Hook genérico para cargar datos con estado de carga/error. */
export function useCarga<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fn()
      .then((d) => vivo && (setDatos(d), setError(null)))
      .catch((e) => vivo && setError(e?.message ?? "Error al cargar"))
      .finally(() => vivo && setCargando(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { datos, error, cargando, recargar: () => setN((x) => x + 1), setDatos };
}
