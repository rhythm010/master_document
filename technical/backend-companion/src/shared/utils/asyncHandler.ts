import type { Request, Response, NextFunction } from "express";

// Wrap an async Express handler and forward errors to next().
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  // Ensure rejected promises are passed to Express error handling.
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
