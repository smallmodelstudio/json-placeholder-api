import 'fastify';
import 'node:http';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

// pino-http (via nestjs-pino's LoggerModule) runs as Nest middleware, which
// under Fastify receives the raw IncomingMessage (see
// registerCorrelationIdHook's own comment) rather than the FastifyRequest
// augmented above — so the id is duplicated onto `request.raw` for pino-http's
// customProps to read back.
declare module 'node:http' {
  interface IncomingMessage {
    correlationId?: string;
  }
}
