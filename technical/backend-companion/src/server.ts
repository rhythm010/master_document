import { app } from "./app";
import { config } from "./shared/config";
import { logger } from "./shared/logger";

// Set timezone to GST (Gulf Standard Time - UTC+4)
process.env.TZ = process.env.TZ || "Asia/Dubai";

// Start the HTTP server on the configured port.
app.listen(config.port, () => {
  logger.info({ port: config.port, timezone: process.env.TZ }, "server started");
});
