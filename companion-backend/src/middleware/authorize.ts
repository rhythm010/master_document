import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../shared/errors';
import { AuthRole } from '../shared/types';

export function authorize(...allowedRoles: AuthRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Access denied');
    }
    next();
  };
}
