import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';

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
        : randomUUID();

    request.correlationId = correlationId;
    void reply.header(CORRELATION_ID_HEADER, correlationId);
    done();
  });
}
