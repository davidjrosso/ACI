import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AYUDA_LABEL, AYUDAS, telefonoWhatsApp, type Adhesion, type Ayuda } from "@aci/shared";
import { api, mensajeError, qs } from "../api";
import { useEstado } from "../estado";
import { Error, useCarga, useToast } from "../componentes/ui";
import { fecha, hace } from "../util";

/** Personas que se sumaron desde el formulario del sitio. */
export function Sumados() {
  const { sesion, catalogos, misBarrios, nombreBarrio, puede } = useEstado();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const pendientes = params.get("pendientes") === "si";
  const [barrioId, setBarrioId] = useState("");
  const [ayuda, setAyuda] = useState<Ayuda | "">("");
  const [q, setQ] = useState("");
  const [qDif, setQDif] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDif(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filtros = { barrioId, ayuda, q: qDif, pendientes: pendientes ? "si" : undefined };
  const { datos, error, setDatos } = useCarga(() => api.get<Adhesion[]>(`/adhesiones${qs(filtros)}`), [barrioId, ayuda, qDif, pendientes]);

  async function marcar(a: Adhesion, contactado: boolean) {
    try {
      const n = await api.patch<Adhesion>(`/adhesiones/${a.id}`, { contactado });
      setDatos((ds) => ds?.map((x) => (x.id === a.id ? n : x)) ?? null);
    } catch (e) {
      toast(mensajeError(e));
    }
  }
  async function borrar(a: Adhesion) {
    if (!confirm(`¿Borrar los datos de ${a.nombre}? Se usa cuando la persona pide la baja.`)) return;
    try {
      await api.del(`/adhesiones/${a.id}`);
      setDatos((ds) => ds?.filter((x) => x.id !== a.id) ?? null);
      toast("Datos eliminados");
    } catch (e) {
      toast(mensajeError(e));
    }
  }

  const saludo = (a: Adhesion) =>
    `Hola ${a.nombre}, soy ${sesion!.usuario.nombre.split(" ")[0]} de la campaña de ${sesion!.campania.candidato}. ¡Gracias por sumarte desde la web! ¿Te puedo contar cómo podés ayudar?`;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Sumados</h1>
          <div className="muted chico">Personas que completaron “Sumate” en el sitio</div>
        </div>
        {puede("comando") && (
          <a className="boton" href={`/api/adhesiones/exportar.csv${qs(filtros)}`} title="Queda registrado en auditoría">
            Exportar CSV
          </a>
        )}
      </div>

      <div className="tarjeta" style={{ marginBottom: "1rem" }}>
        <div className="campos-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre o teléfono" aria-label="Buscar" />
          <select value={barrioId} onChange={(e) => setBarrioId(e.target.value)} aria-label="Barrio">
            <option value="">Todos los barrios</option>
            {misBarrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <select value={ayuda} onChange={(e) => setAyuda(e.target.value as Ayuda | "")} aria-label="Cómo quiere ayudar">
            <option value="">Cualquier forma de ayudar</option>
            {AYUDAS.map((a) => (
              <option key={a} value={a}>
                {AYUDA_LABEL[a]}
              </option>
            ))}
          </select>
          <label className="check" style={{ alignSelf: "center", margin: 0 }}>
            <input type="checkbox" checked={pendientes} onChange={(e) => setParams(e.target.checked ? { pendientes: "si" } : {})} />
            Solo sin contactar
          </label>
        </div>
      </div>

      <Error msg={error} />
      <div className="tarjeta">
        <div className="muted chico">{datos?.length ?? 0} personas</div>
        {datos?.length === 0 && <div className="vacio">No hay personas con esos filtros.</div>}
        <ul className="lista">
          {datos?.map((a) => {
            const wa = telefonoWhatsApp(a.telefono);
            return (
              <li key={a.id} style={{ padding: ".75rem 0" }}>
                <div className="fila-entre">
                  <div>
                    <strong>
                      {a.nombre} {a.apellido}
                    </strong>{" "}
                    {!a.contactado && <span className="chip chip-aviso">Sin contactar</span>}
                    <div className="muted chico">
                      {a.barrioId ? nombreBarrio(a.barrioId) : "Sin barrio"} · {a.telefono} {a.email ? `· ${a.email}` : ""} · se sumó {hace(a.creadoEn)}
                    </div>
                  </div>
                  <div className="fila">
                    {wa && (
                      <a
                        className="boton chico-btn whatsapp"
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(saludo(a))}`}
                        target="_blank"
                        rel="noopener"
                        onClick={() => !a.contactado && void marcar(a, true)}
                        title="Abre WhatsApp en tu teléfono con un mensaje listo para enviar"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button className="chico-btn" onClick={() => void marcar(a, !a.contactado)}>
                      {a.contactado ? "Marcar sin contactar" : "Marcar contactado"}
                    </button>
                    <button className="chico-btn peligro" onClick={() => void borrar(a)} aria-label={`Borrar datos de ${a.nombre}`}>
                      Borrar
                    </button>
                  </div>
                </div>
                {a.ayudas.length > 0 && (
                  <div className="fila" style={{ marginTop: ".35rem" }}>
                    {a.ayudas.map((x) => (
                      <span key={x} className="chip">
                        {AYUDA_LABEL[x]}
                      </span>
                    ))}
                  </div>
                )}
                {a.mensaje && <p className="chico" style={{ margin: ".35rem 0 0" }}>“{a.mensaje}”</p>}
                <div className="ayuda">Consentimiento: {fecha(a.consentimientoFecha)}</div>
              </li>
            );
          })}
        </ul>
      </div>
      {catalogos && <p className="muted chico" style={{ marginTop: ".75rem" }}>El botón de WhatsApp abre el chat en tu teléfono con el mensaje listo; nunca se envía nada automáticamente.</p>}
    </>
  );
}
