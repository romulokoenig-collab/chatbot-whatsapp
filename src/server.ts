import { env } from "./config/environment-config.js";
import { logger } from "./config/logger.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server running");
});
