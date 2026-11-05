import type { CrearCampania } from "@aci/shared";
import type { RegistroBases } from "../db/registro.js";
import { ErrorApp } from "./comun.js";
import { guardarConfig, guardarSitio } from "./configuracion.js";
import { crearUsuario } from "./usuarios.js";

export function crearCampania(registro: RegistroBases, datos: CrearCampania) {
  if (registro.existe(datos.slug)) throw new ErrorApp(409, `Ya existe la campaña ${datos.slug}`);
  registro.plataforma.prepare("INSERT INTO campanias (slug, nombre) VALUES (?, ?)").run(datos.slug, datos.config.nombre);
  const db = registro.campania(datos.slug, true);
  db.transaction(() => {
    guardarConfig(db, { ...datos.config, cargo: "Intendente", configuracionCompleta: false });
    crearUsuario(db, { ...datos.admin, rol: "comando", barrioIds: [], activo: true, telefono: null });
    guardarSitio(db, {
      publicado: false,
      textoSumate: "Dejanos tus datos y te contamos cómo sumarte. Cada barrio cuenta.",
      responsableDatos: datos.config.nombre,
    });
  })();
  return { slug: datos.slug };
}
