import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, HttpHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: Mock };
  let http: { pingCheck: Mock };
  let configService: { get: Mock };

  beforeEach(async () => {
    health = { check: vi.fn() };
    http = { pingCheck: vi.fn() };
    configService = {
      get: vi.fn().mockReturnValue('https://jsonplaceholder.typicode.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: health },
        { provide: HttpHealthIndicator, useValue: http },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    controller = module.get(HealthController);
  });

  describe('check', () => {
    it('pings a lightweight upstream endpoint via HealthCheckService', async () => {
      const result = {
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      };
      health.check.mockImplementationOnce(
        async (indicators: Array<() => Promise<unknown>>) => {
          await Promise.all(indicators.map((indicator) => indicator()));
          return result;
        },
      );
      http.pingCheck.mockResolvedValueOnce({ upstream: { status: 'up' } });

      const response = await controller.check();

      expect(response).toBe(result);
      expect(http.pingCheck).toHaveBeenCalledWith(
        'upstream',
        'https://jsonplaceholder.typicode.com/posts/1',
      );
    });
  });
});
