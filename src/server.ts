import { env } from "./config/environment-config.js";
import { app } from "./app.js";

app.listen(env.PORT, () => {
  console.log(`🚀 Server running on port ${env.PORT} (${env.NODE_ENV})`);
});
