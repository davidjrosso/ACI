# Arquitectura

## Vista general

```
territorio/
├── shared/          Contrato común: tipos + validaciones (zod) + utilidades
├── server/          API Fastify + SQLite (una base por campaña)
│   ├── src/db/migrations/platform/   Esquema de la base de plataforma
│   ├── src/db/migrations/campania/   Esquema de cada campaña
│   ├── src/servicios/                Lógica de negocio por módulo
│   ├── src/routes/                   Rutas HTTP (finas: validan y llaman servicios)
│   └── src/seed/                     Datos de ejemplo
├── web/             PWA React (Vite) — mobile-first, offline
└── data/            (no versionado) plataforma.db + campanias/<slug>.db
```

Un solo proceso Node sirve la API (`/api/*`) y la web compilada. Sin servicios externos obligatorios.

## Multi-campaña: una base SQLite por campaña

- `data/plataforma.db`: registro de campañas y sesiones.
- `data/campanias/<slug>.db`: todo lo de una campaña (config, barrios, usuarios, vecinos, etc.).

Ventajas: aislamiento total entre candidatos (un error de filtro no puede filtrar datos de otro cliente), backup = copiar un archivo, baja = borrar un archivo, migraciones por campaña. Para decenas de campañas chicas sobra. Si algún día hace falta, el paso a PostgreSQL con un esquema por campaña es directo porque todo el SQL está en `servicios/`.

## Modelo de datos (campaña)

**Parametrización (lo único que se configura):**

| Tabla | Contenido |
|---|---|
| `config` | JSON con nombre, candidato, ciudad, colores, fecha de elección, mapa |
| `barrios` | nombre, polígono GeoJSON opcional, objetivo de contactos |
| `temas` | categorías de reclamos e intereses |
| `plantillas` | mensajes para WhatsApp asistido (`{nombre}`, `{barrio}`, `{candidato}`) |
| `usuarios` + `usuario_barrios` | equipo, rol y barrios asignados |

**Datos operativos (estructura fija):**

| Tabla | Contenido |
|---|---|
| `vecinos` | datos de contacto, barrio, apoyo, etiquetas (JSON), consentimiento y su fecha |
| `interacciones` | cada contacto: puerta, WhatsApp, teléfono o evento; resultado, apoyo, tema |
| `reclamos` | reclamo o propuesta, tema, barrio, estado, ubicación |
| `actividades` | agenda |
| `auditoria` | quién creó, modificó, exportó o borró datos personales |

Todos los IDs son UUID: el celular puede crear registros sin conexión sin chocar con otros.

## Roles y alcance territorial

| | Comando | Referente | Voluntario |
|---|---|---|---|
| Ve | toda la ciudad | sus barrios | sus barrios |
| Vecinos | todo + exportar CSV | crear, editar, dar de baja | crear, editar |
| Reclamos | todo | todo en sus barrios | cargar; editar los propios |
| Agenda | todo | sus barrios | solo lectura |
| Configuración | sí | no | no |

El filtro territorial se aplica **en el servidor** (`servicios/comun.ts → filtroBarrios / verificarBarrio`), nunca solo en la interfaz.

## Offline (timbreo)

1. La PWA guarda en IndexedDB la sesión, los catálogos y una copia de los vecinos de los barrios del usuario.
2. Cada visita se encola con un UUID generado en el celular.
3. La cola se envía a `POST /api/interacciones/lote` al guardar, al volver la señal y cada 30 segundos.
4. El servidor es **idempotente**: si un id ya existe, lo cuenta como duplicado y no lo vuelve a guardar. Reintentar nunca duplica.
5. Si una visita es rechazada (por ejemplo, barrio no asignado), queda marcada con el error y el voluntario puede descartarla.
6. Un vecino nuevo cargado en la puerta viaja dentro de la visita; si su teléfono ya existe, se vincula al vecino existente.

## API (resumen)

| Método | Ruta | Rol |
|---|---|---|
| POST | `/api/auth/login` · `/api/auth/logout` | — |
| GET | `/api/auth/sesion` · `/api/catalogos` | todos |
| PUT | `/api/config` | comando |
| CRUD | `/api/barrios` · `/api/temas` · `/api/plantillas` · `/api/usuarios` | comando |
| POST | `/api/barrios/importar-geojson` | comando |
| CRUD | `/api/vecinos` · GET `/api/vecinos/:id/historial` | por alcance |
| GET | `/api/vecinos/exportar.csv` | comando (auditado) |
| POST | `/api/interacciones/lote` · GET `/api/interacciones` | por alcance |
| CRUD | `/api/reclamos` · PATCH `/api/reclamos/:id/estado` | por alcance |
| CRUD | `/api/actividades` | comando / referente |
| GET | `/api/tablero` | por alcance |
| POST | `/api/plataforma/campanias` | header `x-platform-token` |

Toda entrada se valida con los esquemas zod de `shared/` (los mismos tipos que usa la web).

## Seguridad

- Contraseñas con scrypt; sesiones en cookie `httpOnly` + `SameSite=Lax`; en la base solo se guarda el hash del token.
- Límite de intentos de login por IP.
- Desactivar un usuario o cambiarle la contraseña cierra sus sesiones.
- Siempre queda al menos un usuario de comando activo.

## Ley 25.326 (datos personales)

Las opiniones políticas son **datos sensibles**. La plataforma ayuda a cumplir, no reemplaza el asesoramiento legal:

- Consentimiento explícito por vecino, con fecha.
- WhatsApp solo habilitado si hay consentimiento.
- Baja (derecho de supresión): anonimiza los datos personales y conserva solo la estadística.
- Auditoría de altas, cambios, exportaciones y bajas.
- Exportación restringida al rol comando.
