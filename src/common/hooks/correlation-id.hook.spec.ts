import { describe, it, beforeEach, expect, vi, Mock } from 'vitest';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CORRELATION_ID_HEADER,
  registerCorrelationIdHook,
} from './correlation-id.hook';

describe('registerCorrelationIdHook', () => {
  let onRequest: (
    request: FastifyRequest,
    reply: FastifyReply,
    done: () => void,
  ) => void;

  beforeEach(() => {
    const instance = {
      addHook: vi.fn((_event: string, handler: typeof onRequest) => {
        onRequest = handler;
      }),
    } as unknown as FastifyInstance;
    registerCorrelationIdHook(instance);
  });

  const makeReply = (): { reply: FastifyReply; header: Mock } => {
    const header = vi.fn();
    return { reply: { header } as unknown as FastifyReply, header };
  };

  it('generates a correlation id when none is supplied', () => {
    const request = { headers: {} } as unknown as FastifyRequest;
    const { reply, header } = makeReply();
    const done = vi.fn();

    onRequest(request, reply, done);

    expect(request.correlationId).toEqual(expect.any(String));
    expect(request.correlationId.length).toBeGreaterThan(0);
    expect(header).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      request.correlationId,
    );
    expect(done).toHaveBeenCalled();
  });

  it('reuses an incoming correlation id header', () => {
    const request = {
      headers: { [CORRELATION_ID_HEADER]: 'incoming-id-123' },
    } as unknown as FastifyRequest;
    const { reply, header } = makeReply();

    onRequest(request, reply, vi.fn());

    expect(request.correlationId).toBe('incoming-id-123');
    expect(header).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      'incoming-id-123',
    );
  });

  it('reuses the first value when the header is duplicated', () => {
    const request = {
      headers: { [CORRELATION_ID_HEADER]: ['first-id', 'second-id'] },
    } as unknown as FastifyRequest;
    const { reply } = makeReply();

    onRequest(request, reply, vi.fn());

    expect(request.correlationId).toBe('first-id');
  });

  it('ignores a blank incoming header and generates a new id', () => {
    const request = {
      headers: { [CORRELATION_ID_HEADER]: '   ' },
    } as unknown as FastifyRequest;
    const { reply } = makeReply();

    onRequest(request, reply, vi.fn());

    expect(request.correlationId).not.toBe('   ');
    expect(request.correlationId.trim().length).toBeGreaterThan(0);
  });
});
