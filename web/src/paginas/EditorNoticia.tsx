import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { formatoATexto, type Noticia, type NoticiaInput } from "@aci/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { SelectorImagen, urlImg } from "../componentes/SelectorImagen";
import { Error, useToast } from "../componentes/ui";
import { aInputLocal, deInputLocal, fecha } from "../util";

const VACIA: NoticiaInput = { titulo: "", bajada: "", cuerpo: "", imagenId: null, temaId: null, barrioId: null, estado: "borrador", destacada: false, fecha: null };

export function EditorNoticia() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { sesion, catalogos, urlSitio } = useEstado();
  const [f, setF] = useState<NoticiaInput>(VACIA);
  const [nota, setNota] = useState<Noticia | null>(null);
  const [vista, setVista] = useState<"editar" | "previa">("editar");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [programar, setProgramar] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<Noticia>(`/noticias/${id}`)
      .then((n) => {
        setNota(n);
        setF({ ...n, bajada: n.bajada ?? "" });
        setProgramar(Boolean(n.fecha && new Date(n.fecha).getTime() > Date.now()));
      })
      .catch((e) => setError(mensajeError(e)));
  }, [id]);

  const set = <K extends keyof NoticiaInput>(k: K, v: NoticiaInput[K]) => setF((x) => ({ ...x, [k]: v }));

  /** Inserta formato alrededor de la selección del textarea. */
  function formato(antes: string, despues = "", linea = false) {
    const t = area.current;
    if (!t) return;
    const { selectionStart: a, selectionEnd: b, value } = t;
    const sel = value.slice(a, b) || (linea ? "" : "texto");
    const inicio = linea ? value.lastIndexOf("\n", a - 1) + 1 : a;
    const nuevo = linea ? value.slice(0, inicio) + antes + value.slice(inicio) : value.slice(0, a) + antes + sel + despues + value.slice(b);
    set("cuerpo", nuevo);
    requestAnimationFrame(() => {
      t.focus();
      const pos = linea ? b + antes.length : a + antes.length + sel.length + despues.length;
      t.setSelectionRange(pos, pos);
    });
  }

  async function guardar(estado: NoticiaInput["estado"]) {
    setGuardando(true);
    setError(null);
    try {
      // Sin programar: si la fecha quedó en el futuro, se publica ahora
      const futura = f.fecha && new Date(f.fecha).getTime() > Date.now();
      const datos = { ...f, estado, fecha: programar ? f.fecha : futura ? new Date().toISOString() : estado === "publicada" && nota?.estado !== "publicada" ? null : f.fecha };
      const n = nota ? await api.put<Noticia>(`/noticias/${nota.id}`, datos) : await api.post<Noticia>("/noticias", datos);
      setNota(n);
      setF({ ...n, bajada: n.bajada ?? "" });
      toast(estado === "publicada" ? (nota?.estado === "publicada" ? "Cambios publicados" : "¡Noticia publicada!") : "Borrador guardado");
      if (!nota) nav(`/noticias/${n.id}`, { replace: true });
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!nota || !confirm("¿Borrar esta noticia? No se puede deshacer.")) return;
    await api.del(`/noticias/${nota.id}`);
    toast("Noticia borrada");
    nav("/noticias");
  }

  if (!catalogos) return null;
  const publicada = nota?.estado === "publicada";
  const linkPublico = nota ? `${urlSitio}noticias/${nota.slug}` : null;
  const largoTitulo = f.titulo.length;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>{nota ? "Editar noticia" : "Nueva noticia"}</h1>
          {nota && (
            <div className="muted chico">
              {publicada ? `Publicada · ${fecha(nota.fecha)}` : "Borrador"} {publicada && linkPublico && <a href={linkPublico} target="_blank" rel="noopener">· Ver en el sitio ↗</a>}
            </div>
          )}
        </div>
        <button onClick={() => nav("/noticias")}>← Noticias</button>
      </div>
      <Error msg={error} />

      <div className="editor">
        <section className="tarjeta">
          <div className="campo">
            <label htmlFor="nt">Título</label>
            <input id="nt" value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ej: Presentamos el plan de bacheo barrio por barrio" maxLength={140} />
            <div className="ayuda">{largoTitulo > 90 ? "Un título más corto se lee mejor en WhatsApp. " : ""}{largoTitulo}/140</div>
          </div>
          <div className="campo">
            <label htmlFor="nb">Bajada</label>
            <textarea id="nb" rows={2} style={{ minHeight: 64 }} value={f.bajada ?? ""} onChange={(e) => set("bajada", e.target.value)} placeholder="Una o dos oraciones que resumen la nota. Es lo que se ve al compartir." maxLength={300} />
          </div>

          <div className="tabs" role="tablist" style={{ marginBottom: ".6rem" }}>
            <button role="tab" aria-selected={vista === "editar"} className={vista === "editar" ? "sel" : ""} onClick={() => setVista("editar")}>
              Escribir
            </button>
            <button role="tab" aria-selected={vista === "previa"} className={vista === "previa" ? "sel" : ""} onClick={() => setVista("previa")}>
              Vista previa
            </button>
          </div>
          {vista === "editar" ? (
            <>
              <div className="barra-formato" role="toolbar" aria-label="Formato">
                <button type="button" onClick={() => formato("**", "**")} title="Negrita">
                  <strong>N</strong>
                </button>
                <button type="button" onClick={() => formato("*", "*")} title="Cursiva">
                  <em>C</em>
                </button>
                <button type="button" onClick={() => formato("## ", "", true)} title="Subtítulo">
                  Subtítulo
                </button>
                <button type="button" onClick={() => formato("- ", "", true)} title="Lista">
                  • Lista
                </button>
                <button type="button" onClick={() => formato("> ", "", true)} title="Cita">
                  “ Cita
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const u = prompt("Dirección del enlace (https://…)");
                    if (u && /^https?:\/\//.test(u)) formato("[", `](${u})`);
                  }}
                  title="Enlace"
                >
                  Enlace
                </button>
              </div>
              <textarea ref={area} className="cuerpo-nota" value={f.cuerpo} onChange={(e) => set("cuerpo", e.target.value)} placeholder={"Escribí la nota acá.\n\nDejá una línea en blanco entre párrafos."} />
              <div className="ayuda">**negrita** · *cursiva* · ## subtítulo · - lista · &gt; cita · [texto](https://link)</div>
            </>
          ) : (
            <div className="previa">
              {f.imagenId && <img src={urlImg(sesion!.campania.slug, f.imagenId, "g")} alt="" />}
              <h1>{f.titulo || "Sin título"}</h1>
              {f.bajada && <p className="muted" style={{ fontSize: "1.1rem" }}>{f.bajada}</p>}
              <div className="texto-previa" dangerouslySetInnerHTML={{ __html: formatoATexto(f.cuerpo) }} />
            </div>
          )}
        </section>

        <aside className="grilla">
          <section className="tarjeta">
            <div className="grilla" style={{ gap: ".5rem" }}>
              <button className="primario bloque" disabled={guardando || f.titulo.trim().length < 4} onClick={() => void guardar("publicada")}>
                {publicada ? "Guardar y publicar cambios" : programar ? "Programar publicación" : "Publicar"}
              </button>
              <button className="bloque" disabled={guardando || f.titulo.trim().length < 4} onClick={() => void guardar("borrador")}>
                {publicada ? "Pasar a borrador (ocultar)" : "Guardar borrador"}
              </button>
            </div>
            <label className="check" style={{ marginTop: ".9rem" }}>
              <input type="checkbox" checked={f.destacada} onChange={(e) => set("destacada", e.target.checked)} />
              <span>
                Destacada en el inicio
                <span className="ayuda" style={{ display: "block" }}>
                  Solo una noticia puede estar destacada.
                </span>
              </span>
            </label>
            <label className="check" style={{ marginTop: ".6rem" }}>
              <input
                type="checkbox"
                checked={programar}
                onChange={(e) => {
                  setProgramar(e.target.checked);
                  if (e.target.checked && !f.fecha) set("fecha", new Date(Date.now() + 86_400_000).toISOString());
                }}
              />
              Programar fecha y hora
            </label>
            {programar && (
              <input type="datetime-local" style={{ marginTop: ".5rem" }} value={aInputLocal(f.fecha)} onChange={(e) => e.target.value && set("fecha", deInputLocal(e.target.value))} aria-label="Fecha de publicación" />
            )}
            {nota && (
              <button className="peligro bloque" style={{ marginTop: "1rem" }} onClick={() => void borrar()}>
                Borrar noticia
              </button>
            )}
          </section>

          <section className="tarjeta">
            <SelectorImagen valor={f.imagenId} onCambio={(v) => set("imagenId", v)} etiqueta="Imagen principal" />
            <div className="campo">
              <label htmlFor="ntema">Tema</label>
              <select id="ntema" value={f.temaId ?? ""} onChange={(e) => set("temaId", e.target.value || null)}>
                <option value="">— Sin tema —</option>
                {catalogos.temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="campo">
              <label htmlFor="nbarrio">Barrio (opcional)</label>
              <select id="nbarrio" value={f.barrioId ?? ""} onChange={(e) => set("barrioId", e.target.value || null)}>
                <option value="">— Toda la ciudad —</option>
                {catalogos.barrios.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nombre}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {publicada && linkPublico && (
            <section className="tarjeta">
              <h3>Compartir</h3>
              <div className="grilla" style={{ gap: ".5rem" }}>
                <a className="boton whatsapp" href={`https://wa.me/?text=${encodeURIComponent(`${f.titulo} ${location.origin}${linkPublico}`)}`} target="_blank" rel="noopener">
                  Compartir por WhatsApp
                </a>
                <button onClick={() => void navigator.clipboard?.writeText(`${location.origin}${linkPublico}`).then(() => toast("Link copiado"))}>Copiar link</button>
              </div>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
