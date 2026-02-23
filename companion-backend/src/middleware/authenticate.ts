import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from '../shared/errors';
import { AuthRole } from '../shared/types';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    throw new AppError(401, 'NO_TOKEN', 'Authorization header missing');
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string; role: string };
    req.user = { id: payload.sub, role: payload.role as AuthRole };
    return next();
  } catch {
    throw new AppError(401, 'INVALID_TOKEN', 'Invalid token');
  }
}
