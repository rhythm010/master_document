"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLocationLogCleanup = runLocationLogCleanup;
const logger_1 = require("../config/logger");
async function runLocationLogCleanup() {
    logger_1.logger.info('Location log cleanup skipped (no location log model in Phase 1 schema)');
}
