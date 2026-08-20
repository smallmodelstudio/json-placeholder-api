export interface SuccessEnvelope<T> {
  data: T;
  meta: {
    timestamp: string;
    correlationId: string;
  };
}

export interface ErrorEnvelope {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  correlationId: string;
}
