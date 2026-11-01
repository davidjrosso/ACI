import { useMemo, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";
import type { Interaccion, Reclamo, Tablero } from "@territorio/shared";
import { api } from "../api";
import { useEstado } from "../estado";
import { Error, useCarga } from "../componentes/ui";
import { pct } from "../util";

type Capa = "apoyo" | "cobertura" | "reclamos" | "visitas";

const RAMPA = ["--seq-1", "--seq-2", "--seq-3", "--seq-4", "--seq-5"];
const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

/** Ajusta la vista a los barrios la primera vez. */
function Encuadre({ limites }: { limites: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (limites?.isValid()) map.fitBounds(limites, { padding: [16, 16] });
  }, [map, limites]);
  return null;
}

export default function Mapa() {
  const { catalogos, misBarrios, nombreTema } = useEstado();
  const [capa, setCapa] = useState<Capa>("apoyo");
  const [temaId, setTemaId] = useState("");
  const tablero = useCarga(() => api.get<Tablero>("/tablero"), []);
  const reclamos = useCarga(() => (capa === "reclamos" ? api.get<Reclamo[]>("/reclamos") : Promise.resolve([] as Reclamo[])), [capa]);
  const visitas = useCarga(
    () => (capa === "visitas" ? api.get<Interaccion[]>(`/interacciones?limite=1000&desde=${new Date(Date.now() - 7 * 86_400_000).toISOString()}`) : Promise.resolve([] as Interaccion[])),
    [capa],
  );

  const conGeo = misBarrios.filter((b) => b.geometria);
  const limites = useMemo(() => {
    if (!conGeo.length) return null;
    const b = L.latLngBounds([]);
    for (const x of conGeo) for (const [lng, lat] of x.geometria!.coordinates[0]!) b.extend([lat, lng]);
    return b;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conGeo.length]);

  if (!catalogos) return null;
  const cfg = catalogos.config;
  const stats = new Map(tablero.datos?.porBarrio.map((b) => [b.barrioId, b]));

  // Valor 0..1 por barrio según la capa elegida → paso de la rampa secuencial
  const valor = (barrioId: string): number | null => {
    const s = stats.get(barrioId);
    if (!s) return null;
    if (capa === "apoyo") {
      const con = s.apoya + s.indeciso + s.noApoya;
      return con ? s.apoya / con : null;
    }
    if (capa === "cobertura") return s.objetivo ? Math.min(1, s.vecinos / s.objetivo) : null;
    return null;
  };
  const colorDe = (v: number | null) => (v === null ? css("--sin-dato") : css(RAMPA[Math.min(4, Math.floor(v * 5))]!));
  const choropleth = capa === "apoyo" || capa === "cobertura";

  const reclamosVisibles = (reclamos.datos ?? []).filter((r) => r.lat && r.lng && r.estado !== "resuelto" && (!temaId || r.temaId === temaId));
  const visitasVisibles = (visitas.datos ?? []).filter((v) => v.lat && v.lng);

  return (
    <>
      <div className="titulo-pagina">
        <h1>Mapa</h1>
        <div className="segmentado" role="tablist" aria-label="Capa del mapa" style={{ minWidth: "min(100%, 520px)" }}>
          {(
            [
              ["apoyo", "Apoyo"],
              ["cobertura", "Cobertura"],
              ["reclamos", "Reclamos"],
              ["visitas", "Visitas 7d"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} role="tab" aria-selected={capa === k} className={capa === k ? "sel" : ""} onClick={() => setCapa(k)}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <Error msg={tablero.error} />

      {conGeo.length === 0 ? (
        <div className="tarjeta vacio">
          Los barrios todavía no tienen límites dibujados. El comando puede importarlos desde <strong>Configuración → Barrios</strong> con un archivo GeoJSON.
        </div>
      ) : (
        <>
          <div className="fila-entre" style={{ marginBottom: ".6rem" }}>
            {choropleth ? (
              <div className="leyenda" style={{ margin: 0 }}>
                <span>{capa === "apoyo" ? "% que apoya (sobre vecinos con dato):" : "% del objetivo de contactos:"}</span>
                {RAMPA.map((v, i) => (
                  <span key={v}>
                    <span className="punto" style={{ background: `var(${v})`, borderRadius: 3 }} />
                    {i * 20}–{i * 20 + 20}%
                  </span>
                ))}
                <span>
                  <span className="punto p-sin_dato" style={{ borderRadius: 3 }} />
                  Sin dato
                </span>
              </div>
            ) : capa === "reclamos" ? (
              <div className="fila">
                <span className="muted chico">{reclamosVisibles.length} reclamos abiertos</span>
                <select value={temaId} onChange={(e) => setTemaId(e.target.value)} style={{ width: "auto" }} aria-label="Filtrar por tema">
                  <option value="">Todos los temas</option>
                  {catalogos.temas.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="muted chico">{visitasVisibles.length} contactos en los últimos 7 días</span>
            )}
          </div>

          <div className="mapa">
            <MapContainer center={cfg.mapaCentro ?? [-32.17, -64.11]} zoom={cfg.mapaZoom ?? 14} style={{ height: "100%" }} zoomSnap={0.25} attributionControl={cfg.mapaConTiles}>
              {cfg.mapaConTiles && <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" opacity={0.55} />}
              <Encuadre limites={limites} />
              {conGeo.map((b) => {
                const v = valor(b.id);
                const s = stats.get(b.id);
                return (
                  <GeoJSON
                    key={`${b.id}-${capa}-${tablero.datos ? 1 : 0}`}
                    data={{ type: "Feature", properties: {}, geometry: b.geometria! } as any}
                    style={{
                      color: css("--superficie"),
                      weight: 2,
                      fillColor: choropleth ? colorDe(v) : css("--superficie"),
                      fillOpacity: choropleth ? 0.85 : 0.5,
                    }}
                  >
                    <Tooltip permanent direction="center" className="etiqueta-barrio">
                      {b.nombre}
                    </Tooltip>
                    {s && (
                      <Popup>
                        <strong>{b.nombre}</strong>
                        <br />
                        {s.vecinos} vecinos{s.objetivo ? ` (objetivo ${s.objetivo})` : ""}
                        <br />
                        Apoya {s.apoya} · Indeciso {s.indeciso} · No apoya {s.noApoya}
                        <br />
                        {choropleth && v !== null && (
                          <>
                            {capa === "apoyo" ? "Apoyo" : "Cobertura"}: {Math.round(v * 100)}%
                            <br />
                          </>
                        )}
                        Contactos 7d: {s.interacciones7d} · Reclamos abiertos: {s.reclamosAbiertos}
                      </Popup>
                    )}
                  </GeoJSON>
                );
              })}
              {capa === "reclamos" &&
                reclamosVisibles.map((r) => (
                  <CircleMarker key={r.id} center={[r.lat!, r.lng!]} radius={6} pathOptions={{ color: css("--superficie"), weight: 2, fillColor: css("--no-apoya"), fillOpacity: 0.9 }}>
                    <Tooltip>
                      <strong>{nombreTema(r.temaId)}</strong>
                      <br />
                      {r.descripcion}
                      <br />
                      <em>{r.estado === "nuevo" ? "Nuevo" : "En curso"}</em>
                    </Tooltip>
                  </CircleMarker>
                ))}
              {capa === "visitas" &&
                visitasVisibles.map((v) => (
                  <CircleMarker key={v.id} center={[v.lat!, v.lng!]} radius={4} pathOptions={{ color: css("--superficie"), weight: 1, fillColor: css("--primario"), fillOpacity: 0.85 }}>
                    <Tooltip>
                      {v.vecinoNombre || v.direccion || "Visita"} · {v.resultado === "atendio" ? "Atendió" : v.resultado === "no_estaba" ? "No estaba" : "No quiso"}
                      <br />
                      {v.usuarioNombre}
                    </Tooltip>
                  </CircleMarker>
                ))}
            </MapContainer>
          </div>
          {choropleth && tablero.datos && (
            <p className="muted chico" style={{ marginTop: ".5rem" }}>
              {capa === "apoyo"
                ? "Tocá un barrio para ver el detalle."
                : `Cobertura total: ${pct(
                    tablero.datos.porBarrio.reduce((a, b) => a + b.vecinos, 0),
                    tablero.datos.porBarrio.reduce((a, b) => a + (b.objetivo ?? 0), 0),
                  )}% del objetivo.`}
            </p>
          )}
        </>
      )}
    </>
  );
}
