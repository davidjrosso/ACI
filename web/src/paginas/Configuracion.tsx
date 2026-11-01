import { useState } from "react";
import { SeccionBarrios, SeccionEquipo, SeccionIdentidad, SeccionPlantillas, SeccionTemas } from "../componentes/SeccionesConfig";

const PESTANIAS = [
  ["identidad", "Campaña"],
  ["barrios", "Barrios"],
  ["temas", "Temas"],
  ["equipo", "Equipo"],
  ["plantillas", "Mensajes"],
] as const;

export function Configuracion() {
  const [tab, setTab] = useState<(typeof PESTANIAS)[number][0]>("identidad");
  return (
    <>
      <div className="titulo-pagina">
        <h1>Configuración</h1>
      </div>
      <div className="tabs" role="tablist">
        {PESTANIAS.map(([k, t]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "sel" : ""} onClick={() => setTab(k)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tarjeta">
        {tab === "identidad" && <SeccionIdentidad />}
        {tab === "barrios" && <SeccionBarrios />}
        {tab === "temas" && <SeccionTemas />}
        {tab === "equipo" && <SeccionEquipo />}
        {tab === "plantillas" && <SeccionPlantillas />}
      </div>
    </>
  );
}
