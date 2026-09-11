import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { registerCorrelationIdHook } from './common/hooks/correlation-id.hook';

// Shared by main.ts and test/support/create-test-app.ts so the two can't
// drift apart by hand — both need the exact same Fastify adapter options and
// the exact same onRequest hook registered before the app starts handling
// requests.

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    // Trust exactly the reverse proxy directly in front of this app
    // (Traefik, in every k8s overlay) so ThrottlerGuard's per-IP buckets
    // (which key on request.ip) see the real client IP from
    // X-Forwarded-For, not the proxy's own address — otherwise every
    // client behind the same proxy shares one bucket. Read directly from
    // process.env, the same as instrumentation.ts's OTEL_* variables:
    // ConfigService doesn't exist yet at this point in bootstrap. Off by
    // default — docker-compose and `npm run start*` expose the app
    // directly, with no proxy in front, and trusting a client-supplied
    // X-Forwarded-For there would let a client spoof its own rate-limit
    // identity.
    trustProxy: process.env['TRUST_PROXY'] === 'true',
  });
}

// registerCorrelationIdHook has to be registered directly on the Fastify
// instance rather than in AppModule (see its own doc comment for why), which
// means both entry points that create the app — main.ts and
// test/support/create-test-app.ts — have to call it themselves.
export function configureApp(app: NestFastifyApplication): void {
  registerCorrelationIdHook(app.getHttpAdapter().getInstance());
}
