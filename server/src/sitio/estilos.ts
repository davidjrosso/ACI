/** CSS del sitio público. Va en línea en cada página: una sola descarga, carga instantánea en 3G. */
export const CSS = `
*{box-sizing:border-box}
:root{--fondo:#fbfaf7;--sup:#fff;--sup2:#f2f0eb;--borde:#e4e1d9;--texto:#191917;--texto2:#54524c;--texto3:#7c7a73;--radio:16px;
--sombra:0 1px 2px rgb(0 0 0/5%),0 8px 24px rgb(0 0 0/6%);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--texto);background:var(--fondo);line-height:1.55}
@media (prefers-color-scheme:dark){:root{--fondo:#121211;--sup:#1b1b19;--sup2:#242421;--borde:#33322e;--texto:#f1f0ec;--texto2:#c5c3bb;--texto3:#93918a;--sombra:0 1px 2px rgb(0 0 0/40%)}}
body{margin:0;background:var(--fondo)}
a{color:inherit}
img{max-width:100%;display:block}
.cont{max-width:1100px;margin:0 auto;padding:0 18px}
.angosto{max-width:720px}
h1,h2,h3{line-height:1.15;margin:0 0 .6rem;letter-spacing:-.01em}
h1{font-size:clamp(1.9rem,5.5vw,3.1rem)}
h2{font-size:clamp(1.35rem,3.6vw,1.9rem)}
h3{font-size:1.12rem}
p{margin:0 0 1rem}
.muted{color:var(--texto2)}.chico{font-size:.88rem}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.saltar{position:absolute;left:-999px}.saltar:focus{left:12px;top:12px;z-index:99;background:var(--sup);padding:.5rem 1rem;border-radius:8px}

/* barra */
.barra{position:sticky;top:0;z-index:50;background:color-mix(in srgb,var(--fondo) 88%,transparent);backdrop-filter:saturate(1.4) blur(10px);border-bottom:1px solid var(--borde)}
.barra .cont{display:flex;align-items:center;gap:1rem;min-height:62px}
.marca{font-weight:800;text-decoration:none;display:flex;align-items:center;gap:.6rem;min-width:0}
.marca .ini{width:34px;height:34px;border-radius:50%;background:var(--pri);color:var(--sobrepri);display:grid;place-items:center;font-size:.85rem;flex:none;overflow:hidden}
.marca .ini img{width:100%;height:100%;object-fit:cover}
.marca span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.menu{display:flex;gap:.2rem;margin-left:auto;align-items:center}
.menu a{text-decoration:none;padding:.5rem .7rem;border-radius:10px;color:var(--texto2);font-weight:500}
.menu a:hover,.menu a[aria-current]{color:var(--texto);background:var(--sup2)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:46px;padding:.6rem 1.25rem;border-radius:999px;font-weight:700;text-decoration:none;border:2px solid transparent;cursor:pointer;font:inherit;font-weight:700}
.btn-pri{background:var(--pri);color:var(--sobrepri)}.btn-pri:hover{background:var(--pri-osc)}
.btn-sec{background:var(--sec);color:var(--sobresec)}
.btn-borde{border-color:currentColor;background:transparent}
.menu .btn{padding:.45rem 1rem;min-height:40px;color:var(--sobrepri);margin-left:.3rem}
.menu .btn:hover{background:var(--pri-osc);color:var(--sobrepri)}
.hamb{display:none;margin-left:auto;background:none;border:1px solid var(--borde);border-radius:10px;min-height:42px;padding:0 .8rem;color:var(--texto);font:inherit}
@media (max-width:820px){
  .hamb{display:inline-flex;align-items:center}
  .menu{display:none;position:absolute;left:0;right:0;top:62px;flex-direction:column;align-items:stretch;background:var(--sup);border-bottom:1px solid var(--borde);padding:.6rem 18px 1rem;box-shadow:var(--sombra)}
  .menu.abierto{display:flex}
  .menu a{padding:.8rem .6rem;font-size:1.05rem}
  .menu .btn{margin:.4rem 0 0}
}

/* portada */
.heroe{position:relative;color:var(--sobrepri);background:var(--pri);overflow:hidden}
.heroe .fondo{position:absolute;inset:0;background-size:cover;background-position:center}
.heroe .fondo::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,color-mix(in srgb,var(--pri-osc) 92%,transparent) 0%,color-mix(in srgb,var(--pri) 70%,transparent) 55%,transparent 100%)}
.heroe .cont{position:relative;display:grid;gap:2rem;grid-template-columns:1fr;padding-top:3rem;padding-bottom:3.2rem;align-items:center}
@media (min-width:860px){.heroe .cont{grid-template-columns:1.25fr .75fr;padding-top:4.5rem;padding-bottom:4.5rem}}
.heroe .cargo{display:inline-block;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:.8rem;background:var(--sec);color:var(--sobresec);padding:.3rem .7rem;border-radius:999px;margin-bottom:1rem}
.heroe h1{font-size:clamp(2.2rem,7vw,3.8rem);margin-bottom:.8rem}
.heroe .bajada{font-size:clamp(1.05rem,2.4vw,1.3rem);opacity:.95;max-width:38rem}
.heroe .acciones{display:flex;gap:.7rem;flex-wrap:wrap;margin-top:1.6rem}
.heroe .acciones .btn-borde{color:var(--sobrepri)}
.retrato{justify-self:center;width:min(78vw,340px);aspect-ratio:1;border-radius:50%;overflow:hidden;border:6px solid color-mix(in srgb,var(--sobrepri) 85%,transparent);box-shadow:0 20px 50px rgb(0 0 0/25%);background:var(--pri-osc);display:grid;place-items:center;font-size:5rem;font-weight:800}
.retrato img{width:100%;height:100%;object-fit:cover}
@media (max-width:859px){.heroe .retrato{order:-1;justify-self:start;width:120px;border-width:4px;font-size:2.4rem}.heroe .cont{gap:1.2rem;padding-top:2rem}}
.cuenta{display:inline-flex;align-items:baseline;gap:.4rem;margin-top:1.4rem;font-weight:600;opacity:.95}
.cuenta strong{font-size:1.6rem}

/* secciones */
.seccion{padding:3rem 0}
.seccion.alt{background:var(--sup2)}
.encab{display:flex;justify-content:space-between;align-items:end;gap:1rem;flex-wrap:wrap;margin-bottom:1.4rem}
.encab h2{margin:0}
.ver-todo{font-weight:700;color:var(--pri-txt);text-decoration:none}
.ver-todo:hover{text-decoration:underline}
.grilla{display:grid;gap:1.2rem;grid-template-columns:repeat(auto-fill,minmax(270px,1fr))}

/* tarjetas de noticias */
.nota{background:var(--sup);border:1px solid var(--borde);border-radius:var(--radio);overflow:hidden;text-decoration:none;display:flex;flex-direction:column;box-shadow:var(--sombra);transition:transform .15s}
.nota:hover{transform:translateY(-2px)}
.nota .img{aspect-ratio:16/9;background:var(--sup2) center/cover}
.nota .cuerpo{padding:1rem 1.1rem 1.2rem;display:flex;flex-direction:column;gap:.35rem;flex:1}
.nota h3{margin:0}
.nota .meta{font-size:.82rem;color:var(--texto3);display:flex;gap:.5rem;flex-wrap:wrap;align-items:center}
.tema{display:inline-block;font-size:.75rem;font-weight:700;padding:.15rem .55rem;border-radius:999px;background:color-mix(in srgb,var(--pri) 13%,var(--sup));color:var(--pri-txt)}
.destacada{display:grid;grid-template-columns:1fr;background:var(--sup);border:1px solid var(--borde);border-radius:calc(var(--radio) + 4px);overflow:hidden;text-decoration:none;box-shadow:var(--sombra)}
@media (min-width:860px){.destacada{grid-template-columns:1.2fr 1fr}}
.destacada .img{min-height:240px;background:var(--sup2) center/cover}
.destacada .cuerpo{padding:1.6rem 1.6rem 1.8rem;display:flex;flex-direction:column;justify-content:center;gap:.5rem}
.destacada h2{margin:0}
.meta-dest{display:flex;gap:.5rem;align-items:center;font-size:.85rem;color:var(--texto3)}

/* propuestas */
.tema-bloque{margin-bottom:2rem}
.tema-bloque>h2{display:flex;align-items:center;gap:.6rem}
.tema-bloque>h2::before{content:"";width:12px;height:12px;border-radius:4px;background:var(--color-tema,var(--pri))}
.prop{background:var(--sup);border:1px solid var(--borde);border-radius:var(--radio);padding:1.1rem 1.2rem;margin-bottom:.8rem}
.prop h3{margin-bottom:.35rem}
.chips{display:flex;gap:.5rem;flex-wrap:wrap}
.chip{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .9rem;border-radius:999px;background:var(--sup);border:1px solid var(--borde);text-decoration:none;font-weight:600;font-size:.92rem}
.chip:hover{border-color:var(--pri)}
.chip .n{color:var(--texto3);font-weight:500}

/* agenda */
.evento{display:flex;gap:1rem;background:var(--sup);border:1px solid var(--borde);border-radius:var(--radio);padding:1rem 1.1rem;margin-bottom:.8rem;align-items:flex-start}
.fecha-caja{flex:none;width:64px;text-align:center;border-radius:12px;background:var(--pri);color:var(--sobrepri);padding:.45rem 0;line-height:1.1}
.fecha-caja .d{font-size:1.6rem;font-weight:800;display:block}
.fecha-caja .m{font-size:.78rem;text-transform:uppercase;font-weight:700;letter-spacing:.05em}
.evento h3{margin:0 0 .2rem}

/* artículo */
.articulo{padding:2.2rem 0 3rem}
.articulo h1{font-size:clamp(1.8rem,5vw,2.7rem)}
.articulo .bajada{font-size:1.2rem;color:var(--texto2)}
.articulo .portada{border-radius:var(--radio);overflow:hidden;margin:1.4rem 0;background:var(--sup2)}
.texto{font-size:1.1rem}
.texto h2{font-size:1.4rem;margin-top:1.8rem}
.texto ul{padding-left:1.3rem}.texto li{margin-bottom:.35rem}
.texto blockquote{margin:1.4rem 0;padding:.4rem 0 .4rem 1.1rem;border-left:4px solid var(--sec);font-size:1.2rem;color:var(--texto2)}
.texto a{color:var(--pri-txt)}
.compartir{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;margin:1.6rem 0;padding:1rem 0;border-top:1px solid var(--borde);border-bottom:1px solid var(--borde)}
.compartir .btn{min-height:42px;padding:.45rem 1rem;font-size:.92rem;background:var(--sup2);color:var(--texto)}
.compartir .wa{background:#128c4b;color:#fff}

/* sumate */
.banda{background:var(--sec);color:var(--sobresec)}
.banda .cont{display:flex;gap:1.5rem;align-items:center;justify-content:space-between;flex-wrap:wrap;padding-top:2.4rem;padding-bottom:2.4rem}
.banda h2{margin:0 0 .3rem}
.banda .btn{background:var(--sobresec);color:var(--sec)}
.form{background:var(--sup);border:1px solid var(--borde);border-radius:var(--radio);padding:1.4rem;box-shadow:var(--sombra)}
.campo{margin-bottom:1rem}
label{display:block;font-weight:600;font-size:.92rem;margin-bottom:.3rem}
input,select,textarea{font:inherit;width:100%;min-height:48px;padding:.6rem .8rem;border:1px solid var(--borde);border-radius:12px;background:var(--sup);color:var(--texto)}
input:focus,select:focus,textarea:focus{outline:3px solid color-mix(in srgb,var(--pri) 35%,transparent);border-color:var(--pri)}
textarea{min-height:96px}
.dos{display:grid;gap:0 1rem;grid-template-columns:1fr}
@media (min-width:600px){.dos{grid-template-columns:1fr 1fr}}
.opciones{display:grid;gap:.5rem;grid-template-columns:1fr}
@media (min-width:600px){.opciones{grid-template-columns:1fr 1fr}}
.op{display:flex;gap:.6rem;align-items:center;border:1px solid var(--borde);border-radius:12px;padding:.7rem .8rem;font-weight:500;margin:0;cursor:pointer}
.op:has(input:checked){border-color:var(--pri);background:color-mix(in srgb,var(--pri) 8%,var(--sup))}
.op input,.consent input{width:22px;min-height:22px;height:22px;accent-color:var(--pri);flex:none}
.consent{display:flex;gap:.7rem;align-items:flex-start;font-weight:400;font-size:.92rem;color:var(--texto2)}
.trampa{position:absolute;left:-5000px}
.error{background:#fdecea;color:#8a1c12;border:1px solid #f5c2bd;border-radius:12px;padding:.8rem 1rem;margin-bottom:1rem}
.ok{text-align:center;padding:2.5rem 1rem}
.ok .tilde{width:72px;height:72px;border-radius:50%;background:var(--pri);color:var(--sobrepri);display:grid;place-items:center;font-size:2.2rem;margin:0 auto 1rem}

/* bio */
.bio{display:grid;gap:2rem;grid-template-columns:1fr;align-items:start}
@media (min-width:820px){.bio{grid-template-columns:300px 1fr}}
.bio .retrato{width:100%;max-width:300px;color:var(--sobrepri)}

/* pie */
.pie{background:var(--pri-osc);color:var(--sobrepri);padding:2.4rem 0 1.6rem;margin-top:2rem}
.pie .cont{display:grid;gap:1.6rem;grid-template-columns:1fr}
@media (min-width:760px){.pie .cont{grid-template-columns:1.4fr 1fr 1fr}}
.pie a{color:inherit;opacity:.9}
.pie ul{list-style:none;margin:0;padding:0;display:grid;gap:.4rem}
.redes{display:flex;gap:.5rem;flex-wrap:wrap}
.redes a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 .9rem;border-radius:999px;border:1px solid color-mix(in srgb,var(--sobrepri) 35%,transparent);text-decoration:none;font-weight:600;font-size:.9rem}
.legal{grid-column:1/-1;border-top:1px solid color-mix(in srgb,var(--sobrepri) 20%,transparent);padding-top:1rem;font-size:.82rem;opacity:.8}
.aviso-previa{background:#fff4d6;color:#5c4100;text-align:center;padding:.5rem 1rem;font-size:.9rem;font-weight:600}
.paginas{display:flex;justify-content:space-between;gap:1rem;margin-top:1.6rem}
.vacio{text-align:center;color:var(--texto2);padding:2rem 1rem;background:var(--sup);border:1px dashed var(--borde);border-radius:var(--radio)}
`;
