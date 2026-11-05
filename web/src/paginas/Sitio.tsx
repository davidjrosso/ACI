import { SeccionSitio } from "../componentes/SeccionSitio";

export function Sitio() {
  return (
    <>
      <div className="titulo-pagina">
        <div>
          <h1>Sitio de la campaña</h1>
          <div className="muted chico">Portada, biografía, contacto y redes</div>
        </div>
      </div>
      <div className="tarjeta">
        <SeccionSitio />
      </div>
    </>
  );
}
