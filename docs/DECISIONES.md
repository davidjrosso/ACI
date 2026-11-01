# Decisiones

Registro de decisiones de producto y técnicas. Formato: fecha · decisión · por qué.

- **2026-11-01 · Producto propio y simple en lugar de CiviCRM.** CiviCRM es potente pero complejo de parametrizar para una campaña de ciudad chica. Se toma como referencia funcional, no como base.
- **2026-11-01 · Parametrizar solo cinco cosas: identidad, barrios, temas, equipo y plantillas.** El resto tiene estructura fija. Es lo que hace que se configure en una tarde.
- **2026-11-01 · El barrio es la unidad de trabajo.** Permisos, mapa, objetivos y tablero se organizan por barrio.
- **2026-11-01 · Apoyo con cuatro valores fijos (apoya, indeciso, no apoya, sin dato).** Se dejó fijo en lugar de parametrizable para que el tablero y el mapa sean comparables entre campañas.
- **2026-11-01 · WhatsApp asistido, nunca automático.** La política de WhatsApp Business prohíbe su uso a partidos, candidatos y campañas, y los envíos masivos con librerías no oficiales terminan en bloqueo. La plataforma abre `wa.me` con el mensaje listo; la persona lo envía desde su teléfono y el contacto queda registrado.
- **2026-11-01 · Una base SQLite por campaña.** Aislamiento, backups simples y bajo costo en un VPS. Ver ARQUITECTURA.md.
- **2026-11-01 · PWA en lugar de app nativa.** Se instala desde el navegador, se actualiza sola, no pasa por tiendas y funciona sin señal.
- **2026-11-01 · IDs UUID generados en el cliente.** Permiten cargar sin conexión y sincronizar de forma idempotente.
- **2026-11-01 · CSV con `;` y fechas dd/mm/aaaa.** Convención local: abre bien en Excel configurado en español.
- **2026-11-01 · Colores de apoyo validados para daltonismo** y siempre acompañados de texto; mapas con una sola tonalidad de claro a oscuro.
- **2026-11-01 · Sin mapa de fondo para la ciudad de ejemplo.** Valle Esmeralda es inventada; en una campaña real se activa "Mostrar calles de OpenStreetMap".
