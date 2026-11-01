/**
 * Secciones de parametrización. Las usa el asistente inicial (paso a paso)
 * y la pantalla de Configuración (en pestañas). Toda la parametrización de
 * una campaña es esto: identidad, barrios, temas, equipo y mensajes.
 */
import { useState } from "react";
import type { Barrio, ConfigCampania, Plantilla, Rol, Tema, Usuario, UsuarioInput } from "@territorio/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { Error, Modal, useCarga, useToast } from "./ui";
import { passwordTemporal } from "../util";

// ---------- Identidad ----------
export function SeccionIdentidad({ onListo, textoBoton = "Guardar" }: { onListo?: () => void; textoBoton?: string }) {
  const { catalogos, recargarCatalogos } = useEstado();
  const toast = useToast();
  const [f, setF] = useState<ConfigCampania>(catalogos!.config);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ConfigCampania>(k: K, v: ConfigCampania[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { configuracionCompleta: _, ...resto } = f;
      await api.put("/config", resto);
      await recargarCatalogos();
      toast("Datos de la campaña guardados");
      onListo?.();
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <form onSubmit={guardar}>
      <Error msg={error} />
      <div className="campos-2">
        <div className="campo">
          <label htmlFor="cn">Nombre de la campaña o frente</label>
          <input id="cn" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="cc">Candidato/a</label>
          <input id="cc" value={f.candidato} onChange={(e) => set("candidato", e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="cci">Ciudad</label>
          <input id="cci" value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="cf">Fecha de la elección</label>
          <input id="cf" type="date" value={f.fechaEleccion ?? ""} onChange={(e) => set("fechaEleccion", e.target.value || null)} />
        </div>
      </div>
      <div className="campo">
        <label htmlFor="cl">Lema (opcional)</label>
        <input id="cl" value={f.lema ?? ""} onChange={(e) => set("lema", e.target.value)} />
      </div>
      <div className="fila" style={{ gap: "1.5rem", marginBottom: "1rem" }}>
        <div>
          <label htmlFor="cp">Color principal</label>
          <input id="cp" type="color" value={f.colorPrimario} onChange={(e) => set("colorPrimario", e.target.value)} />
        </div>
        <div>
          <label htmlFor="cs">Color secundario</label>
          <input id="cs" type="color" value={f.colorSecundario} onChange={(e) => set("colorSecundario", e.target.value)} />
        </div>
        <label className="check" style={{ alignSelf: "end" }}>
          <input type="checkbox" checked={f.mapaConTiles} onChange={(e) => set("mapaConTiles", e.target.checked)} />
          Mostrar calles de OpenStreetMap debajo de los barrios
        </label>
      </div>
      <button className="primario">{textoBoton}</button>
    </form>
  );
}

// ---------- Barrios ----------
export function SeccionBarrios() {
  const { catalogos, recargarCatalogos } = useEstado();
  const toast = useToast();
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<Barrio | null>(null);
  const barrios = catalogos!.barrios;

  async function agregar() {
    const nombres = texto
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    setError(null);
    const errores: string[] = [];
    for (const nombre of nombres) {
      try {
        await api.post("/barrios", { nombre });
      } catch (e) {
        errores.push(mensajeError(e));
      }
    }
    await recargarCatalogos();
    setTexto("");
    if (errores.length) setError(errores.join(" · "));
    else toast(`${nombres.length} barrio(s) agregados`);
  }

  async function importar(archivo: File) {
    setError(null);
    try {
      const geojson = JSON.parse(await archivo.text());
      const r = await api.post<{ creados: number; actualizados: number }>("/barrios/importar-geojson", { geojson, propiedadNombre: "nombre" });
      await recargarCatalogos();
      toast(`Importados: ${r.creados} nuevos, ${r.actualizados} con límites actualizados`);
    } catch (e) {
      setError(e instanceof SyntaxError ? "El archivo no es un GeoJSON válido" : mensajeError(e));
    }
  }

  async function borrar(b: Barrio) {
    if (!confirm(`¿Borrar el barrio ${b.nombre}?`)) return;
    try {
      await api.del(`/barrios/${b.id}`);
      await recargarCatalogos();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <>
      <Error msg={error} />
      <p className="muted">El barrio es la unidad de trabajo: cada referente y voluntario tiene barrios asignados y solo ve los suyos.</p>
      <div className="campo">
        <label htmlFor="bt">Agregar barrios (uno por línea o separados por coma)</label>
        <textarea id="bt" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={"Centro\nBarrio Norte\nLas Flores"} />
      </div>
      <div className="fila" style={{ marginBottom: "1rem" }}>
        <button className="primario" onClick={() => void agregar()} disabled={!texto.trim()}>
          Agregar
        </button>
        <label className="boton" style={{ margin: 0, fontWeight: 400, color: "var(--texto)" }}>
          Importar límites (GeoJSON)
          <input type="file" accept=".geojson,.json,application/geo+json" className="sr-only" onChange={(e) => e.target.files?.[0] && void importar(e.target.files[0])} />
        </label>
      </div>
      <div className="ayuda" style={{ marginBottom: "1rem" }}>
        Los límites se pueden dibujar gratis en geojson.io o exportar desde QGIS. Cada polígono debe tener la propiedad <code>nombre</code>.
      </div>
      <ul className="lista">
        {barrios.map((b) => (
          <li key={b.id} className="fila-entre" style={{ padding: ".55rem 0" }}>
            <span>
              <strong>{b.nombre}</strong>
              <span className="muted chico">
                {" "}
                · {b.geometria ? "con límites en el mapa" : "sin límites"}
                {b.objetivoContactos ? ` · objetivo ${b.objetivoContactos} contactos` : ""}
              </span>
            </span>
            <span className="fila">
              <button className="chico-btn" onClick={() => setEditando(b)}>
                Editar
              </button>
              <button className="chico-btn peligro" onClick={() => void borrar(b)}>
                Borrar
              </button>
            </span>
          </li>
        ))}
      </ul>
      {editando && (
        <EditarBarrio
          barrio={editando}
          onCerrar={() => setEditando(null)}
          onGuardado={async () => {
            setEditando(null);
            await recargarCatalogos();
          }}
        />
      )}
    </>
  );
}

function EditarBarrio({ barrio, onCerrar, onGuardado }: { barrio: Barrio; onCerrar: () => void; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(barrio.nombre);
  const [objetivo, setObjetivo] = useState(barrio.objetivoContactos?.toString() ?? "");
  const [error, setError] = useState<string | null>(null);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.put(`/barrios/${barrio.id}`, { nombre, geometria: barrio.geometria ?? null, objetivoContactos: objetivo ? Number(objetivo) : null });
      onGuardado();
    } catch (err) {
      setError(mensajeError(err));
    }
  }
  return (
    <Modal titulo="Editar barrio" onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Error msg={error} />
        <div className="campo">
          <label htmlFor="ebn">Nombre</label>
          <input id="ebn" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </div>
        <div className="campo">
          <label htmlFor="ebo">Objetivo de vecinos contactados</label>
          <input id="ebo" type="number" min={0} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
          <div className="ayuda">Se usa en el mapa de cobertura y en el tablero.</div>
        </div>
        <button className="primario bloque">Guardar</button>
      </form>
    </Modal>
  );
}

// ---------- Temas ----------
const TEMAS_SUGERIDOS = ["Calles y bacheo", "Seguridad", "Alumbrado", "Limpieza y residuos", "Salud", "Empleo", "Transporte", "Desagües e inundaciones", "Educación", "Deporte y juventud"];

export function SeccionTemas() {
  const { catalogos, recargarCatalogos } = useEstado();
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);
  const temas = catalogos!.temas;
  const existentes = new Set(temas.map((t) => t.nombre.toLowerCase()));

  async function agregar(n: string) {
    setError(null);
    try {
      await api.post("/temas", { nombre: n });
      await recargarCatalogos();
      setNombre("");
    } catch (e) {
      setError(mensajeError(e));
    }
  }
  async function borrar(t: Tema) {
    try {
      await api.del(`/temas/${t.id}`);
      await recargarCatalogos();
    } catch (e) {
      setError(mensajeError(e));
    }
  }

  return (
    <>
      <Error msg={error} />
      <p className="muted">Los temas ordenan los reclamos y lo que preocupa a cada vecino. Conviene no pasar de 10.</p>
      <div className="fila" style={{ marginBottom: "1rem" }}>
        {TEMAS_SUGERIDOS.filter((t) => !existentes.has(t.toLowerCase())).map((t) => (
          <button key={t} className="chico-btn" onClick={() => void agregar(t)}>
            + {t}
          </button>
        ))}
      </div>
      <div className="fila" style={{ flexWrap: "nowrap", marginBottom: "1rem" }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Otro tema…" aria-label="Nuevo tema" />
        <button className="primario" disabled={nombre.trim().length < 2} onClick={() => void agregar(nombre.trim())}>
          Agregar
        </button>
      </div>
      <div className="fila">
        {temas.map((t) => (
          <span key={t.id} className="chip" style={{ fontSize: ".9rem", padding: ".3rem .4rem .3rem .75rem" }}>
            {t.nombre}
            <button className="chico-btn" style={{ minHeight: 26, padding: "0 .4rem", border: 0, background: "none" }} onClick={() => void borrar(t)} aria-label={`Borrar ${t.nombre}`}>
              ✕
            </button>
          </span>
        ))}
      </div>
    </>
  );
}

// ---------- Equipo ----------
const ROLES: { v: Rol; t: string; d: string }[] = [
  { v: "comando", t: "Comando", d: "Ve toda la ciudad y configura la campaña" },
  { v: "referente", t: "Referente", d: "Coordina sus barrios: vecinos, reclamos y agenda" },
  { v: "voluntario", t: "Voluntario/a", d: "Carga visitas y vecinos en sus barrios" },
];

export function SeccionEquipo() {
  const { catalogos, recargarCatalogos } = useEstado();
  const { datos, error, recargar } = useCarga(() => api.get<Usuario[]>("/usuarios"), []);
  const [editando, setEditando] = useState<Usuario | "nuevo" | null>(null);
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null);
  const nombreB = (id: string) => catalogos!.barrios.find((b) => b.id === id)?.nombre ?? "?";

  return (
    <>
      <Error msg={error} />
      <div className="fila-entre" style={{ marginBottom: ".5rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          Cada persona entra con su email. Referentes y voluntarios solo ven sus barrios.
        </p>
        <button className="primario" onClick={() => setEditando("nuevo")}>
          + Persona
        </button>
      </div>
      {credencial && (
        <div className="aviso">
          Pasale estos datos de ingreso (se muestran una sola vez): <strong>{credencial.email}</strong> / <strong>{credencial.password}</strong> · Código de campaña:{" "}
          <strong>{useEstadoSlug()}</strong>
        </div>
      )}
      <ul className="lista">
        {datos?.map((u) => (
          <li key={u.id} className="fila-entre" style={{ padding: ".55rem 0", opacity: u.activo ? 1 : 0.55 }}>
            <span>
              <strong>{u.nombre}</strong> <span className="chip">{ROLES.find((r) => r.v === u.rol)?.t}</span>
              {!u.activo && <span className="chip">Inactivo</span>}
              <div className="muted chico">
                {u.email}
                {u.rol !== "comando" && ` · ${u.barrioIds.map(nombreB).join(", ")}`}
              </div>
            </span>
            <button className="chico-btn" onClick={() => setEditando(u)}>
              Editar
            </button>
          </li>
        ))}
      </ul>
      {editando && (
        <FormUsuario
          inicial={editando === "nuevo" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={async (cred) => {
            setEditando(null);
            if (cred) setCredencial(cred);
            recargar();
            await recargarCatalogos();
          }}
        />
      )}
    </>
  );
}

function useEstadoSlug() {
  return useEstado().sesion!.campania.slug;
}

function FormUsuario({ inicial, onCerrar, onGuardado }: { inicial: Usuario | null; onCerrar: () => void; onGuardado: (cred?: { email: string; password: string }) => void }) {
  const { catalogos } = useEstado();
  const [f, setF] = useState<UsuarioInput>(
    inicial ? { ...inicial, password: undefined } : { nombre: "", email: "", telefono: "", rol: "voluntario", barrioIds: [], activo: true, password: passwordTemporal() },
  );
  const [resetear, setResetear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof UsuarioInput>(k: K, v: UsuarioInput[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const datos = { ...f, password: inicial && !resetear ? undefined : f.password };
      if (inicial) await api.put(`/usuarios/${inicial.id}`, datos);
      else await api.post("/usuarios", datos);
      onGuardado(datos.password ? { email: f.email, password: datos.password } : undefined);
    } catch (err) {
      setError(mensajeError(err));
    }
  }

  return (
    <Modal titulo={inicial ? "Editar persona" : "Sumar persona al equipo"} onCerrar={onCerrar}>
      <form onSubmit={guardar}>
        <Error msg={error} />
        <div className="campos-2">
          <div className="campo">
            <label htmlFor="un">Nombre</label>
            <input id="un" value={f.nombre} onChange={(e) => set("nombre", e.target.value)} required />
          </div>
          <div className="campo">
            <label htmlFor="ue">Email</label>
            <input id="ue" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
          </div>
        </div>
        <div className="campo">
          <label>Rol</label>
          <div className="grilla" style={{ gap: ".4rem" }}>
            {ROLES.map((r) => (
              <label key={r.v} className="check tarjeta" style={{ boxShadow: "none", padding: ".6rem .8rem", margin: 0, borderColor: f.rol === r.v ? "var(--primario)" : undefined }}>
                <input type="radio" name="rol" checked={f.rol === r.v} onChange={() => set("rol", r.v)} style={{ width: 20, minHeight: 20, height: 20 }} />
                <span>
                  <strong>{r.t}</strong>
                  <span className="muted chico" style={{ display: "block" }}>
                    {r.d}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
        {f.rol !== "comando" && (
          <div className="campo">
            <label>Barrios asignados</label>
            <div className="fila">
              {catalogos!.barrios.map((b) => {
                const sel = f.barrioIds.includes(b.id);
                return (
                  <button
                    type="button"
                    key={b.id}
                    className={`chico-btn ${sel ? "primario" : ""}`}
                    aria-pressed={sel}
                    onClick={() => set("barrioIds", sel ? f.barrioIds.filter((x) => x !== b.id) : [...f.barrioIds, b.id])}
                  >
                    {b.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {inicial ? (
          <>
            <label className="check" style={{ marginBottom: ".6rem" }}>
              <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} />
              Usuario activo (desactivarlo cierra sus sesiones)
            </label>
            <label className="check" style={{ marginBottom: "1rem" }}>
              <input
                type="checkbox"
                checked={resetear}
                onChange={(e) => {
                  setResetear(e.target.checked);
                  if (e.target.checked) set("password", passwordTemporal());
                }}
              />
              Generar una contraseña nueva
            </label>
          </>
        ) : null}
        {(!inicial || resetear) && (
          <div className="campo">
            <label htmlFor="up">Contraseña temporal</label>
            <input id="up" value={f.password ?? ""} onChange={(e) => set("password", e.target.value)} minLength={8} required />
          </div>
        )}
        <button className="primario bloque">Guardar</button>
      </form>
    </Modal>
  );
}

// ---------- Plantillas de mensajes ----------
export function SeccionPlantillas() {
  const { catalogos, recargarCatalogos } = useEstado();
  const [editando, setEditando] = useState<Plantilla | "nueva" | null>(null);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);

  function abrir(p: Plantilla | "nueva") {
    setEditando(p);
    setTitulo(p === "nueva" ? "" : p.titulo);
    setTexto(p === "nueva" ? "" : p.texto);
    setError(null);
  }
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editando === "nueva") await api.post("/plantillas", { titulo, texto });
      else if (editando) await api.put(`/plantillas/${editando.id}`, { titulo, texto });
      await recargarCatalogos();
      setEditando(null);
    } catch (err) {
      setError(mensajeError(err));
    }
  }
  async function borrar(p: Plantilla) {
    if (!confirm(`¿Borrar la plantilla "${p.titulo}"?`)) return;
    await api.del(`/plantillas/${p.id}`);
    await recargarCatalogos();
  }

  return (
    <>
      <div className="fila-entre" style={{ marginBottom: ".5rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          Mensajes listos para que el equipo escriba por WhatsApp desde su propio teléfono. Podés usar {"{nombre}"}, {"{barrio}"} y {"{candidato}"}.
        </p>
        <button className="primario" onClick={() => abrir("nueva")}>
          + Plantilla
        </button>
      </div>
      <ul className="lista">
        {catalogos!.plantillas.map((p) => (
          <li key={p.id} style={{ padding: ".6rem 0" }}>
            <div className="fila-entre">
              <strong>{p.titulo}</strong>
              <span className="fila">
                <button className="chico-btn" onClick={() => abrir(p)}>
                  Editar
                </button>
                <button className="chico-btn peligro" onClick={() => void borrar(p)}>
                  Borrar
                </button>
              </span>
            </div>
            <div className="muted chico">{p.texto}</div>
          </li>
        ))}
      </ul>
      {editando && (
        <Modal titulo={editando === "nueva" ? "Nueva plantilla" : "Editar plantilla"} onCerrar={() => setEditando(null)}>
          <form onSubmit={guardar}>
            <Error msg={error} />
            <div className="campo">
              <label htmlFor="pt">Título</label>
              <input id="pt" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
            </div>
            <div className="campo">
              <label htmlFor="px">Texto</label>
              <textarea id="px" value={texto} onChange={(e) => setTexto(e.target.value)} required rows={5} />
            </div>
            <button className="primario bloque">Guardar</button>
          </form>
        </Modal>
      )}
    </>
  );
}
