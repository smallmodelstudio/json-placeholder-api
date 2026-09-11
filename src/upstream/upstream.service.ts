import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosRequestConfig } from 'axios';
import axios from 'axios';
import { firstValueFrom, Observable, timer } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { AppConfig } from '../config/config.types';
import {
  UpstreamErrorType,
  UpstreamException,
} from '../common/exceptions/upstream.exception';
import { UpstreamRequestOptions } from './interfaces/upstream-request.interface';
import { MetricsService } from '../common/metrics/metrics.service';

@Injectable()
export class UpstreamService {
  private readonly logger = new Logger(UpstreamService.name);
  private readonly maxRetries: number;

  constructor(
    private readonly httpService: HttpService,
    configService: ConfigService<AppConfig, true>,
    private readonly metrics: MetricsService,
  ) {
    this.maxRetries = configService.get('http.maxRetries', { infer: true });
  }

  get<T>(path: string, options?: UpstreamRequestOptions): Promise<T> {
    return this.request<T>({
      method: 'GET',
      url: path,
      ...this.toAxiosOptions(options),
    });
  }

  post<T>(
    path: string,
    body?: unknown,
    options?: UpstreamRequestOptions,
  ): Promise<T> {
    return this.request<T>({
      method: 'POST',
      url: path,
      data: body,
      ...this.toAxiosOptions(options),
    });
  }

  put<T>(
    path: string,
    body?: unknown,
    options?: UpstreamRequestOptions,
  ): Promise<T> {
    return this.request<T>({
      method: 'PUT',
      url: path,
      data: body,
      ...this.toAxiosOptions(options),
    });
  }

  patch<T>(
    path: string,
    body?: unknown,
    options?: UpstreamRequestOptions,
  ): Promise<T> {
    return this.request<T>({
      method: 'PATCH',
      url: path,
      data: body,
      ...this.toAxiosOptions(options),
    });
  }

  delete<T>(path: string, options?: UpstreamRequestOptions): Promise<T> {
    return this.request<T>({
      method: 'DELETE',
      url: path,
      ...this.toAxiosOptions(options),
    });
  }

  // `exactOptionalPropertyTypes` forbids assigning `params`/`headers`
  // explicitly as `undefined` onto `AxiosRequestConfig` — the key must be
  // absent rather than present-with-undefined, hence the conditional spread.
  private toAxiosOptions(
    options?: UpstreamRequestOptions,
  ): Pick<AxiosRequestConfig, 'params' | 'headers'> {
    return {
      ...(options?.params !== undefined && { params: options.params }),
      ...(options?.headers !== undefined && { headers: options.headers }),
    };
  }

  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    const response$ = this.httpService.request<T>(config).pipe(
      retry({
        count: this.maxRetries,
        delay: (error: unknown, retryCount) =>
          this.retryDelay(error, retryCount, config),
      }),
      catchError((error: unknown) => {
        throw this.mapError(error, config);
      }),
    );

    const response = await firstValueFrom(response$);
    return response.data;
  }

  private retryDelay(
    error: unknown,
    retryCount: number,
    config: AxiosRequestConfig,
  ): Observable<number> {
    if (!this.isRetryable(error)) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const backoffMs = 2 ** (retryCount - 1) * 100;
    this.logger.warn(
      `Retrying ${this.describe(config)} (attempt ${retryCount}/${this.maxRetries}) after ${backoffMs}ms`,
    );
    this.metrics.recordUpstreamRetry();
    return timer(backoffMs);
  }

  private isRetryable(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }
    if (!error.response) {
      // Network error or connection timeout — worth another attempt.
      return true;
    }
    return error.response.status >= 500;
  }

  private mapError(
    error: unknown,
    config: AxiosRequestConfig,
  ): UpstreamException {
    const context = this.describe(config);

    if (!axios.isAxiosError(error)) {
      return new UpstreamException(
        UpstreamErrorType.NETWORK_ERROR,
        `Unexpected error calling upstream: ${context}`,
        undefined,
        error,
      );
    }

    if (error.code === 'ECONNABORTED') {
      return new UpstreamException(
        UpstreamErrorType.TIMEOUT,
        `Upstream request timed out: ${context}`,
        undefined,
        error,
      );
    }

    if (!error.response) {
      return new UpstreamException(
        UpstreamErrorType.NETWORK_ERROR,
        `Upstream request failed: ${context}`,
        undefined,
        error,
      );
    }

    return new UpstreamException(
      UpstreamErrorType.BAD_RESPONSE,
      `Upstream responded with ${error.response.status}: ${context}`,
      error.response.status,
      error,
    );
  }

  private describe(config: AxiosRequestConfig): string {
    return `${String(config.method)} ${String(config.url)}`;
  }
}
