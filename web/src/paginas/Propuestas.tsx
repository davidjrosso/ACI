import { useState } from "react";
import type { Propuesta, PropuestaInput } from "@aci/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { Error, Modal, useCarga, useToast } from "../componentes/ui";

export function Propuestas() {
  const { catalogos, urlSitio } = useEstado();
  const toast = useToast();
  const { datos, error, recargar } = useCarga(() => api.get<Propuesta[]>("/propuestas"), []);
  const [editando, setEditando] = useState<Propuesta | "nueva" | null>(null);
  if (!catalogos) return null;

  const grupos = [...catalogos.temas.map((t) => ({ id: t.id, nombre: t.nombre })), { id: null as string | null, nombre: "Sin tema" }]
    .map((g) => ({ ...g, ps: (datos ?? []).filter((p) => (p.temaId ?? null) === g.id) }))
    .filter((g) => g.ps.length);

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Propuestas</h1>
          <div className="muted chico">
            Se muestran en <a href={`${urlSitio}propuestas`} target="_blank" rel="noopener">el sitio</a> agrupadas por tema.
          </div>
        </div>
        <button className="primario" onClick={() => setEditando("nueva")}>
          + Propuesta
        </button>
      </div>
      <Error msg={error} />
      {datos?.length === 0 && <div className="tarjeta vacio">Todavía no hay propuestas cargadas.</div>}
      {grupos.map((g) => (
        <section className="tarjeta" key={g.id ?? "sin"}>
          <h2>{g.nombre}</h2>
          <ul className="lista">
            {g.ps.map((p) => (
              <li key={p.id} className="item" style={{ alignItems: "flex-start", opacity: p.publicada ? 1 : 0.6 }}>
                <span className="principal">
                  <strong>{p.titulo}</strong>
                  <span>{p.descripcion.length > 160 ? p.descripcion.slice(0, 160) + "…" : p.descripcion}</span>
                </span>
                <span className="fila">
                  {!p.publicada && <span className="chip">Oculta</span>}
                  <button className="chico-btn" onClick={() => setEditando(p)}>
                    Editar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {editando && (
        <FormPropuesta
          inicial={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(m) => {
            setEditando(null);
            recargar();
            toast(m);
          }}
        />
      )}
    </>
  );
}

function FormPropuesta({ inicial, onCerrar, onGuardado }: { inicial: Propuesta | null; onCerrar: () => void; onGuardado: (m: string) => void }) {
  const { catalogos } = useEstado();
  const [f, setF] = useState<PropuestaInput>(inicial ?? { titulo: "", descripcion: "", temaId: catalogos!.temas[0]?.id ?? null, orden: 0, publicada: true });
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PropuestaInput>(k: K, v: PropuestaInput[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (inicial) await api.put(`/propuestas/${inicial.id}`, f);
      else await api.post("/propuestas", f);
      onGuardado("Propuesta guardada");
    } catch (err) {
      setError(mensajeError(err));
    }
  }
  async function borrar() {
    if (!inicial || !confirm("¿Borrar esta propuesta?")) return;
    await api.del(`/propuestas/${inicial.id}`);
    onGuardado("Propuesta borrada");
  }

  return (
    <Modal titulo={inicial ? "Editar propuesta" : "Nueva propuesta"} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Error msg={error} />
        <div className="campo">
          <label htmlFor="pt">Título</label>
          <input id="pt" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} required minLength={4} placeholder="Ej: Dispensarios abiertos hasta las 22 h" />
        </div>
        <div className="campo">
          <label htmlFor="pd">Descripción</label>
          <textarea id="pd" rows={5} value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} required minLength={10} />
          <div className="ayuda">Admite el mismo formato que las noticias (negrita, listas).</div>
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="ptema">Tema</label>
            <select id="ptema" value={f.temaId ?? ""} onChange={(e) => set("temaId", e.target.value || null)}>
              <option value="">— Sin tema —</option>
              {catalogos!.temas.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="po">Orden dentro del tema</label>
            <input id="po" type="number" value={f.orden} onChange={(e) => set("orden", Number(e.target.value) || 0)} />
          </div>
        </div>
        <label className="check" style={{ marginBottom: "1rem" }}>
          <input type="checkbox" checked={f.publicada} onChange={(e) => set("publicada", e.target.checked)} />
          Visible en el sitio
        </label>
        <div className="fila-entre">
          {inicial ? (
            <button type="button" className="peligro" onClick={() => void borrar()}>
              Borrar
            </button>
          ) : (
            <span />
          )}
          <button className="primario">Guardar</button>
        </div>
      </form>
    </Modal>
  );
}
