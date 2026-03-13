import pino from "pino";
import { env } from "./environment-config.js";

const isDev = env.NODE_ENV === "development";

/** Structured logger — JSON in production, pretty-printed in development */
export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  base: { pid: process.pid },
  ...(isDev && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, translateTime: "SYS:standard" },
    },
  }),
});
