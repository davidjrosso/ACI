import { Link } from "react-router-dom";
import { AYUDA_LABEL, type Actividad, type ResumenSitio } from "@aci/shared";
import { api, qs } from "../api";
import { useEstado } from "../estado";
import { Error, useCarga, useTooltip } from "../componentes/ui";
import { dia, hora, num } from "../util";

export function Inicio() {
  const { sesion, puede, urlSitio, nombreBarrio } = useEstado();
  const { datos: r, error } = useCarga(() => api.get<ResumenSitio>("/sitio/resumen"), []);
  const agenda = useCarga(() => api.get<Actividad[]>(`/actividades${qs({ desde: new Date().toISOString(), hasta: new Date(Date.now() + 14 * 86_400_000).toISOString() })}`), []);
  const tip = useTooltip();

  if (error) return <Error msg={error} />;
  if (!r) return <div className="cargando">Cargando…</div>;
  const sitio = puede("comando", "comunicacion");
  const verSumados = puede("comando", "referente");
  const maxSem = Math.max(1, ...r.porSemana.map((s) => s.cantidad));
  const maxAy = Math.max(1, ...r.porAyuda.map((a) => a.cantidad));

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Hola, {sesion!.usuario.nombre.split(" ")[0]}</h1>
          <div className="muted chico">{sesion!.campania.nombre}</div>
        </div>
        {sitio && (
          <Link to="/noticias/nueva" className="boton primario">
            + Nueva noticia
          </Link>
        )}
      </div>

      {sitio && !r.publicado && (
        <div className="aviso fila-entre">
          <span>
            El sitio todavía <strong>no está publicado</strong>: solo lo ve el equipo.
          </span>
          <Link to="/sitio" className="boton chico-btn">
            Revisar y publicar
          </Link>
        </div>
      )}

      <div className="kpis">
        {r.diasParaEleccion !== null && r.diasParaEleccion >= 0 && (
          <div className="kpi destacado">
            <div className="valor">{r.diasParaEleccion}</div>
            <div className="etiqueta">días para la elección</div>
          </div>
        )}
        {verSumados && (
          <>
            <div className="kpi">
              <div className="valor">{num(r.adhesiones)}</div>
              <div className="etiqueta">personas sumadas</div>
            </div>
            <div className="kpi">
              <div className="valor">{num(r.adhesiones7d)}</div>
              <div className="etiqueta">nuevas esta semana</div>
            </div>
            <Link to="/sumados?pendientes=si" className="kpi" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="valor">{num(r.sinContactar)}</div>
              <div className="etiqueta">sin contactar →</div>
            </Link>
          </>
        )}
        {sitio && (
          <>
            <div className="kpi">
              <div className="valor">{num(r.noticiasPublicadas)}</div>
              <div className="etiqueta">noticias publicadas</div>
            </div>
            <Link to="/noticias?estado=borrador" className="kpi" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="valor">{num(r.borradores)}</div>
              <div className="etiqueta">borradores →</div>
            </Link>
          </>
        )}
      </div>

      <div className="grilla-2">
        {verSumados && (
          <section className="tarjeta">
            <h2>Personas sumadas por semana</h2>
            <p className="muted chico">Formulario “Sumate” del sitio · últimas 8 semanas</p>
            <div className="columnas">
              {r.porSemana.map((s) => (
                <div className="columna" key={s.semana} {...tip.props(<><strong>Semana del {s.semana.split("-").reverse().slice(0, 2).join("/")}</strong>{s.cantidad} personas</>)}>
                  <span className="v">{s.cantidad}</span>
                  <div className="b" style={{ height: `${(s.cantidad / maxSem) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="ejes-x">
              {r.porSemana.map((s) => (
                <span key={s.semana}>{s.semana.split("-").reverse().slice(0, 2).join("/")}</span>
              ))}
            </div>

            <h3 style={{ marginTop: "1.4rem" }}>Cómo quieren ayudar</h3>
            <div className="barras-h">
              {[...r.porAyuda]
                .sort((a, b) => b.cantidad - a.cantidad)
                .map((a) => (
                  <div className="barra-h" key={a.ayuda} {...tip.props(<><strong>{AYUDA_LABEL[a.ayuda]}</strong>{a.cantidad} personas</>)}>
                    <span>{AYUDA_LABEL[a.ayuda]}</span>
                    <div className="pista">
                      <div className="relleno" style={{ width: `${(a.cantidad / maxAy) * 100}%` }} />
                    </div>
                    <span className="n">{a.cantidad}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        <div className="grilla">
          <section className="tarjeta">
            <div className="fila-entre">
              <h2 style={{ margin: 0 }}>Próximos 14 días</h2>
              <Link to="/agenda" className="chico">
                Agenda →
              </Link>
            </div>
            {agenda.datos?.length === 0 && <p className="muted">No hay actividades cargadas.</p>}
            <ul className="lista">
              {agenda.datos?.slice(0, 6).map((a) => (
                <li key={a.id} className="item" style={{ alignItems: "flex-start" }}>
                  <span className="principal">
                    <strong>{a.titulo}</strong>
                    <span style={{ textTransform: "none" }}>
                      {dia(a.inicio)} · {hora(a.inicio)} h{a.barrioId ? ` · ${nombreBarrio(a.barrioId)}` : ""}
                    </span>
                  </span>
                  {a.publica && <span className="chip">En el sitio</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="tarjeta">
            <h2>El sitio de la campaña</h2>
            <p className="muted chico">Compartilo en redes y por WhatsApp. Cada noticia tiene su propio link con vista previa.</p>
            <code className="url-sitio">{r.url}</code>
            <div className="fila" style={{ marginTop: ".6rem" }}>
              <a className="boton" href={urlSitio} target="_blank" rel="noopener">
                Abrir sitio ↗
              </a>
              <button onClick={() => void navigator.clipboard?.writeText(r.url)}>Copiar link</button>
            </div>
          </section>
        </div>
      </div>
      {tip.nodo}
    </>
  );
}
