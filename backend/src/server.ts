import "dotenv/config";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

const config = await loadConfig();
const app = await createApp({ config });
try {
  await app.listen({ host: "0.0.0.0", port: config.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
