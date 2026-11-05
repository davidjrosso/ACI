import { useState } from "react";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { SeccionBarrios, SeccionEquipo, SeccionIdentidad, SeccionTemas } from "../componentes/SeccionesConfig";
import { SeccionSitio } from "../componentes/SeccionSitio";
import { Error } from "../componentes/ui";

/** Asistente de configuración inicial: 6 pasos y la campaña queda lista, con su sitio. */
export function Asistente() {
  const { catalogos, recargarCatalogos, salir, urlSitio } = useEstado();
  const [paso, setPaso] = useState(0);
  const [publicar, setPublicar] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const c = catalogos!;

  const PASOS = [
    { t: "Tu campaña", d: "Nombre, candidato/a, cargo, ciudad y colores. Se puede cambiar después." },
    { t: "Barrios", d: "Cargá los barrios de la ciudad. Los vecinos los eligen al sumarse y el equipo se organiza por barrio." },
    { t: "Temas", d: "¿De qué se va a hablar en la campaña? Ordenan noticias y propuestas." },
    { t: "El sitio", d: "Foto, frase principal y biografía. Es lo primero que ven los vecinos." },
    { t: "Equipo", d: "Sumá a quien maneja la comunicación y a los referentes de cada barrio. También podés hacerlo más adelante." },
    { t: "¡Listo!", d: "" },
  ];
  const ultimo = PASOS.length - 1;
  const puedeSeguir = paso === 1 ? c.barrios.length > 0 : paso === 2 ? c.temas.length > 0 : true;

  async function finalizar() {
    try {
      if (publicar) await api.put("/sitio/config", { publicado: true });
      await api.put("/config", { configuracionCompleta: true });
      await recargarCatalogos();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <div style={{ minHeight: "100dvh", background: "var(--fondo)" }}>
      <header className="encabezado">
        <div className="marca">
          Configurar campaña
          <small>{c.config.nombre}</small>
        </div>
        <div className="espacio" />
        <button className="chico-btn" onClick={() => void salir()}>
          Salir
        </button>
      </header>
      <main className="contenido" style={{ maxWidth: 780, paddingBottom: "3rem" }}>
        <div className="pasos" aria-label={`Paso ${paso + 1} de ${PASOS.length}`}>
          {PASOS.map((_, i) => (
            <div key={i} className={i <= paso ? "hecho" : ""} />
          ))}
        </div>
        <h1>
          {paso + 1}. {PASOS[paso]!.t}
        </h1>
        {PASOS[paso]!.d && <p className="muted">{PASOS[paso]!.d}</p>}
        <Error msg={error} />

        <div className="tarjeta">
          {paso === 0 && <SeccionIdentidad textoBoton="Guardar y seguir →" onListo={() => setPaso(1)} />}
          {paso === 1 && <SeccionBarrios />}
          {paso === 2 && <SeccionTemas />}
          {paso === 3 && <SeccionSitio compacto textoBoton="Guardar y seguir →" onListo={() => setPaso(4)} />}
          {paso === 4 && <SeccionEquipo />}
          {paso === ultimo && (
            <div>
              <p>
                <strong>{c.config.candidato}</strong> en {c.config.ciudad}: {c.barrios.length} barrios, {c.temas.length} temas y {c.equipo.length}{" "}
                {c.equipo.length === 1 ? "persona" : "personas"} en el equipo.
              </p>
              <p className="muted">
                Próximo paso: escribí la primera noticia y compartí el link del sitio. Podés revisar cómo queda en la{" "}
                <a href={urlSitio} target="_blank" rel="noopener">
                  vista previa
                </a>
                .
              </p>
              <label className="check" style={{ marginBottom: "1rem" }}>
                <input type="checkbox" checked={publicar} onChange={(e) => setPublicar(e.target.checked)} />
                Publicar el sitio ahora (si no, queda oculto hasta que lo publiques)
              </label>
              <button className="primario" onClick={() => void finalizar()}>
                Empezar a usar la plataforma
              </button>
            </div>
          )}
        </div>

        {paso > 0 && (
          <div className="fila-entre" style={{ marginTop: "1rem" }}>
            <button onClick={() => setPaso((p) => p - 1)}>← Atrás</button>
            {paso < ultimo && paso !== 3 && (
              <button className="primario" disabled={!puedeSeguir} onClick={() => setPaso((p) => p + 1)} title={!puedeSeguir ? "Cargá al menos uno para seguir" : undefined}>
                {paso === ultimo - 1 ? "Terminar" : "Siguiente →"}
              </button>
            )}
            {paso === 3 && (
              <button onClick={() => setPaso(4)} title="Lo podés completar después en Sitio">
                Saltar por ahora →
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
