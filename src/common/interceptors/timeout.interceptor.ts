import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  catchError,
  Observable,
  throwError,
  timeout,
  TimeoutError,
} from 'rxjs';
import { AppConfig } from '../../config/config.types';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  private readonly timeoutMs: number;

  constructor(configService: ConfigService<AppConfig, true>) {
    const { timeoutMs, maxRetries } = configService.get('http', {
      infer: true,
    });
    // UpstreamService's own worst case is roughly timeoutMs * (maxRetries + 1)
    // (one attempt per retry, each bounded by axios's own timeout) plus a
    // small, negligible backoff delay between attempts. This is a backstop
    // for the whole request, not the upstream call specifically, so its
    // budget must comfortably clear that worst case — one extra full
    // timeoutMs of headroom does that without needing to model backoff
    // precisely. Under normal conditions the axios-level timeout (mapped to
    // a 504 via UpstreamException) fires first; this only catches requests
    // stuck for some other reason.
    this.timeoutMs = timeoutMs * (maxRetries + 2);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new GatewayTimeoutException());
        }
        return throwError(() => error as Error);
      }),
    );
  }
}
