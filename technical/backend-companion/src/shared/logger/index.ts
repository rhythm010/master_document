import pino from "pino";
import process from "node:process";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info"
});
