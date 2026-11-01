# Territorio

Plataforma de gestión de campañas municipales pensada para **ciudades chicas**: se configura en una tarde, se usa desde el celular y funciona sin señal en la calle.

**Versión 0.1.0** · Node + TypeScript + SQLite · PWA en React

## Qué incluye

| Módulo | Para qué |
|---|---|
| **Asistente inicial** | 5 pasos: campaña, barrios, temas, equipo, listo |
| **Tablero** | Días para la elección, vecinos, contactos, apoyo por barrio, reclamos por tema, ranking del equipo |
| **Mapa** | Barrios coloreados por apoyo o cobertura, reclamos abiertos y visitas de la semana |
| **Timbreo** | Carga de una visita en pocos toques. Funciona sin señal y sincroniza sola |
| **Vecinos** | Ficha, etiquetas, consentimiento, historial y **WhatsApp asistido** (abre el chat con el mensaje listo; nunca envía automáticamente) |
| **Reclamos y propuestas** | Por tema y barrio, con estado (nuevo → en curso → resuelto) y ubicación |
| **Agenda** | Actividades del candidato y de los equipos |
| **Configuración** | Barrios (con importación GeoJSON), temas, equipo y roles, plantillas de mensajes |

Roles: **Comando** (ve todo y configura), **Referente** (sus barrios), **Voluntario/a** (carga visitas en sus barrios).

## Empezar en desarrollo

Requisitos: Node 22.13 o superior.

```bash
npm install
npm run build -w shared       # tipos compartidos
npm run seed                  # crea las campañas de ejemplo en ./data
npm run dev:server            # API en http://localhost:3000
npm run dev:web               # Web en http://localhost:5173 (proxy a la API)
```

### Accesos de ejemplo

Ciudad inventada **Valle Esmeralda** (12 barrios, ~800 vecinos, ~2000 contactos, 140 reclamos):

| Código de campaña | Email | Contraseña | Rol |
|---|---|---|---|
| `demo` | comando@valle-esmeralda.demo | demo1234 | Comando |
| `demo` | referente@valle-esmeralda.demo | demo1234 | Referente (4 barrios) |
| `demo` | voluntario@valle-esmeralda.demo | demo1234 | Voluntario (2 barrios) |
| `prueba` | admin@prueba.demo | prueba1234 | Campaña vacía → asistente |

`npm run seed -- --reset` vuelve a generar los datos de ejemplo.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila shared, server y web (producción) |
| `npm start` | Levanta el servidor de producción (sirve también la web) |
| `npm test` | Tests de la API (vitest) |
| `npm run typecheck` | Chequeo de tipos de todo el monorepo |

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): estructura, modelo de datos, API, offline.
- [docs/DECISIONES.md](docs/DECISIONES.md): decisiones tomadas y por qué.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): VPS, nginx, backups, alta de campañas.
- [docs/HOJA-DE-RUTA.md](docs/HOJA-DE-RUTA.md): lo que viene.
- [AGENTS.md](AGENTS.md): reglas para trabajar con Codex o Claude Code sobre este repo.
