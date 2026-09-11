import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { trace } from '@opentelemetry/api';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

// Bounds what a client-supplied header can do once it's echoed back in the
// response header, logged on every line for the request (pino-http's access
// log, AllExceptionsFilter's error log), and rendered in Swagger/clients as
// a plain string: no control characters (log-line injection), no unbounded
// length, and nothing that isn't safe to drop straight into a header value.
// A trace id (32 lowercase hex) and a typical UUID both satisfy this; it's
// deliberately wider than either so a caller's own request-id scheme keeps
// working.
const MAX_CORRELATION_ID_LENGTH = 128;
const VALID_CORRELATION_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

function isValidCorrelationId(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= MAX_CORRELATION_ID_LENGTH &&
    VALID_CORRELATION_ID_PATTERN.test(value)
  );
}

// Deliberately a raw Fastify `onRequest` hook rather than a Nest
// interceptor or guard: both of those only run once a route has matched,
// so a request to an unknown path (404, no controller at all) would reach
// AllExceptionsFilter with no correlationId ever set. onRequest fires for
// every request — matched or not — same as the Express middleware this
// replaces did via `forRoutes('*')`. It has to be registered directly on
// the Fastify instance because Nest middleware itself doesn't have this
// property under Fastify: it runs through middie, which hands `use()` the
// raw Node IncomingMessage rather than the FastifyRequest every downstream
// consumer (TransformInterceptor, AllExceptionsFilter) reads `correlationId`
// off. pino-http's own access log line reads the id back a different way —
// see the `customProps` comment on the pinoHttp config in app.module.ts.
export function registerCorrelationIdHook(instance: FastifyInstance): void {
  instance.addHook('onRequest', (request, reply, done) => {
    const incoming = request.headers[CORRELATION_ID_HEADER];
    const incomingValue = Array.isArray(incoming) ? incoming[0] : incoming;
    const trimmedIncomingValue = incomingValue?.trim();
    const correlationId =
      trimmedIncomingValue && isValidCorrelationId(trimmedIncomingValue)
        ? trimmedIncomingValue
        : generateCorrelationId();

    request.correlationId = correlationId;
    // Also stashed on the raw IncomingMessage — see the fastify.d.ts comment
    // — since pino-http's access log (app.module.ts's pinoHttp.customProps)
    // reads it from there, not from the FastifyRequest wrapper.
    request.raw.correlationId = correlationId;
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
// A client-supplied x-correlation-id that passes isValidCorrelationId()
// above is still honoured as given, taking priority over the trace id — so
// the two can legitimately diverge for a client-driven correlation id. A
// header that fails validation (too long, or outside the allowed charset)
// falls back to this instead, the same as no header at all.
function generateCorrelationId(): string {
  return trace.getActiveSpan()?.spanContext().traceId ?? randomUUID();
}
