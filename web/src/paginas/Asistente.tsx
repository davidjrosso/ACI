import { useState } from "react";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { SeccionBarrios, SeccionEquipo, SeccionIdentidad, SeccionTemas } from "../componentes/SeccionesConfig";
import { Error } from "../componentes/ui";

/** Asistente de configuración inicial: 5 pasos y la campaña queda lista para usar. */
export function Asistente() {
  const { catalogos, recargarCatalogos, salir } = useEstado();
  const [paso, setPaso] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const c = catalogos!;

  const PASOS = [
    { t: "Tu campaña", d: "Nombre, candidato/a, ciudad y colores. Se puede cambiar después." },
    { t: "Barrios", d: "Cargá los barrios de la ciudad. Si tenés los límites en GeoJSON, importalos para ver el mapa." },
    { t: "Temas", d: "¿De qué se va a hablar en la campaña? Elegí los temas para clasificar reclamos." },
    { t: "Equipo", d: "Sumá referentes y voluntarios y asignales barrios. También podés hacerlo más adelante." },
    { t: "¡Listo!", d: "" },
  ];
  const puedeSeguir = paso === 1 ? c.barrios.length > 0 : paso === 2 ? c.temas.length > 0 : true;

  async function finalizar() {
    try {
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
      <main className="contenido" style={{ maxWidth: 760, paddingBottom: "3rem" }}>
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
          {paso === 3 && <SeccionEquipo />}
          {paso === 4 && (
            <div>
              <p>
                <strong>{c.config.candidato}</strong> en {c.config.ciudad}: {c.barrios.length} barrios, {c.temas.length} temas y {c.equipo.length} personas en el equipo.
              </p>
              <p className="muted">
                Próximos pasos: que cada voluntario instale la app en su celular (en el navegador, “Agregar a pantalla de inicio”) y empiece a timbrear.
              </p>
              <button className="primario" onClick={() => void finalizar()}>
                Empezar a usar la plataforma
              </button>
            </div>
          )}
        </div>

        {paso > 0 && (
          <div className="fila-entre" style={{ marginTop: "1rem" }}>
            <button onClick={() => setPaso((p) => p - 1)}>← Atrás</button>
            {paso < 4 && (
              <button className="primario" disabled={!puedeSeguir} onClick={() => setPaso((p) => p + 1)} title={!puedeSeguir ? "Cargá al menos uno para seguir" : undefined}>
                {paso === 3 ? "Terminar" : "Siguiente →"}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
