# Instrucciones para agentes (Codex, Claude Code)

## Antes de tocar código
1. Leé `README.md`, `docs/ARQUITECTURA.md` y `docs/DECISIONES.md`.
2. Revisá `git status`, la rama y la versión en `package.json`.

## Reglas
- **El contrato vive en `shared/src/index.ts`.** Cualquier cambio de modelo empieza ahí; servidor y web lo consumen.
- **Nunca editar una migración publicada.** Agregar `server/src/db/migrations/campania/00N_descripcion.sql`.
- **El alcance territorial se aplica en el servidor** (`filtroBarrios` / `verificarBarrio`). Toda consulta nueva sobre vecinos, interacciones o reclamos debe usarlo.
- **Rutas finas, servicios gruesos:** las rutas validan con zod y llaman a `servicios/`.
- **Nada de envíos automáticos por WhatsApp** ni librerías no oficiales (ver DECISIONES.md).
- **Datos personales:** toda exportación o borrado pasa por `auditar()`.
- **Sitio público:** todo HTML se arma con la plantilla `html` de `server/src/sitio/html.ts` (escapa por defecto). Nunca concatenar texto del usuario sin escapar.
- **Módulos:** cada módulo nuevo va en su rama, con su migración, sus tests y su ficha en `docs/modulos/`. Código reutilizable del prototipo: rama `referencia/prototipo-v0.1`.
- Textos de interfaz en español rioplatense. Fechas dd/mm/aaaa. CSV con `;`.
- No hardcodear nombres de campaña, ciudad ni personas en el código (salvo en `server/src/seed/`).
- Cada cambio sube la versión de forma consistente en los `package.json` (raíz, shared, server, web).

## Verificar antes de entregar
```bash
npm run typecheck
npm test
npm run build
```
Agregar un test en `server/test/` para cada regla de negocio nueva (especialmente permisos).

## Deploy
Requiere autorización explícita. Primero backup verificado de `data/` y prueba de migración sobre una copia. Nunca reemplazar la base de producción con la de desarrollo ni publicar archivos `.db`, `.env` o `*.local.md`.
