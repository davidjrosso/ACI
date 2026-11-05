import { useRef, useState } from "react";
import type { Imagen } from "@aci/shared";
import { api, mensajeError } from "../api";
import { useEstado } from "../estado";
import { Error, Modal, useCarga } from "./ui";

export const urlImg = (slug: string, id: string, v: "g" | "m" | "og" = "m") => `/m/${slug}/${id}-${v}.${v === "og" ? "jpg" : "webp"}`;

/**
 * Elegir una imagen: subir una nueva (desde la galería o la cámara del celular) o reutilizar una ya subida.
 * El servidor la achica, la convierte a WebP y le borra los datos de ubicación.
 */
export function SelectorImagen({ valor, onCambio, etiqueta = "Imagen", forma = "ancha" }: { valor: string | null | undefined; onCambio: (id: string | null) => void; etiqueta?: string; forma?: "ancha" | "redonda" }) {
  const { sesion } = useEstado();
  const slug = sesion!.campania.slug;
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [galeria, setGaleria] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function subir(f: File) {
    setSubiendo(true);
    setError(null);
    try {
      const img = await api.subir<Imagen>("/imagenes", f);
      onCambio(img.id);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="campo">
      <label>{etiqueta}</label>
      <Error msg={error} />
      <div className={`selector-img ${forma}`}>
        {valor ? <img src={urlImg(slug, valor, forma === "redonda" ? "m" : "m")} alt="" /> : <div className="vacio-img">Sin imagen</div>}
        <div className="fila">
          <button type="button" onClick={() => input.current?.click()} disabled={subiendo}>
            {subiendo ? "Subiendo…" : valor ? "Cambiar" : "Subir imagen"}
          </button>
          <button type="button" onClick={() => setGaleria(true)}>
            Elegir de las subidas
          </button>
          {valor && (
            <button type="button" className="peligro" onClick={() => onCambio(null)}>
              Quitar
            </button>
          )}
        </div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/heic" className="sr-only" onChange={(e) => e.target.files?.[0] && void subir(e.target.files[0])} />
      </div>
      <div className="ayuda">JPG, PNG o WebP hasta 8 MB. Para compartir en redes se recorta sola a 1200×630.</div>
      {galeria && (
        <Galeria
          slug={slug}
          onElegir={(id) => {
            onCambio(id);
            setGaleria(false);
          }}
          onCerrar={() => setGaleria(false)}
        />
      )}
    </div>
  );
}

function Galeria({ slug, onElegir, onCerrar }: { slug: string; onElegir: (id: string) => void; onCerrar: () => void }) {
  const { datos, error } = useCarga(() => api.get<Imagen[]>("/imagenes"), []);
  return (
    <Modal titulo="Imágenes subidas" onCerrar={onCerrar}>
      <Error msg={error} />
      {datos?.length === 0 && <p className="muted">Todavía no hay imágenes.</p>}
      <div className="galeria">
        {datos?.map((i) => (
          <button key={i.id} type="button" onClick={() => onElegir(i.id)} aria-label={i.alt ?? "Imagen"}>
            <img src={urlImg(slug, i.id, "m")} alt={i.alt ?? ""} loading="lazy" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
