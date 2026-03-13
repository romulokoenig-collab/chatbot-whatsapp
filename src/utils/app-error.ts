/** Structured application error with HTTP status code and machine-readable code */
export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string): AppError {
    return new AppError(message, 400, "BAD_REQUEST");
  }

  static notFound(message: string): AppError {
    return new AppError(message, 404, "NOT_FOUND");
  }

  static internal(message: string): AppError {
    return new AppError("Internal server error", 500, "INTERNAL_ERROR");
  }
}
