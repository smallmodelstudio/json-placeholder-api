export interface AppConfig {
  env: string;
  port: number;
  http: {
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
  };
  cache: {
    ttlMs: number;
  };
  throttle: {
    ttlMs: number;
    limit: number;
  };
}
