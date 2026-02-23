import { logger } from '../config/logger';

export async function runLocationLogCleanup() {
  logger.info('Location log cleanup skipped (no location log model in Phase 1 schema)');
}
