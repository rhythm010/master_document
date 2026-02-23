import pinoHttp from 'pino-http';
import crypto from 'crypto';
import { Request } from 'express';
import { logger } from '../config/logger';

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    return requestId;
  },
  customProps: (req) => {
    const request = req as Request;
    return {
      userId: request.user?.id,
      role: request.user?.role,
    };
  },
});
