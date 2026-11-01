import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { APOYO_LABEL, completarPlantilla, RESULTADO_LABEL, telefonoWhatsApp, type Apoyo, type Interaccion, type Vecino, type VecinoInput } from "@territorio/shared";
import { api, ApiError, mensajeError } from "../api";
import { useEstado } from "../estado";
import { encolar } from "../offline";
import { ChipApoyo, Error, useToast } from "../componentes/ui";
import { fecha, fechaHora, uuid } from "../util";

const CANAL = { puerta: "Puerta a puerta", whatsapp: "WhatsApp", telefono: "Teléfono", evento: "Evento" } as const;

export function VecinoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { sesion, catalogos, misBarrios, nombreBarrio, nombreTema } = useEstado();
  const nuevo = !id;

  const [form, setForm] = useState<VecinoInput>({
    nombre: "",
    apellido: "",
    telefono: "",
    email: "",
    direccion: "",
    barrioId: misBarrios[0]?.id ?? "",
    apoyo: "sin_dato",
    etiquetas: [],
    notas: "",
    consentimiento: false,
  });
  const [vecino, setVecino] = useState<Vecino | null>(null);
  const [historial, setHistorial] = useState<Interaccion[]>([]);
  const [etiquetaNueva, setEtiquetaNueva] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [plantillaId, setPlantillaId] = useState(catalogos?.plantillas[0]?.id ?? "");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [v, h] = await Promise.all([api.get<Vecino>(`/vecinos/${id}`), api.get<Interaccion[]>(`/vecinos/${id}/historial`)]);
        setVecino(v);
        setHistorial(h);
        setForm({ ...v, apellido: v.apellido ?? "", telefono: v.telefono ?? "", email: v.email ?? "", direccion: v.direccion ?? "", notas: v.notas ?? "" });
      } catch (e) {
        setError(mensajeError(e));
      }
    })();
  }, [id]);

  const set = <K extends keyof VecinoInput>(k: K, v: VecinoInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const v = nuevo ? await api.post<Vecino>("/vecinos", form) : await api.put<Vecino>(`/vecinos/${id}`, form);
      toast("Vecino guardado");
      if (nuevo) nav(`/vecinos/${v.id}`, { replace: true });
      else setVecino(v);
    } catch (e) {
      setError(e instanceof ApiError && e.codigo === "duplicado" ? "Ya hay un vecino con ese teléfono. Buscalo en la lista para no duplicarlo." : mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function darDeBaja() {
    if (!confirm("Se borran los datos personales de este vecino (queda solo el registro estadístico). ¿Continuar?")) return;
    try {
      await api.del(`/vecinos/${id}`);
      toast("Datos del vecino eliminados");
      nav("/vecinos");
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  function agregarEtiqueta() {
    const t = etiquetaNueva.trim();
    if (t && !form.etiquetas.includes(t)) set("etiquetas", [...form.etiquetas, t]);
    setEtiquetaNueva("");
  }

  if (!catalogos) return null;
  const plantilla = catalogos.plantillas.find((p) => p.id === plantillaId);
  const wa = telefonoWhatsApp(form.telefono);
  const mensaje = plantilla
    ? completarPlantilla(plantilla.texto, { nombre: form.nombre, barrio: nombreBarrio(form.barrioId), candidato: sesion!.campania.candidato })
    : "";

  /** WhatsApp asistido: abre el chat en el teléfono del voluntario y registra el contacto. Nunca envía automáticamente. */
  async function abrirWhatsApp() {
    if (!vecino || !wa) return;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener");
    await encolar(sesion!.campania.slug, {
      id: uuid(),
      vecinoId: vecino.id,
      barrioId: vecino.barrioId,
      canal: "whatsapp",
      resultado: "atendio",
      direccion: null,
      nota: plantilla ? `Plantilla: ${plantilla.titulo}` : null,
      fecha: new Date().toISOString(),
    });
    toast("Contacto por WhatsApp registrado");
  }

  const puedeBorrar = !nuevo && sesion!.usuario.rol !== "voluntario";

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>{nuevo ? "Nuevo vecino" : `${vecino?.nombre ?? ""} ${vecino?.apellido ?? ""}`}</h1>
          {vecino && (
            <div className="fila" style={{ marginTop: ".3rem" }}>
              <ChipApoyo apoyo={vecino.apoyo} />
              <span className="muted chico">Alta {fecha(vecino.creadoEn)}</span>
            </div>
          )}
        </div>
        <button onClick={() => nav(-1)}>← Volver</button>
      </div>
      <Error msg={error} />

      <div className="grilla-2">
        {!nuevo && vecino && (
          <div className="grilla">
            <section className="tarjeta">
              <h2>Escribir por WhatsApp</h2>
              <p className="muted chico">Se abre WhatsApp en tu teléfono con el mensaje listo. Vos lo revisás y lo enviás. La plataforma nunca manda mensajes automáticos.</p>
              {!vecino.consentimiento ? (
                <div className="aviso">Este vecino no dio consentimiento para ser contactado.</div>
              ) : !wa ? (
                <div className="aviso">Falta un teléfono válido.</div>
              ) : (
                <>
                  <div className="campo">
                    <label htmlFor="pl">Mensaje</label>
                    <select id="pl" value={plantillaId} onChange={(e) => setPlantillaId(e.target.value)}>
                      {catalogos.plantillas.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.titulo}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="tarjeta chico" style={{ boxShadow: "none", background: "var(--superficie-2)" }}>
                    {mensaje}
                  </p>
                  <button className="whatsapp bloque" onClick={() => void abrirWhatsApp()}>
                    Abrir WhatsApp
                  </button>
                </>
              )}
            </section>

            <section className="tarjeta">
              <h2>Historial de contactos</h2>
              {historial.length === 0 ? (
                <p className="muted">Sin contactos registrados.</p>
              ) : (
                <ul className="lista">
                  {historial.map((h) => (
                    <li key={h.id} style={{ padding: ".55rem 0" }}>
                      <div className="fila-entre">
                        <strong className="chico">
                          {CANAL[h.canal]} · {RESULTADO_LABEL[h.resultado]}
                        </strong>
                        <span className="muted chico">{fechaHora(h.fecha)}</span>
                      </div>
                      <div className="muted chico">
                        {h.usuarioNombre}
                        {h.apoyo ? ` · ${APOYO_LABEL[h.apoyo]}` : ""}
                        {h.temaId ? ` · ${nombreTema(h.temaId)}` : ""}
                      </div>
                      {h.nota && <div className="chico">{h.nota}</div>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
        <form className="tarjeta" onSubmit={guardar}>
          <div className="campos-2">
            <div className="campo">
              <label htmlFor="n">Nombre</label>
              <input id="n" value={form.nombre} onChange={(e) => set("nombre", e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="a">Apellido</label>
              <input id="a" value={form.apellido ?? ""} onChange={(e) => set("apellido", e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="t">Teléfono</label>
              <input id="t" type="tel" inputMode="tel" value={form.telefono ?? ""} onChange={(e) => set("telefono", e.target.value)} placeholder="3571 15 123456" />
            </div>
            <div className="campo">
              <label htmlFor="em">Email</label>
              <input id="em" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="d">Dirección</label>
              <input id="d" value={form.direccion ?? ""} onChange={(e) => set("direccion", e.target.value)} />
            </div>
            <div className="campo">
              <label htmlFor="b">Barrio</label>
              <select id="b" value={form.barrioId} onChange={(e) => set("barrioId", e.target.value)} required>
                {misBarrios.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="campo">
            <label>Apoyo</label>
            <div className="segmentado vertical-movil">
              {(Object.keys(APOYO_LABEL) as Apoyo[]).map((a) => (
                <button type="button" key={a} className={form.apoyo === a ? "sel" : ""} onClick={() => set("apoyo", a)} aria-pressed={form.apoyo === a}>
                  <span className={`punto p-${a}`} aria-hidden /> {APOYO_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <div className="campo">
            <label htmlFor="et">Etiquetas</label>
            <div className="fila" style={{ marginBottom: form.etiquetas.length ? ".4rem" : 0 }}>
              {form.etiquetas.map((t) => (
                <button type="button" key={t} className="chip" style={{ minHeight: 30 }} onClick={() => set("etiquetas", form.etiquetas.filter((x) => x !== t))} aria-label={`Quitar etiqueta ${t}`}>
                  {t} ✕
                </button>
              ))}
            </div>
            <div className="fila" style={{ flexWrap: "nowrap" }}>
              <input
                id="et"
                value={etiquetaNueva}
                onChange={(e) => setEtiquetaNueva(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    agregarEtiqueta();
                  }
                }}
                placeholder="fiscal, comerciante, quiere colaborar…"
              />
              <button type="button" onClick={agregarEtiqueta}>
                Agregar
              </button>
            </div>
          </div>

          <div className="campo">
            <label htmlFor="no">Notas</label>
            <textarea id="no" value={form.notas ?? ""} onChange={(e) => set("notas", e.target.value)} />
          </div>

          <div className="campo">
            <label className="check">
              <input type="checkbox" checked={form.consentimiento} onChange={(e) => set("consentimiento", e.target.checked)} />
              <span>
                Aceptó que la campaña guarde sus datos y lo contacte (Ley 25.326)
                {vecino?.consentimientoFecha && <span className="muted chico"> · desde {fecha(vecino.consentimientoFecha)}</span>}
              </span>
            </label>
          </div>

          <div className="fila-entre">
            {puedeBorrar ? (
              <button type="button" className="peligro" onClick={() => void darDeBaja()}>
                Borrar datos
              </button>
            ) : (
              <span />
            )}
            <button className="primario" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>

      </div>
    </>
  );
}
