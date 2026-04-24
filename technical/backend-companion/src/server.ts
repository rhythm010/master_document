import { app } from "./app";
import { config } from "./shared/config";
import { logger } from "./shared/logger";

// Start the HTTP server on the configured port.
app.listen(config.port, () => {
  logger.info({ port: config.port }, "server started");
});
