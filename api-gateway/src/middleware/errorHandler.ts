import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[error] ${statusCode} — ${err.message}`, {
    stack: isProduction ? undefined : err.stack,
  });

  res.status(statusCode).json({
    error: {
      message: isProduction && statusCode === 500 ? 'Internal Server Error' : err.message,
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

/** Create an operational error with an HTTP status code */
export function createError(message: string, statusCode: number): AppError {
  const error: AppError = new Error(message);
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
}
