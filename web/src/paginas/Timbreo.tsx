import { useEffect, useMemo, useState } from "react";
import { APOYO_LABEL, RESULTADO_LABEL, type Apoyo, type InteraccionInput, type Resultado, type Vecino } from "@territorio/shared";
import { api } from "../api";
import { useEstado } from "../estado";
import { descartarPendiente, encolar, guardarVecinosLocales, leerVecinosLocales, pendientes, suscribirCola } from "../offline";
import { ChipApoyo, useToast } from "../componentes/ui";
import { hace, uuid } from "../util";

type Pend = Awaited<ReturnType<typeof pendientes>>[number];

export function Timbreo() {
  const { sesion, catalogos, misBarrios, online } = useEstado();
  const toast = useToast();
  const slug = sesion!.campania.slug;

  const [barrioId, setBarrioId] = useState(() => {
    try {
      return localStorage.getItem("territorio:barrio-timbreo") ?? "";
    } catch {
      return "";
    }
  });
  const [vecinos, setVecinos] = useState<Vecino[]>([]);
  const [copiaFecha, setCopiaFecha] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [vecino, setVecino] = useState<Vecino | null>(null);
  const [direccion, setDireccion] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [apoyo, setApoyo] = useState<Apoyo | null>(null);
  const [temaId, setTemaId] = useState("");
  const [nota, setNota] = useState("");
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [consentimiento, setConsentimiento] = useState(false);
  const [ubicar, setUbicar] = useState(true);
  const [cargadasHoy, setCargadasHoy] = useState(0);
  const [cola, setCola] = useState<Pend[]>([]);

  const barrioValido = misBarrios.some((b) => b.id === barrioId) ? barrioId : misBarrios[0]?.id ?? "";

  // Copia local de vecinos (para buscar en la puerta aunque no haya señal)
  useEffect(() => {
    (async () => {
      const local = await leerVecinosLocales(slug);
      if (local) {
        setVecinos(local.vecinos);
        setCopiaFecha(local.fecha);
      }
      try {
        const r = await api.get<{ items: Vecino[] }>("/vecinos?limite=5000");
        setVecinos(r.items);
        setCopiaFecha(new Date().toISOString());
        await guardarVecinosLocales(slug, r.items);
      } catch {
        /* sin señal: usamos la copia */
      }
    })();
  }, [slug]);

  useEffect(() => {
    const leer = () => pendientes(slug).then(setCola);
    void leer();
    return suscribirCola(() => void leer());
  }, [slug]);

  const candidatos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q.length < 2) return [];
    return vecinos
      .filter((v) => v.barrioId === barrioValido)
      .filter((v) => `${v.nombre} ${v.apellido ?? ""} ${v.direccion ?? ""} ${v.telefono ?? ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [busqueda, vecinos, barrioValido]);

  function limpiar() {
    setBusqueda("");
    setVecino(null);
    setDireccion("");
    setResultado(null);
    setApoyo(null);
    setTemaId("");
    setNota("");
    setNuevo(false);
    setNombre("");
    setApellido("");
    setTelefono("");
    setConsentimiento(false);
  }

  async function posicion(): Promise<{ lat: number; lng: number } | null> {
    if (!ubicar || !("geolocation" in navigator)) return null;
    return new Promise((ok) =>
      navigator.geolocation.getCurrentPosition(
        (p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => ok(null),
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
      ),
    );
  }

  async function guardar() {
    if (!resultado || !barrioValido) return;
    const pos = await posicion();
    const crearVecino = resultado === "atendio" && !vecino && nuevo && nombre.trim();
    const datos: InteraccionInput = {
      id: uuid(),
      barrioId: barrioValido,
      canal: "puerta",
      resultado,
      apoyo: resultado === "atendio" ? apoyo : null,
      temaId: resultado === "atendio" && temaId ? temaId : null,
      direccion: direccion || vecino?.direccion || null,
      nota: nota || null,
      fecha: new Date().toISOString(),
      vecinoId: vecino?.id ?? null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      vecinoNuevo: crearVecino
        ? {
            id: uuid(),
            nombre: nombre.trim(),
            apellido: apellido.trim() || null,
            telefono: telefono.trim() || null,
            direccion: direccion || null,
            barrioId: barrioValido,
            apoyo: apoyo ?? "sin_dato",
            etiquetas: [],
            notas: null,
            consentimiento,
            lat: pos?.lat ?? null,
            lng: pos?.lng ?? null,
          }
        : null,
    };
    await encolar(slug, datos);
    // Reflejar el cambio en la copia local para la próxima búsqueda
    if (vecino && apoyo && resultado === "atendio") setVecinos((vs) => vs.map((v) => (v.id === vecino.id ? { ...v, apoyo, ultimaInteraccion: datos.fecha } : v)));
    setCargadasHoy((n) => n + 1);
    toast(online ? "Visita guardada ✓" : "Visita guardada en el celular. Se envía sola cuando vuelva la señal.");
    limpiar();
  }

  if (!catalogos) return null;
  if (misBarrios.length === 0) return <div className="tarjeta vacio">No tenés barrios asignados. Pedile al comando que te asigne uno.</div>;

  const conError = cola.filter((c) => c.error);

  return (
    <>
      <div className="titulo-pagina">
        <h1>Timbreo</h1>
        <span className="chip">Cargadas ahora: {cargadasHoy}</span>
      </div>

      {!online && <div className="aviso">Estás sin señal. Podés seguir cargando: las visitas se guardan en el celular y se envían solas.</div>}

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="barrio">Barrio</label>
          <select
            id="barrio"
            value={barrioValido}
            onChange={(e) => {
              setBarrioId(e.target.value);
              try {
                localStorage.setItem("territorio:barrio-timbreo", e.target.value);
              } catch {
                /* nada */
              }
            }}
          >
            {misBarrios.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
        </div>

        {vecino ? (
          <div className="campo">
            <label>Vecino</label>
            <div className="fila-entre tarjeta" style={{ padding: ".6rem .8rem", boxShadow: "none" }}>
              <div>
                <strong>
                  {vecino.nombre} {vecino.apellido}
                </strong>
                <div className="muted chico">
                  {vecino.direccion} · último contacto {hace(vecino.ultimaInteraccion)}
                </div>
              </div>
              <div className="fila">
                <ChipApoyo apoyo={vecino.apoyo} />
                <button className="chico-btn" onClick={() => setVecino(null)}>
                  Cambiar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="campo">
              <label htmlFor="buscar">¿Ya lo tenemos? Buscar por nombre, calle o teléfono</label>
              <input id="buscar" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Ej: González, Mitre 1200…" autoComplete="off" />
              {candidatos.length > 0 && (
                <ul className="lista tarjeta" style={{ padding: ".2rem .6rem", marginTop: ".4rem", boxShadow: "none" }}>
                  {candidatos.map((v) => (
                    <li key={v.id}>
                      <button
                        className="item bloque"
                        style={{ border: 0, textAlign: "left", justifyContent: "flex-start" }}
                        onClick={() => {
                          setVecino(v);
                          setBusqueda("");
                        }}
                      >
                        <span className="principal">
                          <strong>
                            {v.nombre} {v.apellido}
                          </strong>
                          <span>{v.direccion}</span>
                        </span>
                        <ChipApoyo apoyo={v.apoyo} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {copiaFecha && <div className="ayuda">Búsqueda sobre la copia del celular ({vecinos.length} vecinos, actualizada {hace(copiaFecha)}).</div>}
            </div>
            <div className="campo">
              <label htmlFor="dir">Dirección</label>
              <input id="dir" value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Calle y número" />
            </div>
          </>
        )}

        <div className="campo">
          <label>¿Qué pasó?</label>
          <div className="segmentado">
            {(Object.keys(RESULTADO_LABEL) as Resultado[]).map((r) => (
              <button key={r} className={resultado === r ? "sel" : ""} onClick={() => setResultado(r)} aria-pressed={resultado === r}>
                {RESULTADO_LABEL[r]}
              </button>
            ))}
          </div>
        </div>

        {resultado === "atendio" && (
          <>
            <div className="campo">
              <label>Apoyo</label>
              <div className="segmentado vertical-movil">
                {(Object.keys(APOYO_LABEL) as Apoyo[]).map((a) => (
                  <button key={a} className={apoyo === a ? "sel" : ""} onClick={() => setApoyo(a)} aria-pressed={apoyo === a}>
                    <span className={`punto p-${a}`} aria-hidden /> {APOYO_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>
            <div className="campo">
              <label htmlFor="tema">Tema que le preocupa</label>
              <select id="tema" value={temaId} onChange={(e) => setTemaId(e.target.value)}>
                <option value="">— Ninguno en particular —</option>
                {catalogos.temas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            {!vecino && (
              <div className="campo">
                <label className="check">
                  <input type="checkbox" checked={nuevo} onChange={(e) => setNuevo(e.target.checked)} />
                  Guardar sus datos como vecino
                </label>
                {nuevo && (
                  <div style={{ marginTop: ".6rem" }}>
                    <div className="campos-2">
                      <div className="campo">
                        <label htmlFor="nom">Nombre</label>
                        <input id="nom" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                      </div>
                      <div className="campo">
                        <label htmlFor="ape">Apellido</label>
                        <input id="ape" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                      </div>
                    </div>
                    <div className="campo">
                      <label htmlFor="tel">Teléfono</label>
                      <input id="tel" type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="3571 15 123456" />
                    </div>
                    <label className="check">
                      <input type="checkbox" checked={consentimiento} onChange={(e) => setConsentimiento(e.target.checked)} />
                      <span>Aceptó que la campaña guarde sus datos y lo contacte (Ley 25.326)</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {resultado && (
          <div className="campo">
            <label htmlFor="nota">Nota (opcional)</label>
            <textarea id="nota" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Lo que contó, si quiere colaborar…" />
          </div>
        )}

        <label className="check" style={{ marginBottom: ".85rem" }}>
          <input type="checkbox" checked={ubicar} onChange={(e) => setUbicar(e.target.checked)} />
          Guardar la ubicación de la visita
        </label>

        <button className="primario bloque" disabled={!resultado || (nuevo && !vecino && resultado === "atendio" && !nombre.trim())} onClick={() => void guardar()}>
          Guardar visita
        </button>
      </div>

      {conError.length > 0 && (
        <div className="tarjeta">
          <h2>Visitas que no se pudieron enviar</h2>
          <ul className="lista">
            {conError.map((c) => (
              <li key={c.id} className="fila-entre" style={{ padding: ".5rem 0" }}>
                <span className="chico">
                  {c.datos.direccion || c.datos.vecinoNuevo?.nombre || "Visita"} — <span style={{ color: "var(--peligro)" }}>{c.error}</span>
                </span>
                <button className="chico-btn peligro" onClick={() => void descartarPendiente(c.id)}>
                  Descartar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
