import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  vi,
  Mock,
  MockInstance,
} from 'vitest';
import { Logger } from '@nestjs/common';
import { registerShutdownHandler } from './register-shutdown-handler';

describe('registerShutdownHandler', () => {
  let handler: Mock<() => Promise<unknown>>;
  let errorSpy: MockInstance;

  beforeEach(() => {
    handler = vi.fn();
    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
  });

  it('invokes the handler when a registered signal fires', () => {
    handler.mockResolvedValue(undefined);
    registerShutdownHandler(handler, ['SIGTERM']);

    process.emit('SIGTERM');

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('defaults to SIGTERM and SIGINT', () => {
    handler.mockResolvedValue(undefined);
    registerShutdownHandler(handler);

    process.emit('SIGTERM');
    process.emit('SIGINT');

    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('logs rather than throwing when the handler rejects', async () => {
    handler.mockRejectedValue(new Error('collector unreachable'));
    registerShutdownHandler(handler, ['SIGTERM']);

    expect(() => process.emit('SIGTERM')).not.toThrow();
    // Let the handler's rejection reach the .catch() microtask.
    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('SIGTERM'),
      expect.any(String),
    );
  });
});
