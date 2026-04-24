import { app } from "./app";
import { config } from "./shared/config";
import { logger } from "./shared/logger";

app.listen(config.port, () => {
  logger.info({ port: config.port }, "server started");
});
