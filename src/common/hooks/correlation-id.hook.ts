import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { trace } from '@opentelemetry/api';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Deliberately a raw Fastify `onRequest` hook rather than a Nest
// interceptor or guard: both of those only run once a route has matched,
// so a request to an unknown path (404, no controller at all) would reach
// AllExceptionsFilter with no correlationId ever set. onRequest fires for
// every request — matched or not — same as the Express middleware this
// replaces did via `forRoutes('*')`. It has to be registered directly on
// the Fastify instance because Nest middleware itself doesn't have this
// property under Fastify: it runs through middie, which hands `use()` the
// raw Node IncomingMessage rather than the FastifyRequest every downstream
// consumer (LoggingInterceptor, TransformInterceptor, AllExceptionsFilter)
// reads `correlationId` off.
export function registerCorrelationIdHook(instance: FastifyInstance): void {
  instance.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers[CORRELATION_ID_HEADER];
    const incomingValue = Array.isArray(incoming) ? incoming[0] : incoming;
    const correlationId =
      incomingValue && incomingValue.trim().length > 0
        ? incomingValue
        : generateCorrelationId();

    request.correlationId = correlationId;
    void reply.header(CORRELATION_ID_HEADER, correlationId);
    done();
  });
}

// `instrumentation-http` (loaded by instrumentation.ts, before Nest even
// boots) starts a span for the incoming request before Fastify's own
// routing/hooks run, so it's already the active span by the time this hook
// fires — reusing its trace id as the default correlationId means the same
// identifier threads through the response envelope, the access log line,
// and every pino log line for the request (via
// @opentelemetry/instrumentation-pino's log correlation). Without the SDK
// running (unit/e2e tests, `nest start` without `--import`) there's no
// active span, so this falls back to randomUUID().
//
// A client-supplied x-correlation-id is still honoured as-is above — the
// API's existing contract of echoing back whatever the caller sent takes
// priority over the trace id in that case, so the two can legitimately
// diverge for a client-driven correlation id.
function generateCorrelationId(): string {
  return trace.getActiveSpan()?.spanContext().traceId ?? randomUUID();
}
