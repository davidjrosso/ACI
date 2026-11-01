import { useState } from "react";
import type { EstadoReclamo, Reclamo, ReclamoInput } from "@territorio/shared";
import { api, mensajeError, qs } from "../api";
import { useEstado } from "../estado";
import { Error, Modal, useCarga, useToast } from "../componentes/ui";
import { fecha } from "../util";

const ESTADO_LABEL: Record<EstadoReclamo, string> = { nuevo: "Nuevo", en_curso: "En curso", resuelto: "Resuelto" };

export function Reclamos() {
  const { sesion, catalogos, misBarrios, nombreBarrio, nombreTema } = useEstado();
  const toast = useToast();
  const [estado, setEstado] = useState<EstadoReclamo | "">("");
  const [temaId, setTemaId] = useState("");
  const [barrioId, setBarrioId] = useState("");
  const [tipo, setTipo] = useState("");
  const [editando, setEditando] = useState<Reclamo | "nuevo" | null>(null);
  const { datos, error, recargar, setDatos } = useCarga(() => api.get<Reclamo[]>(`/reclamos${qs({ estado, temaId, barrioId, tipo })}`), [estado, temaId, barrioId, tipo]);
  const puedeCambiarEstado = sesion!.usuario.rol !== "voluntario";

  async function cambiarEstado(r: Reclamo, e: EstadoReclamo) {
    try {
      const nuevo = await api.patch<Reclamo>(`/reclamos/${r.id}/estado`, { estado: e });
      setDatos((ds) => ds?.map((x) => (x.id === r.id ? nuevo : x)) ?? null);
      toast(`Marcado como ${ESTADO_LABEL[e].toLowerCase()}`);
    } catch (err) {
      toast(mensajeError(err));
    }
  }

  if (!catalogos) return null;
  return (
    <>
      <div className="titulo-pagina">
        <h1>Reclamos y propuestas</h1>
        <button className="primario" onClick={() => setEditando("nuevo")}>
          + Cargar
        </button>
      </div>

      <div className="tarjeta" style={{ marginBottom: "1rem" }}>
        <div className="campos-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoReclamo | "")} aria-label="Estado">
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
            <option value="">Reclamos y propuestas</option>
            <option value="reclamo">Solo reclamos</option>
            <option value="propuesta">Solo propuestas</option>
          </select>
          <select value={temaId} onChange={(e) => setTemaId(e.target.value)} aria-label="Tema">
            <option value="">Todos los temas</option>
            {catalogos.temas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} aria-label="Barrio">
            <option value="">Todos los barrios</option>
            {misBarrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Error msg={error} />
      <div className="tarjeta">
        <div className="muted chico">{datos?.length ?? 0} resultados</div>
        {datos?.length === 0 ? (
          <div className="vacio">No hay reclamos con esos filtros.</div>
        ) : (
          <ul className="lista">
            {datos?.map((r) => (
              <li key={r.id} style={{ padding: ".75rem 0" }}>
                <div className="fila-entre">
                  <div className="fila">
                    <span className="chip">{r.tipo === "reclamo" ? "Reclamo" : "Propuesta"}</span>
                    <strong>{nombreTema(r.temaId)}</strong>
                  </div>
                  <span className="muted chico">
                    {nombreBarrio(r.barrioId)} · {fecha(r.creadoEn)}
                  </span>
                </div>
                <p style={{ margin: ".35rem 0" }}>{r.descripcion}</p>
                {r.direccion && <div className="muted chico">{r.direccion}</div>}
                <div className="fila" style={{ marginTop: ".4rem" }}>
                  {puedeCambiarEstado ? (
                    (Object.keys(ESTADO_LABEL) as EstadoReclamo[]).map((e) => (
                      <button key={e} className={`chico-btn ${r.estado === e ? "primario" : ""}`} onClick={() => r.estado !== e && void cambiarEstado(r, e)} aria-pressed={r.estado === e}>
                        {ESTADO_LABEL[e]}
                      </button>
                    ))
                  ) : (
                    <span className="chip">{ESTADO_LABEL[r.estado]}</span>
                  )}
                  {(puedeCambiarEstado || r.creadoPor === sesion!.usuario.id) && (
                    <button className="chico-btn" onClick={() => setEditando(r)}>
                      Editar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editando && (
        <FormReclamo
          inicial={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            recargar();
            toast("Guardado");
          }}
        />
      )}
    </>
  );
}

function FormReclamo({ inicial, onCerrar, onGuardado }: { inicial: Reclamo | null; onCerrar: () => void; onGuardado: () => void }) {
  const { catalogos, misBarrios } = useEstado();
  const [f, setF] = useState<ReclamoInput>(
    inicial ?? { tipo: "reclamo", temaId: catalogos!.temas[0]?.id ?? "", barrioId: misBarrios[0]?.id ?? "", descripcion: "", direccion: "", estado: "nuevo" },
  );
  const [error, setError] = useState<string | null>(null);
  const [ubicar, setUbicar] = useState(!inicial);
  const set = <K extends keyof ReclamoInput>(k: K, v: ReclamoInput[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    let datos = f;
    if (ubicar && "geolocation" in navigator) {
      const pos = await new Promise<GeolocationPosition | null>((ok) => navigator.geolocation.getCurrentPosition(ok, () => ok(null), { timeout: 5000 }));
      if (pos) datos = { ...f, lat: pos.coords.latitude, lng: pos.coords.longitude };
    }
    try {
      if (inicial) await api.put(`/reclamos/${inicial.id}`, datos);
      else await api.post("/reclamos", datos);
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <Modal titulo={inicial ? "Editar" : "Nuevo reclamo o propuesta"} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Error msg={error} />
        <div className="campo">
          <div className="segmentado">
            {(["reclamo", "propuesta"] as const).map((t) => (
              <button type="button" key={t} className={f.tipo === t ? "sel" : ""} onClick={() => set("tipo", t)}>
                {t === "reclamo" ? "Reclamo" : "Propuesta"}
              </button>
            ))}
          </div>
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="rt">Tema</label>
            <select id="rt" value={f.temaId} onChange={(e) => set("temaId", e.target.value)} required>
              {catalogos!.temas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="rb">Barrio</label>
            <select id="rb" value={f.barrioId} onChange={(e) => set("barrioId", e.target.value)} required>
              {misBarrios.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="rd">Descripción</label>
          <textarea id="rd" value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} required minLength={5} />
        </div>
        <div className="campo">
          <label htmlFor="rdir">Dirección o referencia</label>
          <input id="rdir" value={f.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} />
        </div>
        <label className="check" style={{ marginBottom: "1rem" }}>
          <input type="checkbox" checked={ubicar} onChange={(e) => setUbicar(e.target.checked)} />
          Usar mi ubicación actual para el mapa
        </label>
        <button className="primario bloque">Guardar</button>
      </form>
    </Modal>
  );
}
