export interface AppConfig {
  env: string;
  port: number;
  http: {
    baseUrl: string;
    timeoutMs: number;
    maxRetries: number;
  };
}
