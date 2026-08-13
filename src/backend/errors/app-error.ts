/**
 * Application error hierarchy for consistent API responses.
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "TENANT_ISOLATION"
  | "SUBSCRIPTION_EXPIRED"
  | "COMPANY_SUSPENDED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    if (details) this.details = details;
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static forbidden(message = "Access denied"): AppError {
    return new AppError("FORBIDDEN", message, 403);
  }

  static notFound(entity: string, id?: string): AppError {
    return new AppError("NOT_FOUND", `${entity} not found${id ? `: ${id}` : ""}`, 404);
  }

  static validation(message: string, details?: Record<string, unknown>): AppError {
    return new AppError("VALIDATION_ERROR", message, 422, details);
  }

  static tenantIsolation(): AppError {
    return new AppError("TENANT_ISOLATION", "Cross-tenant access denied", 403);
  }

  static companySuspended(): AppError {
    return new AppError("COMPANY_SUSPENDED", "Company workspace is suspended", 403);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function toErrorResponse(error: unknown): { code: string; message: string; details?: Record<string, unknown> } {
  if (isAppError(error)) {
    return { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) };
  }
  return { code: "INTERNAL_ERROR", message: "An unexpected error occurred" };
}
