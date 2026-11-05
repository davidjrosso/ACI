# Plan de módulos

Cada módulo se entrega en su propia rama, con su pull request, sus migraciones (`server/src/db/migrations/campania/NNN_*.sql`), sus tests y su ficha en esta carpeta.

| # | Módulo | Estado | Contenido |
|---|---|---|---|
| 1 | **Núcleo + Sitio del candidato** | ✅ v0.2.0 | Campañas, equipo y roles, barrios, temas, asistente. Sitio público: inicio, noticias, propuestas, agenda, quién es, Sumate. Panel para publicar. |
| 2 | Territorio | Pendiente | Ficha completa de vecinos, timbreo sin señal, mapa de barrios, WhatsApp asistido con plantillas, importación desde Excel. |
| 3 | Escucha | Pendiente | Reclamos y propuestas de vecinos por tema y barrio, con estado y ubicación; agenda interna ampliada. |
| 4 | Tablero de mando | Pendiente | Indicadores por barrio, cobertura, ranking del equipo, avance contra objetivos. |
| 5 | Día de la elección | Pendiente | Escuelas y mesas, fiscales, conteo rápido con foto del acta, traslados. |

El prototipo completo (v0.1, con territorio, mapa, reclamos y tablero ya funcionando) está en la rama `referencia/prototipo-v0.1` para reutilizar código en los módulos 2 a 4.
