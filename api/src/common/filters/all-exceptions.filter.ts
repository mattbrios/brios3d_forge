import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

// Toda resposta de erro sai como { "error": string }, sem stack trace.
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      response
        .status(exception.getStatus())
        .json({ error: messageOf(exception) });
      return;
    }

    const stack = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error('Unhandled exception', stack);
    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'Internal server error' });
  }
}

function messageOf(exception: HttpException): string {
  const body = exception.getResponse();
  if (typeof body === 'string') {
    return body;
  }
  const { message } = body as { message?: unknown };
  if (Array.isArray(message)) {
    return message.join('; ');
  }
  if (typeof message === 'string' && message.length > 0) {
    return message;
  }
  return exception.message;
}
