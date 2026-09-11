import { describe, it, beforeEach, afterAll, expect, vi, Mock } from 'vitest';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { context, trace } from '@opentelemetry/api';
import { AsyncHooksContextManager } from '@opentelemetry/context-async-hooks';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
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
    const request = { headers: {}, raw: {} } as unknown as FastifyRequest;
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
      raw: {},
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
      raw: {},
    } as unknown as FastifyRequest;
    const { reply } = makeReply();

    onRequest(request, reply, vi.fn());

    expect(request.correlationId).toBe('first-id');
  });

  it('ignores a blank incoming header and generates a new id', () => {
    const request = {
      headers: { [CORRELATION_ID_HEADER]: '   ' },
      raw: {},
    } as unknown as FastifyRequest;
    const { reply } = makeReply();

    onRequest(request, reply, vi.fn());

    expect(request.correlationId).not.toBe('   ');
    expect(request.correlationId.trim().length).toBeGreaterThan(0);
  });

  describe('with an active OTel span', () => {
    // The API package's default ContextManager is a no-op, so
    // context.with() below wouldn't actually make the span "active" — it'd
    // just call the callback directly — without a real one registered, the
    // same way instrumentation.ts's NodeSDK.start() registers one for the
    // running app.
    const contextManager = new AsyncHooksContextManager().enable();
    context.setGlobalContextManager(contextManager);
    afterAll(() => {
      context.disable();
    });

    const provider = new BasicTracerProvider();
    const tracer = provider.getTracer('correlation-id.hook.spec');

    it('uses the active span trace id as the generated correlation id', () => {
      const request = { headers: {}, raw: {} } as unknown as FastifyRequest;
      const { reply } = makeReply();
      const span = tracer.startSpan('incoming request');

      context.with(trace.setSpan(context.active(), span), () => {
        onRequest(request, reply, vi.fn());
      });
      span.end();

      expect(request.correlationId).toBe(span.spanContext().traceId);
    });

    it('still honours a client-supplied header over the active span', () => {
      const request = {
        headers: { [CORRELATION_ID_HEADER]: 'incoming-id-123' },
        raw: {},
      } as unknown as FastifyRequest;
      const { reply } = makeReply();
      const span = tracer.startSpan('incoming request');

      context.with(trace.setSpan(context.active(), span), () => {
        onRequest(request, reply, vi.fn());
      });
      span.end();

      expect(request.correlationId).toBe('incoming-id-123');
      expect(request.correlationId).not.toBe(span.spanContext().traceId);
    });
  });
});
