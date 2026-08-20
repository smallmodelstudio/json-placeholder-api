import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl, correlationId } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(
            `${method} ${originalUrl} +${Date.now() - start}ms [${correlationId}]`,
          );
        },
        error: (error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `${method} ${originalUrl} failed +${Date.now() - start}ms [${correlationId}]: ${message}`,
          );
        },
      }),
    );
  }
}
