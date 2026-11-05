# Módulo 1 · Núcleo + Sitio del candidato

**Versión:** 0.2.0 · **Migraciones:** `001_nucleo.sql`, `002_sitio.sql`

## Objetivo
Que una campaña tenga, desde el primer día, un sitio propio para publicar noticias y propuestas, y que cada vecino que se suma desde el sitio quede registrado con su consentimiento y su barrio.

## Núcleo
- Alta de campañas por la plataforma (una base SQLite por campaña).
- Asistente inicial en 6 pasos: campaña, barrios, temas, sitio, equipo, listo.
- Roles:

| Rol | Ve | Puede |
|---|---|---|
| Comando | Todo | Configurar, publicar, ver y exportar sumados |
| Comunicación | Sitio y agenda | Publicar noticias, propuestas, agenda; editar el sitio. **No ve datos de vecinos.** |
| Referente | Sus barrios | Ver y contactar a los sumados de sus barrios; cargar agenda de sus barrios |
| Voluntario/a | Sus barrios | Ver la agenda |

## Sitio público
Rutas: `/s/<campaña>/` o la raíz de un dominio propio.

| Página | Contenido |
|---|---|
| Inicio | Portada con frase, presentación y foto; cuenta regresiva; noticia destacada; últimas noticias; temas con propuestas; próximas actividades; banda "Sumate" |
| Noticias | Listado paginado, filtro por tema, nota con imagen, botones de compartir (WhatsApp, Facebook, X, copiar) y notas relacionadas |
| Propuestas | Agrupadas por tema |
| Agenda | Solo actividades marcadas como públicas (nunca las notas internas) |
| Quién es | Biografía |
| Sumate | Formulario con barrio, formas de ayudar y consentimiento; anti-spam (campo trampa + límite por IP); si el teléfono ya existe, actualiza en lugar de duplicar |
| Privacidad | Texto propio o texto base de Ley 25.326 |

Técnico:
- HTML renderizado en el servidor, sin JavaScript obligatorio: carga rápida en celulares y bien indexado.
- Open Graph y Twitter Card en cada nota: la vista previa se ve bien al compartir por WhatsApp.
- `sitemap.xml`, `robots.txt` y `noticias.rss` por sitio.
- Caché de 60 segundos para soportar picos de visitas.
- Mientras no se publica, los vecinos ven "Muy pronto"; el equipo con sesión iniciada ve la vista previa.

## Panel (PWA)
- **Inicio:** días para la elección, sumados (total, semana, sin contactar), noticias y borradores, gráfico semanal, cómo quieren ayudar, próximos 14 días, link del sitio.
- **Noticias:** borrador → publicada, programar fecha, destacar (una sola), tema y barrio, imagen, editor con barra de formato y vista previa. El link se mantiene al editar una nota publicada.
- **Imágenes:** se suben desde el celular; el servidor genera WebP de 1600 y 800 px y un recorte de 1200×630 para redes, y borra los metadatos (incluida la ubicación GPS).
- **Propuestas, Agenda, Sitio, Sumados, Configuración.**
- **Sumados:** filtros por barrio, forma de ayudar y pendientes; WhatsApp asistido (abre el chat con un saludo listo, nunca envía solo); marcar contactado; borrar datos a pedido; exportar CSV (solo comando, queda auditado).

## Fuera de este módulo
Timbreo, mapa, ficha completa de vecinos, reclamos y tablero por barrio: módulos 2 a 4.

## Pruebas
`npm test`: 20 pruebas de API (roles, publicación, programadas, escape de HTML, sitio oculto, agenda pública, dominios propios, Sumate, anti-spam, duplicados, alcance por barrio, exportación, imágenes).
