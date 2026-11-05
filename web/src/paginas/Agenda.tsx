import { useState } from "react";
import { TIPO_ACTIVIDAD_LABEL as TIPO_LABEL, TIPOS_ACTIVIDAD, type Actividad, type ActividadInput } from "@aci/shared";
import { api, mensajeError, qs } from "../api";
import { useEstado } from "../estado";
import { Error, Modal, useCarga, useToast } from "../componentes/ui";
import { aInputLocal, deInputLocal, dia, hora } from "../util";

export function Agenda() {
  const { sesion, catalogos, nombreBarrio } = useEstado();
  const toast = useToast();
  const [pasadas, setPasadas] = useState(false);
  const [editando, setEditando] = useState<Actividad | "nueva" | null>(null);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const desde = pasadas ? new Date(hoy.getTime() - 30 * 86_400_000) : hoy;
  const hasta = pasadas ? hoy : new Date(hoy.getTime() + 60 * 86_400_000);
  const { datos, error, recargar } = useCarga(() => api.get<Actividad[]>(`/actividades${qs({ desde: desde.toISOString(), hasta: hasta.toISOString() })}`), [pasadas]);
  const puedeEditar = sesion!.usuario.rol !== "voluntario";

  const lista = pasadas ? [...(datos ?? [])].reverse() : datos ?? [];
  const porDia = new Map<string, Actividad[]>();
  for (const a of lista) {
    const k = new Date(a.inicio).toDateString();
    porDia.set(k, [...(porDia.get(k) ?? []), a]);
  }
  const responsable = (id?: string | null) => catalogos?.equipo.find((u) => u.id === id)?.nombre;

  return (
    <>
      <div className="titulo-pagina">
        <h1>Agenda</h1>
        <div className="fila">
          <button onClick={() => setPasadas((p) => !p)}>{pasadas ? "Ver próximas" : "Ver pasadas"}</button>
          {puedeEditar && (
            <button className="primario" onClick={() => setEditando("nueva")}>
              + Actividad
            </button>
          )}
        </div>
      </div>
      <Error msg={error} />

      {porDia.size === 0 && <div className="tarjeta vacio">{pasadas ? "No hubo actividades en los últimos 30 días." : "No hay actividades programadas."}</div>}
      {[...porDia.entries()].map(([k, acts]) => (
        <section key={k} className="tarjeta">
          <h2 style={{ textTransform: "capitalize" }}>
            {dia(acts[0]!.inicio)}
            {new Date(k).getTime() === hoy.getTime() && <span className="chip" style={{ marginLeft: ".5rem" }}>Hoy</span>}
          </h2>
          <ul className="lista">
            {acts.map((a) => (
              <li key={a.id} className="item" style={{ alignItems: "flex-start" }}>
                <span className="num" style={{ minWidth: "3.2em", fontWeight: 700 }}>
                  {hora(a.inicio)}
                </span>
                <span className="principal">
                  <strong>{a.titulo}</strong>
                  <span>
                    {TIPO_LABEL[a.tipo]}
                    {a.lugar ? ` · ${a.lugar}` : ""}
                    {a.barrioId ? ` · ${nombreBarrio(a.barrioId)}` : ""}
                    {responsable(a.responsableId) ? ` · Responsable: ${responsable(a.responsableId)}` : ""}
                  </span>
                  {a.notas && <span style={{ display: "block" }}>{a.notas}</span>}
                </span>
                <span className="fila" style={{ justifyContent: "flex-end" }}>
                  {a.publica && <span className="chip chip-ok">En el sitio</span>}
                  {a.conCandidato && <span className="chip">Con {sesion!.campania.candidato.split(" ")[0]}</span>}
                  {puedeEditar && (
                    <button className="chico-btn" onClick={() => setEditando(a)}>
                      Editar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editando && (
        <FormActividad
          inicial={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={(msg) => {
            setEditando(null);
            recargar();
            toast(msg);
          }}
        />
      )}
    </>
  );
}

function FormActividad({ inicial, onCerrar, onGuardado }: { inicial: Actividad | null; onCerrar: () => void; onGuardado: (msg: string) => void }) {
  const { sesion, catalogos, misBarrios } = useEstado();
  const esReferente = sesion!.usuario.rol === "referente";
  const [f, setF] = useState<ActividadInput>(
    inicial ?? {
      titulo: "",
      tipo: "timbreo",
      inicio: new Date(Date.now() + 86_400_000).toISOString(),
      fin: null,
      lugar: "",
      barrioId: esReferente ? misBarrios[0]?.id ?? null : null,
      responsableId: sesion!.usuario.id,
      conCandidato: false,
      publica: false,
      descripcionPublica: "",
      notas: "",
    },
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ActividadInput>(k: K, v: ActividadInput[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (inicial) await api.put(`/actividades/${inicial.id}`, f);
      else await api.post("/actividades", f);
      onGuardado("Actividad guardada");
    } catch (err) {
      setError(mensajeError(err));
    }
  }
  async function borrar() {
    if (!inicial || !confirm("¿Borrar esta actividad?")) return;
    try {
      await api.del(`/actividades/${inicial.id}`);
      onGuardado("Actividad borrada");
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <Modal titulo={inicial ? "Editar actividad" : "Nueva actividad"} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Error msg={error} />
        <div className="campo">
          <label htmlFor="at">Título</label>
          <input id="at" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} required />
        </div>
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="ati">Tipo</label>
            <select id="ati" value={f.tipo} onChange={(e) => set("tipo", e.target.value as ActividadInput["tipo"])}>
              {TIPOS_ACTIVIDAD.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ain">Fecha y hora</label>
            <input id="ain" type="datetime-local" value={aInputLocal(f.inicio)} onChange={(e) => e.target.value && set("inicio", deInputLocal(e.target.value))} required />
          </div>
          <div className="campo">
            <label htmlFor="ab">Barrio</label>
            <select id="ab" value={f.barrioId ?? ""} onChange={(e) => set("barrioId", e.target.value || null)} required={esReferente}>
              {!esReferente && <option value="">Toda la ciudad</option>}
              {misBarrios.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="ar">Responsable</label>
            <select id="ar" value={f.responsableId ?? ""} onChange={(e) => set("responsableId", e.target.value || null)}>
              <option value="">—</option>
              {catalogos!.equipo.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="campo">
          <label htmlFor="al">Lugar</label>
          <input id="al" value={f.lugar ?? ""} onChange={(e) => set("lugar", e.target.value)} />
        </div>
        <label className="check" style={{ marginBottom: ".6rem" }}>
          <input type="checkbox" checked={f.publica} onChange={(e) => set("publica", e.target.checked)} />
          <span>
            Mostrar en la agenda del sitio
            <span className="ayuda" style={{ display: "block" }}>Los vecinos ven título, fecha, lugar y la descripción pública. Las notas internas nunca se publican.</span>
          </span>
        </label>
        {f.publica && (
          <div className="campo">
            <label htmlFor="adp">Descripción pública</label>
            <input id="adp" value={f.descripcionPublica ?? ""} onChange={(e) => set("descripcionPublica", e.target.value)} maxLength={600} placeholder="Ej: Recorremos el barrio con la comisión vecinal. ¡Te esperamos!" />
          </div>
        )}
        <div className="campo">
          <label htmlFor="an">Notas internas</label>
          <textarea id="an" value={f.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
        </div>
        <label className="check" style={{ marginBottom: "1rem" }}>
          <input type="checkbox" checked={f.conCandidato} onChange={(e) => set("conCandidato", e.target.checked)} />
          Participa {sesion!.campania.candidato}
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
