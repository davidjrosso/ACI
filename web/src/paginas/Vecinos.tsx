import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { APOYO_LABEL, type Apoyo, type Vecino } from "@territorio/shared";
import { api, qs } from "../api";
import { useEstado } from "../estado";
import { ChipApoyo, Error, useCarga } from "../componentes/ui";
import { hace, num } from "../util";

const POR_PAGINA = 50;

export function Vecinos() {
  const { sesion, misBarrios, nombreBarrio } = useEstado();
  const [q, setQ] = useState("");
  const [qDiferida, setQDiferida] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [apoyo, setApoyo] = useState<Apoyo | "">("");
  const [etiqueta, setEtiqueta] = useState("");
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setQDiferida(q);
      setPagina(0);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const filtros = { q: qDiferida, barrioId, apoyo, etiqueta };
  const { datos, error, cargando } = useCarga(
    () => api.get<{ items: Vecino[]; total: number }>(`/vecinos${qs({ ...filtros, limite: POR_PAGINA, desde: pagina * POR_PAGINA })}`),
    [qDiferida, barrioId, apoyo, etiqueta, pagina],
  );
  const etiquetas = useCarga(() => api.get<string[]>("/vecinos/etiquetas"), []);
  const esComando = sesion!.usuario.rol === "comando";

  return (
    <>
      <div className="titulo-pagina">
        <h1>Vecinos</h1>
        <div className="fila">
          {esComando && (
            <a className="boton" href={`/api/vecinos/exportar.csv${qs(filtros)}`} title="Exporta los vecinos filtrados (queda registrado en auditoría)">
              Exportar CSV
            </a>
          )}
          <Link to="/vecinos/nuevo" className="boton primario">
            + Nuevo
          </Link>
        </div>
      </div>

      <div className="tarjeta" style={{ marginBottom: "1rem" }}>
        <div className="campo">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, dirección o teléfono" />
        </div>
        <div className="campos-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <select value={barrioId} onChange={(e) => (setBarrioId(e.target.value), setPagina(0))} aria-label="Barrio">
            <option value="">Todos los barrios</option>
            {misBarrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <select value={apoyo} onChange={(e) => (setApoyo(e.target.value as Apoyo | ""), setPagina(0))} aria-label="Apoyo">
            <option value="">Cualquier apoyo</option>
            {(Object.keys(APOYO_LABEL) as Apoyo[]).map((a) => (
              <option key={a} value={a}>
                {APOYO_LABEL[a]}
              </option>
            ))}
          </select>
          <select value={etiqueta} onChange={(e) => (setEtiqueta(e.target.value), setPagina(0))} aria-label="Etiqueta">
            <option value="">Cualquier etiqueta</option>
            {(etiquetas.datos ?? []).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Error msg={error} />
      <div className="tarjeta">
        <div className="muted chico" style={{ marginBottom: ".4rem" }}>
          {cargando ? "Buscando…" : `${num(datos?.total ?? 0)} vecinos`}
        </div>
        {datos && datos.items.length === 0 && !cargando ? (
          <div className="vacio">No hay vecinos con esos filtros.</div>
        ) : (
          <ul className="lista">
            {datos?.items.map((v) => (
              <li key={v.id}>
                <Link to={`/vecinos/${v.id}`} className="item">
                  <span className="principal">
                    <strong>
                      {v.nombre} {v.apellido}
                    </strong>
                    <span>
                      {nombreBarrio(v.barrioId)} · {v.direccion ?? "sin dirección"} · {hace(v.ultimaInteraccion)}
                    </span>
                  </span>
                  <ChipApoyo apoyo={v.apoyo} />
                </Link>
              </li>
            ))}
          </ul>
        )}
        {datos && datos.total > POR_PAGINA && (
          <div className="fila-entre" style={{ marginTop: ".75rem" }}>
            <button disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
              ← Anteriores
            </button>
            <span className="muted chico">
              Página {pagina + 1} de {Math.ceil(datos.total / POR_PAGINA)}
            </span>
            <button disabled={(pagina + 1) * POR_PAGINA >= datos.total} onClick={() => setPagina((p) => p + 1)}>
              Siguientes →
            </button>
          </div>
        )}
      </div>
    </>
  );
}
