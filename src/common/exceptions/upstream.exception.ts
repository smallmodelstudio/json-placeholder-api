export enum UpstreamErrorType {
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  BAD_RESPONSE = 'BAD_RESPONSE',
}

/**
 * Domain-level error for failures talking to the upstream API. Deliberately
 * not an HttpException — translating it into an HTTP response is the job of
 * an exception filter (AllExceptionsFilter), not of the code that detects
 * the failure.
 */
export class UpstreamException extends Error {
  constructor(
    public readonly type: UpstreamErrorType,
    message: string,
    public readonly upstreamStatus?: number,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'UpstreamException';
  }
}
