export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public retryAfterSeconds?: number) {
    super(message);
    this.name = 'AppError';
  }
}
