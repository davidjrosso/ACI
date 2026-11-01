import type { CrearCampania } from "@territorio/shared";
import type { RegistroBases } from "../db/registro.js";
import { ErrorApp } from "./comun.js";
import { guardarConfig, crearPlantilla } from "./configuracion.js";
import { crearUsuario } from "./usuarios.js";

/** Plantillas de mensaje que trae toda campaña nueva (editables). */
const PLANTILLAS_INICIALES = [
  { titulo: "Primer contacto", texto: "Hola {nombre}, soy voluntario/a de la campaña de {candidato}. Nos gustaría saber qué te preocupa de {barrio}. ¿Te puedo hacer una pregunta?" },
  { titulo: "Agradecimiento por la visita", texto: "Hola {nombre}, gracias por recibirnos hoy en {barrio}. Tomamos nota de lo que nos contaste. Cualquier cosa, escribinos por acá." },
  { titulo: "Invitación a actividad", texto: "Hola {nombre}! Este sábado {candidato} recorre {barrio}. ¿Te sumás? Te paso los detalles." },
];

export function crearCampania(registro: RegistroBases, datos: CrearCampania) {
  if (registro.existe(datos.slug)) throw new ErrorApp(409, `Ya existe la campaña ${datos.slug}`);
  registro.plataforma.prepare("INSERT INTO campanias (slug, nombre) VALUES (?, ?)").run(datos.slug, datos.config.nombre);
  const db = registro.campania(datos.slug, true);
  db.transaction(() => {
    guardarConfig(db, { ...datos.config, mapaConTiles: true, configuracionCompleta: false });
    crearUsuario(db, { ...datos.admin, rol: "comando", barrioIds: [], activo: true, telefono: null });
    for (const p of PLANTILLAS_INICIALES) crearPlantilla(db, p);
  })();
  return { slug: datos.slug };
}
