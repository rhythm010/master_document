import { app } from "./app";
import { config } from "./shared/config";
import { logger } from "./shared/logger";
import { startSessionInProgressSchedulers } from "./shared/schedulers/sessionInProgress.schedulers";

// Set timezone to GST (Gulf Standard Time - UTC+4)
process.env.TZ = process.env.TZ || "Asia/Dubai";

// Start the HTTP server on the configured port.
app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      timezone: process.env.TZ,
      schedulersEnabled: config.enableSchedulers
    },
    "server started"
  );

  if (config.enableSchedulers) {
    startSessionInProgressSchedulers();
  }
});
