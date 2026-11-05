# Arquitectura

## Vista general

```
aci/
├── shared/          Contrato común: tipos, validaciones (zod), formato de texto, utilidades
├── server/          Fastify + SQLite (una base por campaña)
│   ├── src/db/migrations/platform/   Base de plataforma (campañas, dominios, sesiones)
│   ├── src/db/migrations/campania/   Base de cada campaña, una migración por módulo
│   ├── src/servicios/                Lógica de negocio
│   ├── src/routes/                   API del panel (/api), sitio público (/s), imágenes (/m)
│   ├── src/sitio/                    Vistas HTML del sitio público (renderizadas en el servidor)
│   └── src/seed/                     Datos de ejemplo
├── web/             Panel de gestión: PWA React (Vite)
└── data/            (no versionado) plataforma.db, campanias/<slug>.db, media/<slug>/
```

Un solo proceso Node sirve tres cosas:

| Ruta | Qué es | Quién la usa |
|---|---|---|
| `/` | Panel (PWA) | Equipo de campaña |
| `/api/*` | API JSON con sesión | Panel |
| `/s/<slug>/*` | Sitio público (HTML) | Vecinos |
| `/m/<slug>/<archivo>` | Imágenes optimizadas | Sitio y panel |

Con dominio propio (`lauramedina.com.ar`), `rewriteUrl` traduce `/noticias` → `/s/<slug>/noticias`. La tabla `dominios` de la plataforma asocia cada dominio a una campaña.

## Multi-campaña

Una base SQLite por campaña: aislamiento total entre candidatos, backup = copiar archivo, baja = borrar archivo. Las imágenes viven en `data/media/<slug>/`.

## Modelo de datos (campaña)

| Tabla | Módulo | Contenido |
|---|---|---|
| `config` | 1 | JSON `campania` (identidad) y `sitio` (textos, foto, redes, publicado) |
| `barrios`, `temas` | 1 | Parametrización |
| `usuarios`, `usuario_barrios` | 1 | Equipo, rol y barrios |
| `vecinos` | 1 → 2 | En el módulo 1 llegan desde "Sumate" (`origen = 'sumate'`, `ayudas`, `contactado`, consentimiento). El módulo 2 suma timbreo y apoyo sobre la misma tabla |
| `imagenes` | 1 | Metadatos; los archivos en disco (`-g.webp`, `-m.webp`, `-og.jpg`) |
| `noticias` | 1 | Slug único, borrador/publicada, fecha (permite programar), destacada |
| `propuestas` | 1 | Por tema, visibles u ocultas |
| `actividades` | 1 | Agenda; `publica` decide si aparece en el sitio |
| `auditoria` | 1 | Altas, cambios, publicaciones, exportaciones y bajas |

## Roles

| | Comando | Comunicación | Referente | Voluntario |
|---|---|---|---|---|
| Configuración y equipo | ✔ | | | |
| Noticias, propuestas, sitio | ✔ | ✔ | | |
| Agenda | ✔ | ✔ | sus barrios | lectura |
| Sumados | ✔ + CSV | ✗ | sus barrios | ✗ |

El alcance se aplica en el servidor (`servicios/comun.ts → alcance / filtroBarrios / verificarBarrio`). Comunicación tiene alcance vacío: aunque llamara a la API de vecinos, no vería nada.

## Sitio público

- HTML generado en el servidor con una plantilla que **escapa todo por defecto** (`sitio/html.ts`). Solo el formato de texto (`formatoATexto`, en `shared`) produce HTML, y lo hace a partir de texto ya escapado.
- CSS en línea (una sola descarga). Sin JavaScript obligatorio; el formulario funciona con un POST clásico.
- Open Graph por página, `sitemap.xml`, `robots.txt`, `noticias.rss`.
- Caché pública de 60 s (vista previa del equipo: `no-store`).
- Sitio no publicado: los vecinos ven "Muy pronto"; el equipo con sesión ve todo con un aviso de vista previa.
- Sumate: validación con zod, consentimiento obligatorio, campo trampa para bots, límite de 20 envíos por hora por IP, deduplicación por teléfono normalizado.

## Imágenes

`sharp` genera tres variantes: 1600 px y 800 px en WebP, y 1200×630 en JPG para redes. Aplica la orientación del celular y descarta los metadatos EXIF (incluida la ubicación GPS). Se sirven con caché de un año porque el nombre nunca cambia.

## Ley 25.326

- Consentimiento explícito con fecha en cada alta desde el sitio.
- Página de privacidad con responsable de la base.
- Comunicación no accede a datos personales.
- Borrado a pedido: anonimiza y conserva solo el dato estadístico.
- Exportación solo para comando, auditada.
