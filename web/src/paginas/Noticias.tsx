import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { EstadoNoticia, Noticia } from "@aci/shared";
import { api, qs } from "../api";
import { useEstado } from "../estado";
import { Error, useCarga } from "../componentes/ui";
import { urlImg } from "../componentes/SelectorImagen";
import { fecha, hace } from "../util";

export function Noticias() {
  const { sesion, nombreTema, urlSitio } = useEstado();
  const [params, setParams] = useSearchParams();
  const estado = (params.get("estado") as EstadoNoticia | null) ?? "";
  const [q, setQ] = useState("");
  const { datos, error, cargando } = useCarga(() => api.get<Noticia[]>(`/noticias${qs({ estado, q })}`), [estado, q]);
  const ahora = Date.now();

  return (
    <>
      <div className="titulo-pagina">
        <h1>Noticias</h1>
        <Link to="/noticias/nueva" className="boton primario">
          + Nueva noticia
        </Link>
      </div>
      <div className="tarjeta" style={{ marginBottom: "1rem" }}>
        <div className="campos-2">
          <input type="search" placeholder="Buscar por título" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          <div className="segmentado">
            {(
              [
                ["", "Todas"],
                ["borrador", "Borradores"],
                ["publicada", "Publicadas"],
              ] as const
            ).map(([k, t]) => (
              <button key={k} className={estado === k ? "sel" : ""} onClick={() => setParams(k ? { estado: k } : {})}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Error msg={error} />
      <div className="tarjeta">
        {!cargando && datos?.length === 0 && (
          <div className="vacio">
            No hay noticias. <Link to="/noticias/nueva">Escribí la primera</Link>.
          </div>
        )}
        <ul className="lista">
          {datos?.map((n) => {
            const programada = n.estado === "publicada" && n.fecha && new Date(n.fecha).getTime() > ahora;
            return (
              <li key={n.id}>
                <Link to={`/noticias/${n.id}`} className="item">
                  <span className="miniatura" style={n.imagenId ? { backgroundImage: `url(${urlImg(sesion!.campania.slug, n.imagenId)})` } : undefined} aria-hidden />
                  <span className="principal">
                    <strong>{n.titulo}</strong>
                    <span>
                      {n.temaId ? `${nombreTema(n.temaId)} · ` : ""}
                      {n.estado === "publicada" ? `Publicada ${fecha(n.fecha)}` : `Editada ${hace(n.actualizadaEn)}`}
                      {n.autorNombre ? ` · ${n.autorNombre}` : ""}
                    </span>
                  </span>
                  <span className="fila" style={{ justifyContent: "flex-end" }}>
                    {n.destacada && <span className="chip">★ Destacada</span>}
                    <span className={`chip ${n.estado === "publicada" && !programada ? "chip-ok" : ""}`}>{programada ? "Programada" : n.estado === "publicada" ? "Publicada" : "Borrador"}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="muted chico" style={{ marginTop: ".75rem" }}>
        Las noticias publicadas aparecen en <a href={`${urlSitio}noticias`} target="_blank" rel="noopener">el sitio</a> y tienen botón para compartir por WhatsApp.
      </p>
    </>
  );
}
