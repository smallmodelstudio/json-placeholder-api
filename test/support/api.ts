import { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';
import request from 'supertest';

/**
 * supertest entry point for a booted test app: `api(app).get('/foo')`.
 *
 * Nest declares `INestApplication.getHttpServer()` as `any`, so handing it
 * straight to `request()` trips `@typescript-eslint/no-unsafe-argument` at
 * every call site. The adapter really does hand back a Node `http.Server`
 * (Fastify's own), so the assertion below is honest — this keeps it in one
 * place instead of repeating it (or a disable comment) across every spec.
 */
export function api(app: INestApplication): request.Agent {
  return request(app.getHttpServer() as Server);
}
