# ACI

Plataforma para campañas municipales en ciudades chicas. Se configura en una tarde, se usa desde el celular y crece por módulos.

**Versión 0.2.0 · Módulo 1: Núcleo + Sitio del candidato** · Node + TypeScript + SQLite · PWA en React

## Qué incluye este módulo

- **Sitio público del candidato**: inicio, noticias, propuestas, agenda, quién es y formulario "Sumate". Rápido en el celular, listo para compartir por WhatsApp y con dominio propio opcional.
- **Panel de la campaña**: publicar noticias con imagen, propuestas y agenda; ver y contactar a quienes se sumaron; configurar el sitio.
- **Núcleo**: campañas aisladas, equipo con roles (Comando, Comunicación, Referente, Voluntario), barrios, temas y asistente inicial.

Detalle en [docs/modulos/01-nucleo-y-sitio.md](docs/modulos/01-nucleo-y-sitio.md). Próximos módulos en [docs/modulos/00-plan.md](docs/modulos/00-plan.md).

## Empezar en desarrollo

Requisitos: Node 22.13 o superior.

```bash
npm install
npm run build -w shared       # tipos compartidos
npm run seed                  # campañas de ejemplo en ./data
npm run dev:server            # API y sitio público en http://localhost:3000
npm run dev:web               # Panel en http://localhost:5173 (proxy a la API)
```

O todo compilado en un solo proceso: `npm run build && npm start` → http://localhost:3000

### Datos de ejemplo

Ciudad inventada **Valle Esmeralda**, candidata Laura Medina (las imágenes son ilustraciones generadas, no personas reales).

- Sitio público: http://localhost:3000/s/demo/
- Panel: http://localhost:3000/

| Código | Email | Contraseña | Rol |
|---|---|---|---|
| `demo` | comando@valle-esmeralda.demo | demo1234 | Comando |
| `demo` | prensa@valle-esmeralda.demo | demo1234 | Comunicación |
| `demo` | referente@valle-esmeralda.demo | demo1234 | Referente (4 barrios) |
| `prueba` | admin@prueba.demo | prueba1234 | Campaña vacía → asistente |

`npm run seed -- --reset` regenera los datos.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila shared, server y web |
| `npm start` | Servidor de producción (API + sitio + panel) |
| `npm test` | Tests de la API |
| `npm run typecheck` | Chequeo de tipos |

## Documentación

- [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md): estructura, datos, API, sitio público.
- [docs/DECISIONES.md](docs/DECISIONES.md): decisiones y por qué.
- [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md): VPS, HTTPS, dominios propios, backups.
- [docs/modulos/](docs/modulos/): ficha de cada módulo.
- [AGENTS.md](AGENTS.md): reglas para trabajar con Codex o Claude Code.
