import type { Request, Response, NextFunction } from "express";

// eslint-disable-next-line no-unused-vars
type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

// Wrap an async Express handler and forward errors to next().
export function asyncHandler(fn: AsyncHandler) {
  // Ensure rejected promises are passed to Express error handling.
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
