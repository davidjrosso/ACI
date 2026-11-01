import { config } from "./config.js";
import { construirApp } from "./app.js";

const app = await construirApp(config);

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, async () => {
    app.log.info(`Recibido ${senal}, cerrando...`);
    await app.close();
    process.exit(0);
  });
}

await app.listen({ port: config.port, host: config.host });
