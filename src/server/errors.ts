/**
 * Typed application errors.
 *
 * Services throw these; the HTTP layer (src/server/http.ts) maps them to a
 * consistent JSON error shape. Anything that is NOT an AppError is treated as
 * an unexpected 500: logged with full detail, returned to the client generically.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "TOKEN_EXPIRED"
  | "TOO_MANY_REQUESTS"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type FieldErrors = Record<string, string>;

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly fields?: FieldErrors,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Some fields are invalid", fields?: FieldErrors) {
    super("VALIDATION_ERROR", 400, message, fields);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = "Please sign in to continue") {
    super("UNAUTHENTICATED", 401, message);
  }
}

/** The access token is valid but expired — the client should refresh and retry. */
export class TokenExpiredError extends AppError {
  constructor() {
    super("TOKEN_EXPIRED", 401, "Your session has expired");
  }
}

export class RateLimitedError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
  ) {
    super("TOO_MANY_REQUESTS", 429, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have permission to do this") {
    super("FORBIDDEN", 403, message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", 404, `${entity} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fields?: FieldErrors) {
    super("CONFLICT", 409, message, fields);
  }
}

/** A well-formed request that breaks a Registry rule (e.g. resubmitting after the deadline). */
export class BusinessRuleError extends AppError {
  constructor(message: string, fields?: FieldErrors) {
    super("BUSINESS_RULE", 422, message, fields);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message: string) {
    super("PAYLOAD_TOO_LARGE", 413, message, { file: message });
  }
}

export class UnsupportedMediaTypeError extends AppError {
  constructor(message: string) {
    super("UNSUPPORTED_MEDIA_TYPE", 415, message, { file: message });
  }
}
