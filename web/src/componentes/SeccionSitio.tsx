import { useState } from "react";
import type { SitioConfig } from "@aci/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { SelectorImagen } from "./SelectorImagen";
import { Error, useToast } from "./ui";

/**
 * Textos e imágenes del sitio público. `compacto` muestra solo lo esencial (para el asistente inicial).
 */
export function SeccionSitio({ compacto = false, onListo, textoBoton = "Guardar cambios" }: { compacto?: boolean; onListo?: () => void; textoBoton?: string }) {
  const { catalogos, recargarCatalogos, urlSitio } = useEstado();
  const toast = useToast();
  const [f, setF] = useState<SitioConfig>(catalogos!.sitio);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = <K extends keyof SitioConfig>(k: K, v: SitioConfig[K]) => setF((x) => ({ ...x, [k]: v }));

  async function guardar(cambios: Partial<SitioConfig> = {}) {
    setGuardando(true);
    setError(null);
    try {
      const nuevo = { ...f, ...cambios };
      await api.put("/sitio/config", nuevo);
      setF(nuevo);
      await recargarCatalogos();
      toast("Sitio guardado");
      onListo?.();
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setGuardando(false);
    }
  }

  const campoTexto = (k: keyof SitioConfig, etiqueta: string, ph = "", tipo = "text") => (
    <div className="campo">
      <label htmlFor={`s-${k}`}>{etiqueta}</label>
      <input id={`s-${k}`} type={tipo} value={(f[k] as string | null) ?? ""} onChange={(e) => set(k, e.target.value as never)} placeholder={ph} />
    </div>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void guardar();
      }}
    >
      <Error msg={error} />
      {!compacto && (
        <div className={`aviso fila-entre ${f.publicado ? "aviso-ok" : ""}`}>
          <span>
            {f.publicado ? (
              <>
                El sitio está <strong>publicado</strong>: lo puede ver cualquiera.
              </>
            ) : (
              <>
                El sitio está <strong>oculto</strong>: los vecinos ven “Muy pronto”. El equipo puede verlo con sesión iniciada.
              </>
            )}
          </span>
          <span className="fila">
            <a className="boton chico-btn" href={urlSitio} target="_blank" rel="noopener">
              Vista previa ↗
            </a>
            <button type="button" className={`chico-btn ${f.publicado ? "" : "primario"}`} disabled={guardando} onClick={() => void guardar({ publicado: !f.publicado })}>
              {f.publicado ? "Ocultar sitio" : "Publicar sitio"}
            </button>
          </span>
        </div>
      )}

      <h3>Portada</h3>
      <div className="campo">
        <label htmlFor="s-titular">Frase principal</label>
        <input id="s-titular" value={f.titular ?? ""} onChange={(e) => set("titular", e.target.value)} placeholder="Ej: Una ciudad que escucha a cada barrio" maxLength={120} />
      </div>
      <div className="campo">
        <label htmlFor="s-bajada">Presentación breve</label>
        <textarea id="s-bajada" rows={3} value={f.bajada ?? ""} onChange={(e) => set("bajada", e.target.value)} maxLength={300} placeholder="Dos o tres oraciones en primera persona." />
      </div>
      <div className="campos-2">
        <SelectorImagen valor={f.fotoId} onCambio={(v) => set("fotoId", v)} etiqueta="Foto del candidato/a" forma="redonda" />
        <SelectorImagen valor={f.portadaId} onCambio={(v) => set("portadaId", v)} etiqueta="Imagen de fondo (opcional)" />
      </div>

      <h3>Quién es</h3>
      <div className="campo">
        <label htmlFor="s-bio">Biografía</label>
        <textarea id="s-bio" rows={compacto ? 5 : 9} value={f.biografia ?? ""} onChange={(e) => set("biografia", e.target.value)} placeholder={"Contá tu historia.\n\n## Trayectoria\n- ..."} />
        <div className="ayuda">Mismo formato que las noticias: **negrita**, ## subtítulo, - lista.</div>
      </div>

      {!compacto && (
        <>
          <h3>Sumate</h3>
          <div className="campo">
            <label htmlFor="s-sumate">Texto de invitación</label>
            <textarea id="s-sumate" rows={2} value={f.textoSumate ?? ""} onChange={(e) => set("textoSumate", e.target.value)} maxLength={400} />
          </div>

          <h3>Contacto y redes</h3>
          <div className="campos-2">
            {campoTexto("email", "Email público", "contacto@...", "email")}
            {campoTexto("whatsapp", "WhatsApp público", "3571 15 123456", "tel")}
            {campoTexto("instagram", "Instagram", "https://instagram.com/...", "url")}
            {campoTexto("facebook", "Facebook", "https://facebook.com/...", "url")}
            {campoTexto("x", "X (Twitter)", "https://x.com/...", "url")}
            {campoTexto("tiktok", "TikTok", "https://tiktok.com/@...", "url")}
            {campoTexto("youtube", "YouTube", "https://youtube.com/...", "url")}
          </div>
          <div className="ayuda" style={{ marginTop: "-.4rem", marginBottom: "1rem" }}>
            El WhatsApp público es un link para que el vecino escriba (wa.me). La plataforma no envía mensajes masivos.
          </div>

          <h3>Datos personales (Ley 25.326)</h3>
          {campoTexto("responsableDatos", "Responsable de la base de datos", "Nombre del partido, frente o persona responsable")}
          <div className="campo">
            <label htmlFor="s-priv">Política de privacidad (opcional)</label>
            <textarea id="s-priv" rows={4} value={f.politicaPrivacidad ?? ""} onChange={(e) => set("politicaPrivacidad", e.target.value)} placeholder="Si lo dejás vacío se usa un texto base. Conviene que lo revise un abogado." />
          </div>
        </>
      )}

      <button className="primario" disabled={guardando}>
        {guardando ? "Guardando…" : textoBoton}
      </button>
    </form>
  );
}
