import "dotenv/config";
import { loadConfig } from "./config.js";
import { createApp } from "./app.js";

try {
  const config = await loadConfig();
  const app = await createApp({ config });
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    app.log.info({ signal }, "Stopping backend and draining active work");
    // The container stop timeout must be longer than this deadline.
    const deadline = setTimeout(() => {
      app.log.error("Graceful shutdown timed out");
      process.exit(1);
    }, 270_000);
    deadline.unref();
    try {
      await app.close();
    } catch (error) {
      app.log.error(error);
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
  try {
    await app.listen({ host: "0.0.0.0", port: config.port });
  } catch (error) {
    app.log.error(error);
    await app.close();
    process.exitCode = 1;
  }
} catch (error) {
  console.error("Backend startup failed:", error instanceof Error ? error.message : "Unknown error");
  process.exitCode = 1;
}
