import { Link } from "react-router-dom";
import { APOYO_LABEL, type Tablero as TTablero } from "@territorio/shared";
import { api } from "../api";
import { useEstado } from "../estado";
import { Error, LeyendaApoyo, useCarga, useTooltip } from "../componentes/ui";
import { num, pct } from "../util";

export function Tablero() {
  const { sesion } = useEstado();
  const { datos: t, error, cargando } = useCarga(() => api.get<TTablero>("/tablero"), []);
  const tip = useTooltip();

  if (cargando && !t) return <div className="cargando">Cargando tablero…</div>;
  if (error || !t) return <Error msg={error ?? "Sin datos"} />;

  const conDato = t.apoyo.apoya + t.apoyo.indeciso + t.apoyo.no_apoya;
  const maxSemana = Math.max(1, ...t.porSemana.map((s) => s.interacciones));
  const maxTema = Math.max(1, ...t.reclamosPorTema.map((r) => r.cantidad));
  const rol = sesion!.usuario.rol;

  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Tablero</h1>
          <div className="muted chico">{rol === "comando" ? "Toda la ciudad" : "Tus barrios asignados"}</div>
        </div>
        <Link to="/timbreo" className="boton primario">
          Cargar visita
        </Link>
      </div>

      <div className="kpis">
        {t.diasParaEleccion !== null && t.diasParaEleccion >= 0 && (
          <div className="kpi destacado">
            <div className="valor">{t.diasParaEleccion}</div>
            <div className="etiqueta">días para la elección</div>
          </div>
        )}
        <div className="kpi">
          <div className="valor">{num(t.totales.vecinos)}</div>
          <div className="etiqueta">vecinos en la base</div>
        </div>
        <div className="kpi">
          <div className="valor">{num(t.totales.interacciones7d)}</div>
          <div className="etiqueta">contactos últimos 7 días</div>
        </div>
        <div className="kpi">
          <div className="valor">{num(t.totales.voluntariosActivos7d)}</div>
          <div className="etiqueta">personas activas (7 días)</div>
        </div>
        <div className="kpi">
          <div className="valor">{num(t.totales.reclamosAbiertos)}</div>
          <div className="etiqueta">reclamos abiertos</div>
        </div>
      </div>

      <div className="grilla-2">
        <section className="tarjeta">
          <h2>Apoyo por barrio</h2>
          <p className="muted chico">
            Con dato: {pct(t.apoyo.apoya, conDato)}% apoya · {pct(t.apoyo.indeciso, conDato)}% indeciso · {pct(t.apoyo.no_apoya, conDato)}% no apoya
          </p>
          <LeyendaApoyo />
          <div className="filas-barrio">
            {t.porBarrio.map((b) => {
              const segs = [
                ["apoya", b.apoya],
                ["indeciso", b.indeciso],
                ["no_apoya", b.noApoya],
                ["sin_dato", b.sinDato],
              ] as const;
              return (
                <div
                  className="fila-barrio"
                  key={b.barrioId}
                  {...tip.props(
                    <>
                      <strong>{b.nombre}</strong>
                      {segs.map(([k, v]) => (
                        <div key={k}>
                          {APOYO_LABEL[k]}: {v} ({pct(v, b.vecinos)}%)
                        </div>
                      ))}
                      {b.objetivo ? <div>Objetivo: {b.vecinos} de {b.objetivo} contactos</div> : null}
                    </>,
                  )}
                >
                  <span>{b.nombre}</span>
                  <div className="barra-apilada" role="img" aria-label={`${b.nombre}: ${b.apoya} apoyan, ${b.indeciso} indecisos, ${b.noApoya} no apoyan`}>
                    {segs.map(([k, v]) => (v > 0 ? <div key={k} className={`p-${k}`} style={{ flexGrow: v }} /> : null))}
                    {b.vecinos === 0 && <div style={{ flexGrow: 1, background: "transparent" }} />}
                  </div>
                  <span className="n">
                    {b.vecinos}
                    {b.objetivo ? <span className="chico"> / {b.objetivo}</span> : null}
                  </span>
                </div>
              );
            })}
          </div>
          <details style={{ marginTop: ".75rem" }}>
            <summary>Ver como tabla</summary>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th className="num">Vecinos</th>
                  <th className="num">Apoya</th>
                  <th className="num">Indeciso</th>
                  <th className="num">No apoya</th>
                  <th className="num">Contactos 7d</th>
                </tr>
              </thead>
              <tbody>
                {t.porBarrio.map((b) => (
                  <tr key={b.barrioId}>
                    <td>{b.nombre}</td>
                    <td className="num">{b.vecinos}</td>
                    <td className="num">{b.apoya}</td>
                    <td className="num">{b.indeciso}</td>
                    <td className="num">{b.noApoya}</td>
                    <td className="num">{b.interacciones7d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </section>

        <div className="grilla">
          <section className="tarjeta">
            <h2>Contactos por semana</h2>
            <p className="muted chico">Visitas, WhatsApp y llamadas registradas · últimas 8 semanas</p>
            <div className="columnas">
              {t.porSemana.map((s) => (
                <div className="columna" key={s.semana} {...tip.props(<><strong>Semana del {s.semana.split("-").reverse().slice(0, 2).join("/")}</strong>{num(s.interacciones)} contactos</>)}>
                  <span className="v">{s.interacciones}</span>
                  <div className="b" style={{ height: `${(s.interacciones / maxSemana) * 100}%` }} />
                </div>
              ))}
            </div>
            <div className="ejes-x">
              {t.porSemana.map((s) => (
                <span key={s.semana}>{s.semana.split("-").reverse().slice(0, 2).join("/")}</span>
              ))}
            </div>
          </section>

          <section className="tarjeta">
            <h2>Reclamos por tema</h2>
            {t.reclamosPorTema.length === 0 ? (
              <p className="muted">Todavía no hay reclamos cargados.</p>
            ) : (
              <div className="barras-h">
                {t.reclamosPorTema.map((r) => (
                  <div className="barra-h" key={r.temaId} {...tip.props(<><strong>{r.nombre}</strong>{r.cantidad} reclamos y propuestas</>)}>
                    <span>{r.nombre}</span>
                    <div className="pista">
                      <div className="relleno" style={{ width: `${(r.cantidad / maxTema) * 100}%` }} />
                    </div>
                    <span className="n">{r.cantidad}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {rol !== "voluntario" && (
            <section className="tarjeta">
              <h2>Más activos esta semana</h2>
              {t.rankingVoluntarios.length === 0 ? (
                <p className="muted">Sin actividad en los últimos 7 días.</p>
              ) : (
                <ol className="lista">
                  {t.rankingVoluntarios.slice(0, 5).map((v, i) => (
                    <li key={v.usuarioId} className="fila-entre" style={{ padding: ".45rem 0" }}>
                      <span>
                        {i + 1}. {v.nombre}
                      </span>
                      <span className="num muted">{v.interacciones} contactos</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </div>
      </div>
      {tip.nodo}
    </>
  );
}
