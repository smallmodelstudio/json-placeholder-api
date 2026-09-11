import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { ServiceUnavailableException } from '@nestjs/common';
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

  describe('live', () => {
    it('checks no indicators, so it never depends on the upstream', async () => {
      const result = {
        status: 'ok' as const,
        info: {},
        error: {},
        details: {},
      };
      health.check.mockResolvedValueOnce(result);

      const response = await controller.live();

      expect(response).toBe(result);
      expect(health.check).toHaveBeenCalledWith([]);
      expect(http.pingCheck).not.toHaveBeenCalled();
    });
  });

  describe('ready', () => {
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

      const response = await controller.ready();

      expect(response).toBe(result);
      expect(http.pingCheck).toHaveBeenCalledWith(
        'upstream',
        'https://jsonplaceholder.typicode.com/posts/1',
      );
    });

    it('rethrows a failed check with a message naming the failed check', async () => {
      const failure = new ServiceUnavailableException({
        status: 'error',
        info: {},
        error: { upstream: { status: 'down' } },
        details: {},
      });
      health.check.mockRejectedValueOnce(failure);

      await expect(controller.ready()).rejects.toMatchObject({
        message: 'Health check failed: upstream',
      });
    });

    it('rethrows a non-Terminus error unchanged', async () => {
      const error = new Error('boom');
      health.check.mockRejectedValueOnce(error);

      await expect(controller.ready()).rejects.toBe(error);
    });
  });
});
