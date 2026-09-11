import { Environment } from './env.validation';

export interface AppConfig {
  env: Environment;
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
