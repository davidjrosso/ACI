/**
 * Vistas del sitio público del candidato (HTML renderizado en el servidor).
 * Sin JavaScript obligatorio: funciona en cualquier celular y se indexa bien en buscadores.
 */
import {
  AYUDA_LABEL,
  AYUDAS,
  extracto,
  formatoATexto,
  telefonoWhatsApp,
  TIPO_ACTIVIDAD_LABEL,
  type Actividad,
  type Barrio,
  type ConfigCampania,
  type Noticia,
  type Propuesta,
  type SitioConfig,
  type Tema,
} from "@aci/shared";
import { CSS } from "./estilos.js";
import { crudo, dia, diaNum, fecha, hora, html, mes, oscurecer, textoSobre, type Crudo } from "./html.js";

export interface Ctx {
  slug: string;
  base: string; // "" si se accede por dominio propio, "/s/<slug>" si no
  origen: string; // https://dominio (para URLs absolutas de Open Graph)
  cfg: ConfigCampania;
  sitio: SitioConfig;
  temas: Tema[];
  vistaPrevia: boolean;
}

export const urlImagen = (c: Ctx, id: string | null | undefined, v: "g" | "m" | "og") => (id ? `/m/${c.slug}/${id}-${v}.${v === "og" ? "jpg" : "webp"}` : null);
const iniciales = (n: string) =>
  n
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

interface Meta {
  titulo: string;
  descripcion?: string;
  imagen?: string | null; // ruta relativa
  ruta: string; // relativa a base
  tipo?: "website" | "article";
  seccion?: "inicio" | "noticias" | "propuestas" | "agenda" | "quien" | "sumate";
}

function variables(c: Ctx): string {
  const pri = c.cfg.colorPrimario;
  const sec = c.cfg.colorSecundario;
  const priClaro = textoSobre(pri) !== "#ffffff";
  return `:root{--pri:${pri};--pri-osc:${oscurecer(pri, 0.28)};--sobrepri:${textoSobre(pri)};--sec:${sec};--sobresec:${textoSobre(sec)};--pri-txt:${priClaro ? oscurecer(pri, 0.5) : pri}}
@media (prefers-color-scheme:dark){:root{--pri-txt:color-mix(in srgb,${pri} 55%,#fff)}}`;
}

export function pagina(c: Ctx, m: Meta, contenido: Crudo): string {
  const nombreSitio = `${c.cfg.candidato} · ${c.cfg.cargo} ${c.cfg.ciudad}`;
  const titulo = m.seccion === "inicio" ? nombreSitio : `${m.titulo} · ${c.cfg.candidato}`;
  const desc = m.descripcion || c.sitio.bajada || c.cfg.lema || `${c.cfg.candidato}, candidato/a a ${c.cfg.cargo} de ${c.cfg.ciudad}.`;
  const img = m.imagen ?? urlImagen(c, c.sitio.portadaId, "og") ?? urlImagen(c, c.sitio.fotoId, "og");
  const url = `${c.origen}${c.base}${m.ruta}`;
  const foto = urlImagen(c, c.sitio.fotoId, "m");
  const sec = m.seccion;
  const enlace = (ruta: string, texto: string, clave: Meta["seccion"]) => html`<a href="${c.base}${ruta}" ${crudo(sec === clave ? 'aria-current="page"' : "")}>${texto}</a>`;

  return `<!doctype html>${html`<html lang="es-AR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${titulo}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="${c.cfg.colorPrimario}">
<meta property="og:type" content="${m.tipo ?? "website"}">
<meta property="og:site_name" content="${nombreSitio}">
<meta property="og:title" content="${m.titulo}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="es_AR">
${img ? html`<meta property="og:image" content="${c.origen}${img}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">` : ""}
<meta name="twitter:card" content="${img ? "summary_large_image" : "summary"}">
${c.vistaPrevia || !c.sitio.publicado ? crudo('<meta name="robots" content="noindex">') : ""}
<link rel="icon" href="${foto ?? "/icon.svg"}">
<link rel="alternate" type="application/rss+xml" title="Noticias" href="${c.base}/noticias.rss">
<style>${crudo(CSS)}${crudo(variables(c))}</style>
</head>
<body>
<a class="saltar" href="#contenido">Saltar al contenido</a>
${c.vistaPrevia ? html`<div class="aviso-previa">Vista previa: ${c.sitio.publicado ? "así ven el sitio los vecinos." : "el sitio todavía no está publicado, solo lo ve el equipo."}</div>` : ""}
<header class="barra">
  <div class="cont">
    <a class="marca" href="${c.base}/"><span class="ini">${foto ? html`<img src="${foto}" alt="">` : iniciales(c.cfg.candidato)}</span><span>${c.cfg.candidato}</span></a>
    <button class="hamb" aria-expanded="false" aria-controls="menu" onclick="var m=document.getElementById('menu');var a=m.classList.toggle('abierto');this.setAttribute('aria-expanded',a)">Menú</button>
    <nav class="menu" id="menu" aria-label="Principal">
      ${enlace("/noticias", "Noticias", "noticias")}
      ${enlace("/propuestas", "Propuestas", "propuestas")}
      ${enlace("/agenda", "Agenda", "agenda")}
      ${enlace("/quien-soy", "Quién es", "quien")}
      <a class="btn btn-pri" href="${c.base}/sumate">Sumate</a>
    </nav>
  </div>
</header>
<main id="contenido">${contenido}</main>
${pie(c)}
</body>
</html>`}`;
}

function pie(c: Ctx): Crudo {
  const s = c.sitio;
  const redes = [
    ["Instagram", s.instagram],
    ["Facebook", s.facebook],
    ["X", s.x],
    ["TikTok", s.tiktok],
    ["YouTube", s.youtube],
  ].filter(([, u]) => u) as [string, string][];
  const wa = telefonoWhatsApp(s.whatsapp);
  return html`<footer class="pie"><div class="cont">
  <div>
    <h3>${c.cfg.candidato}</h3>
    <p>${c.cfg.nombre}${c.cfg.lema ? html` · ${c.cfg.lema}` : ""}</p>
    ${redes.length ? html`<div class="redes">${redes.map(([n, u]) => html`<a href="${u}" rel="noopener" target="_blank">${n}</a>`)}</div>` : ""}
  </div>
  <div><h3>El sitio</h3><ul>
    <li><a href="${c.base}/noticias">Noticias</a></li><li><a href="${c.base}/propuestas">Propuestas</a></li>
    <li><a href="${c.base}/agenda">Agenda</a></li><li><a href="${c.base}/sumate">Sumate</a></li></ul></div>
  <div><h3>Contacto</h3><ul>
    ${wa ? html`<li><a href="https://wa.me/${wa}" rel="noopener" target="_blank">WhatsApp</a></li>` : ""}
    ${s.email ? html`<li><a href="mailto:${s.email}">${s.email}</a></li>` : ""}
    <li><a href="${c.base}/privacidad">Privacidad de datos</a></li></ul></div>
  <div class="legal">© ${new Date().getFullYear()} ${c.cfg.nombre}. ${s.responsableDatos ? html`Responsable de la base de datos: ${s.responsableDatos}.` : ""}</div>
</div></footer>`;
}

// ---------- Piezas ----------

const temaDe = (c: Ctx, id: string | null | undefined) => c.temas.find((t) => t.id === id);

function tarjetaNota(c: Ctx, n: Noticia): Crudo {
  const img = urlImagen(c, n.imagenId, "m");
  const t = temaDe(c, n.temaId);
  return html`<a class="nota" href="${c.base}/noticias/${n.slug}">
  <div class="img" ${img ? crudo(`style="background-image:url('${img}')"`) : ""} role="img" aria-label=""></div>
  <div class="cuerpo">
    <div class="meta">${t ? html`<span class="tema">${t.nombre}</span>` : ""}<time datetime="${n.fecha ?? ""}">${fecha(n.fecha)}</time></div>
    <h3>${n.titulo}</h3>
    <p class="muted chico">${n.bajada || extracto(n.cuerpo, 140)}</p>
  </div></a>`;
}

function tarjetaEvento(c: Ctx, a: Actividad, barrios: Barrio[]): Crudo {
  const b = barrios.find((x) => x.id === a.barrioId);
  return html`<article class="evento">
  <div class="fecha-caja" aria-hidden="true"><span class="d">${diaNum(a.inicio)}</span><span class="m">${mes(a.inicio)}</span></div>
  <div>
    <h3>${a.titulo}</h3>
    <div class="muted chico">${dia(a.inicio)} · ${hora(a.inicio)} h · ${TIPO_ACTIVIDAD_LABEL[a.tipo]}</div>
    ${a.lugar || b ? html`<div class="chico">${a.lugar ?? ""}${a.lugar && b ? " · " : ""}${b ? b.nombre : ""}</div>` : ""}
    ${a.descripcionPublica ? html`<p class="chico muted" style="margin:.4rem 0 0">${a.descripcionPublica}</p>` : ""}
  </div></article>`;
}

function bandaSumate(c: Ctx): Crudo {
  return html`<section class="banda"><div class="cont">
  <div><h2>Sumate a la campaña</h2><p style="margin:0">${c.sitio.textoSumate || "Cada barrio cuenta. Dejanos tus datos y te contamos cómo ayudar."}</p></div>
  <a class="btn" href="${c.base}/sumate">Quiero sumarme</a></div></section>`;
}

// ---------- Páginas ----------

export function vistaInicio(c: Ctx, d: { destacada: Noticia | null; ultimas: Noticia[]; propuestas: Propuesta[]; agenda: Actividad[]; barrios: Barrio[]; dias: number | null }): string {
  const foto = urlImagen(c, c.sitio.fotoId, "m");
  const portada = urlImagen(c, c.sitio.portadaId, "g");
  const temasConProp = c.temas.map((t) => ({ t, n: d.propuestas.filter((p) => p.temaId === t.id).length })).filter((x) => x.n > 0);
  const resto = d.ultimas.filter((n) => n.id !== d.destacada?.id).slice(0, 3);
  const imgDest = d.destacada ? urlImagen(c, d.destacada.imagenId, "g") : null;

  return pagina(
    c,
    { titulo: c.cfg.candidato, ruta: "/", seccion: "inicio" },
    html`
<section class="heroe">
  ${portada ? html`<div class="fondo" style="background-image:url('${portada}')"></div>` : ""}
  <div class="cont">
    <div>
      <span class="cargo">${c.cfg.cargo} · ${c.cfg.ciudad}</span>
      <h1>${c.sitio.titular || c.cfg.lema || c.cfg.candidato}</h1>
      ${c.sitio.bajada ? html`<p class="bajada">${c.sitio.bajada}</p>` : ""}
      <div class="acciones">
        <a class="btn btn-sec" href="${c.base}/sumate">Sumate</a>
        <a class="btn btn-borde" href="${c.base}/propuestas">Conocé las propuestas</a>
      </div>
      ${d.dias !== null && d.dias > 0 ? html`<div class="cuenta"><strong>${d.dias}</strong> días para la elección</div>` : ""}
    </div>
    <div class="retrato">${foto ? html`<img src="${foto}" alt="${c.cfg.candidato}">` : iniciales(c.cfg.candidato)}</div>
  </div>
</section>

${d.destacada
  ? html`<section class="seccion"><div class="cont">
  <a class="destacada" href="${c.base}/noticias/${d.destacada.slug}">
    <div class="img" ${imgDest ? crudo(`style="background-image:url('${imgDest}')"`) : ""}></div>
    <div class="cuerpo">
      <div class="meta-dest">
        ${temaDe(c, d.destacada.temaId) ? html`<span class="tema">${temaDe(c, d.destacada.temaId)!.nombre}</span>` : ""}<span>${fecha(d.destacada.fecha)}</span></div>
      <h2>${d.destacada.titulo}</h2>
      <p class="muted">${d.destacada.bajada || extracto(d.destacada.cuerpo, 220)}</p>
      <span class="ver-todo">Leer la nota →</span>
    </div>
  </a></div></section>`
  : ""}

${resto.length
  ? html`<section class="seccion" style="padding-top:0"><div class="cont">
  <div class="encab"><h2>Últimas noticias</h2><a class="ver-todo" href="${c.base}/noticias">Ver todas →</a></div>
  <div class="grilla">${resto.map((n) => tarjetaNota(c, n))}</div></div></section>`
  : ""}

${temasConProp.length
  ? html`<section class="seccion alt"><div class="cont">
  <div class="encab"><h2>Propuestas para ${c.cfg.ciudad}</h2><a class="ver-todo" href="${c.base}/propuestas">Ver todas →</a></div>
  <div class="chips">${temasConProp.map(({ t, n }) => html`<a class="chip" href="${c.base}/propuestas#t-${t.id}">${t.nombre} <span class="n">${n}</span></a>`)}</div>
  </div></section>`
  : ""}

${d.agenda.length
  ? html`<section class="seccion"><div class="cont angosto">
  <div class="encab"><h2>Próximas actividades</h2><a class="ver-todo" href="${c.base}/agenda">Agenda completa →</a></div>
  ${d.agenda.slice(0, 3).map((a) => tarjetaEvento(c, a, d.barrios))}</div></section>`
  : ""}

${bandaSumate(c)}`,
  );
}

export function vistaNoticias(c: Ctx, d: { items: Noticia[]; total: number; pagina: number; porPagina: number; temaId?: string }): string {
  const tema = temaDe(c, d.temaId);
  const paginas = Math.ceil(d.total / d.porPagina);
  const q = (p: number) => `${c.base}/noticias?${d.temaId ? `tema=${d.temaId}&` : ""}pagina=${p}`;
  return pagina(
    c,
    { titulo: tema ? `Noticias sobre ${tema.nombre}` : "Noticias", ruta: "/noticias", seccion: "noticias" },
    html`<section class="seccion"><div class="cont">
  <h1>${tema ? html`Noticias · ${tema.nombre}` : "Noticias"}</h1>
  ${tema ? html`<p><a class="ver-todo" href="${c.base}/noticias">← Todas las noticias</a></p>` : ""}
  ${d.items.length ? html`<div class="grilla">${d.items.map((n) => tarjetaNota(c, n))}</div>` : html`<div class="vacio">Todavía no hay noticias publicadas.</div>`}
  ${paginas > 1
    ? html`<nav class="paginas" aria-label="Páginas">
    ${d.pagina > 1 ? html`<a class="btn btn-borde" href="${q(d.pagina - 1)}">← Más nuevas</a>` : html`<span></span>`}
    <span class="muted chico" style="align-self:center">Página ${d.pagina} de ${paginas}</span>
    ${d.pagina < paginas ? html`<a class="btn btn-borde" href="${q(d.pagina + 1)}">Anteriores →</a>` : html`<span></span>`}</nav>`
    : ""}
  </div></section>`,
  );
}

export function vistaNoticia(c: Ctx, n: Noticia, relacionadas: Noticia[]): string {
  const img = urlImagen(c, n.imagenId, "g");
  const t = temaDe(c, n.temaId);
  const url = `${c.origen}${c.base}/noticias/${n.slug}`;
  const textoCompartir = `${n.titulo} ${url}`;
  return pagina(
    c,
    { titulo: n.titulo, descripcion: n.bajada || extracto(n.cuerpo), imagen: urlImagen(c, n.imagenId, "og"), ruta: `/noticias/${n.slug}`, tipo: "article", seccion: "noticias" },
    html`<article class="articulo"><div class="cont angosto">
  <div class="meta muted chico" style="display:flex;gap:.6rem;align-items:center;margin-bottom:.8rem">
    ${t ? html`<a class="tema" style="text-decoration:none" href="${c.base}/noticias?tema=${t.id}">${t.nombre}</a>` : ""}<time datetime="${n.fecha ?? ""}">${fecha(n.fecha)}</time></div>
  <h1>${n.titulo}</h1>
  ${n.bajada ? html`<p class="bajada">${n.bajada}</p>` : ""}
  ${img ? html`<figure class="portada" style="margin-left:0;margin-right:0"><img src="${img}" alt="" loading="eager"></figure>` : ""}
  <div class="texto">${crudo(formatoATexto(n.cuerpo))}</div>
  <div class="compartir" aria-label="Compartir">
    <strong class="chico">Compartir:</strong>
    <a class="btn wa" href="https://wa.me/?text=${encodeURIComponent(textoCompartir)}" rel="noopener" target="_blank">WhatsApp</a>
    <a class="btn" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" rel="noopener" target="_blank">Facebook</a>
    <a class="btn" href="https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(n.titulo)}" rel="noopener" target="_blank">X</a>
    <button class="btn" type="button" onclick="navigator.clipboard&&navigator.clipboard.writeText('${crudo(url.replace(/'/g, ""))}').then(()=>{this.textContent='¡Copiado!'})">Copiar link</button>
  </div>
  ${relacionadas.length ? html`<h2>Más noticias</h2><div class="grilla">${relacionadas.map((r) => tarjetaNota(c, r))}</div>` : ""}
  </div></article>
  ${bandaSumate(c)}`,
  );
}

export function vistaPropuestas(c: Ctx, propuestas: Propuesta[]): string {
  const grupos = [
    ...c.temas.map((t) => ({ t, ps: propuestas.filter((p) => p.temaId === t.id) })),
    { t: null as Tema | null, ps: propuestas.filter((p) => !p.temaId || !c.temas.some((t) => t.id === p.temaId)) },
  ].filter((g) => g.ps.length);
  return pagina(
    c,
    { titulo: `Propuestas para ${c.cfg.ciudad}`, ruta: "/propuestas", seccion: "propuestas" },
    html`<section class="seccion"><div class="cont angosto">
  <h1>Propuestas</h1>
  <p class="muted">Lo que ${c.cfg.candidato} propone para ${c.cfg.ciudad}, ordenado por tema.</p>
  ${grupos.length > 1 ? html`<div class="chips" style="margin-bottom:2rem">${grupos.map((g) => html`<a class="chip" href="#t-${g.t?.id ?? "otras"}">${g.t?.nombre ?? "Otras"}</a>`)}</div>` : ""}
  ${grupos.length
    ? grupos.map(
        (g) => html`<section class="tema-bloque" id="t-${g.t?.id ?? "otras"}" ${g.t?.color ? crudo(`style="--color-tema:${g.t.color}"`) : ""}>
    <h2>${g.t?.nombre ?? "Otras propuestas"}</h2>
    ${g.ps.map((p) => html`<div class="prop"><h3>${p.titulo}</h3><div class="texto" style="font-size:1rem">${crudo(formatoATexto(p.descripcion))}</div></div>`)}
    </section>`,
      )
    : html`<div class="vacio">Muy pronto vas a encontrar acá las propuestas.</div>`}
  </div></section>${bandaSumate(c)}`,
  );
}

export function vistaAgenda(c: Ctx, agenda: Actividad[], barrios: Barrio[]): string {
  return pagina(
    c,
    { titulo: "Agenda", ruta: "/agenda", seccion: "agenda" },
    html`<section class="seccion"><div class="cont angosto">
  <h1>Agenda</h1>
  <p class="muted">Dónde vamos a estar. Acercate, te esperamos.</p>
  ${agenda.length ? agenda.map((a) => tarjetaEvento(c, a, barrios)) : html`<div class="vacio">No hay actividades programadas por ahora.</div>`}
  </div></section>${bandaSumate(c)}`,
  );
}

export function vistaQuien(c: Ctx): string {
  const foto = urlImagen(c, c.sitio.fotoId, "g");
  return pagina(
    c,
    { titulo: `Quién es ${c.cfg.candidato}`, descripcion: extracto(c.sitio.biografia), ruta: "/quien-soy", seccion: "quien" },
    html`<section class="seccion"><div class="cont"><div class="bio">
  <div class="retrato" style="border-color:var(--sup)">${foto ? html`<img src="${foto}" alt="${c.cfg.candidato}">` : iniciales(c.cfg.candidato)}</div>
  <div>
    <h1>${c.cfg.candidato}</h1>
    <p class="muted">${c.cfg.nombre} · candidato/a a ${c.cfg.cargo} de ${c.cfg.ciudad}</p>
    <div class="texto">${c.sitio.biografia ? crudo(formatoATexto(c.sitio.biografia)) : html`<p class="muted">Pronto vas a poder conocer más.</p>`}</div>
  </div></div></div></section>${bandaSumate(c)}`,
  );
}

export function vistaSumate(c: Ctx, barrios: Barrio[], estado: { error?: string; valores?: Record<string, unknown>; ok?: boolean }): string {
  const v = estado.valores ?? {};
  const val = (k: string) => (typeof v[k] === "string" ? (v[k] as string) : "");
  const ayudas = Array.isArray(v.ayudas) ? (v.ayudas as string[]) : [];
  const cuerpo = estado.ok
    ? html`<div class="form ok"><div class="tilde" aria-hidden="true">✓</div><h1 style="font-size:1.8rem">¡Gracias por sumarte!</h1>
      <p class="muted">Alguien del equipo se va a comunicar con vos. Mientras tanto, compartí la campaña con tus vecinos.</p>
      <p><a class="btn btn-pri" href="${c.base}/">Volver al inicio</a></p></div>`
    : html`<form class="form" method="post" action="${c.base}/sumate" novalidate>
  ${estado.error ? html`<div class="error" role="alert">${estado.error}</div>` : ""}
  <div class="dos">
    <div class="campo"><label for="nombre">Nombre</label><input id="nombre" name="nombre" required autocomplete="given-name" value="${val("nombre")}"></div>
    <div class="campo"><label for="apellido">Apellido</label><input id="apellido" name="apellido" autocomplete="family-name" value="${val("apellido")}"></div>
    <div class="campo"><label for="telefono">Celular</label><input id="telefono" name="telefono" type="tel" inputmode="tel" required autocomplete="tel" placeholder="Ej: 3571 15 123456" value="${val("telefono")}"></div>
    <div class="campo"><label for="email">Email (opcional)</label><input id="email" name="email" type="email" autocomplete="email" value="${val("email")}"></div>
  </div>
  ${barrios.length
    ? html`<div class="campo"><label for="barrioId">Tu barrio</label><select id="barrioId" name="barrioId"><option value="">Elegí tu barrio</option>
    ${barrios.map((b) => html`<option value="${b.id}" ${crudo(val("barrioId") === b.id ? "selected" : "")}>${b.nombre}</option>`)}</select></div>`
    : ""}
  <fieldset class="campo" style="border:0;padding:0;margin:0 0 1rem"><legend style="font-weight:600;font-size:.92rem;margin-bottom:.4rem">¿Cómo te gustaría ayudar? (opcional)</legend>
    <div class="opciones">${AYUDAS.map((a) => html`<label class="op"><input type="checkbox" name="ayudas" value="${a}" ${crudo(ayudas.includes(a) ? "checked" : "")}> ${AYUDA_LABEL[a]}</label>`)}</div>
  </fieldset>
  <div class="campo"><label for="mensaje">¿Querés contarnos algo? (opcional)</label><textarea id="mensaje" name="mensaje" maxlength="600">${val("mensaje")}</textarea></div>
  <div class="trampa" aria-hidden="true"><label for="sitio_web">No completar</label><input id="sitio_web" name="sitio_web" tabindex="-1" autocomplete="off"></div>
  <label class="consent campo"><input type="checkbox" name="consentimiento" value="1" required>
    <span>Acepto que ${c.sitio.responsableDatos || c.cfg.nombre} guarde mis datos para contactarme por la campaña, según la Ley 25.326. Puedo pedir que los borren cuando quiera. <a href="${c.base}/privacidad" target="_blank">Más información</a>.</span></label>
  <button class="btn btn-pri" style="width:100%" type="submit">Quiero sumarme</button>
  </form>`;
  return pagina(
    c,
    { titulo: "Sumate", descripcion: c.sitio.textoSumate ?? undefined, ruta: "/sumate", seccion: "sumate" },
    html`<section class="seccion"><div class="cont angosto">
  ${estado.ok ? "" : html`<h1>Sumate</h1><p class="muted">${c.sitio.textoSumate || "Dejanos tus datos y te contamos cómo ayudar."}</p>`}
  ${cuerpo}</div></section>`,
  );
}

export function vistaPrivacidad(c: Ctx): string {
  const resp = c.sitio.responsableDatos || c.cfg.nombre;
  const propio = c.sitio.politicaPrivacidad;
  return pagina(
    c,
    { titulo: "Privacidad de datos", ruta: "/privacidad" },
    html`<section class="seccion"><div class="cont angosto texto">
  <h1>Privacidad de datos</h1>
  ${propio
    ? crudo(formatoATexto(propio))
    : html`<p>Los datos que completás en este sitio los guarda <strong>${resp}</strong> con el único fin de contactarte por la campaña de ${c.cfg.candidato}.</p>
  <ul><li>No los vendemos ni los cedemos a terceros.</li><li>Solo acceden las personas del equipo que coordinan tu barrio.</li>
  <li>Podés pedir ver, corregir o borrar tus datos en cualquier momento${c.sitio.email ? html` escribiendo a ${c.sitio.email}` : ""}.</li></ul>
  <p>Ley 25.326 de Protección de los Datos Personales. La Agencia de Acceso a la Información Pública es el órgano de control.</p>`}
  </div></section>`,
  );
}

export function vistaNoPublicado(c: Ctx): string {
  return pagina(
    c,
    { titulo: "Muy pronto", ruta: "/" },
    html`<section class="heroe"><div class="cont" style="grid-template-columns:1fr;text-align:center;min-height:60vh">
  <div><span class="cargo">${c.cfg.ciudad}</span><h1>${c.cfg.candidato}</h1><p class="bajada" style="margin:0 auto">Estamos preparando el sitio. Muy pronto vas a poder conocer las propuestas.</p></div>
  </div></section>`,
  );
}

export function vistaNoEncontrada(c: Ctx): string {
  return pagina(
    c,
    { titulo: "Página no encontrada", ruta: "/" },
    html`<section class="seccion"><div class="cont angosto" style="text-align:center"><h1>No encontramos esa página</h1>
  <p class="muted">Puede que la nota ya no esté disponible.</p><a class="btn btn-pri" href="${c.base}/">Ir al inicio</a></div></section>`,
  );
}

export function rss(c: Ctx, noticias: Noticia[]): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const items = noticias
    .map(
      (n) => `<item><title>${esc(n.titulo)}</title><link>${c.origen}${c.base}/noticias/${n.slug}</link><guid>${c.origen}${c.base}/noticias/${n.slug}</guid>
<pubDate>${new Date(n.fecha ?? n.creadaEn).toUTCString()}</pubDate><description>${esc(n.bajada || extracto(n.cuerpo, 300))}</description></item>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(c.cfg.candidato)} · Noticias</title><link>${c.origen}${c.base}/</link><description>${esc(c.cfg.nombre)}</description><language>es-AR</language>
${items}</channel></rss>`;
}
