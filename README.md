# JSONPlaceholder Proxy API

A NestJS API in front of [JSONPlaceholder](https://jsonplaceholder.typicode.com)
that adds validation, caching, rate limiting, retries and a consistent response
envelope.

The API is deliberately simple. The repo is a sandbox for learning NestJS and the
platform around it: testing, containers, Kubernetes, CI/CD and telemetry.

**Stack:** NestJS 12 · Fastify 5 · TypeScript 6 (type-checked by tsgo) · Zod ·
Vitest · Docker · k3d + Kustomize · Harness · OpenTelemetry

## Key features

- Six resources (posts, users, comments, todos, albums, photos) plus nested routes
- Every response wrapped in `{ data, meta }`; every error in a single error envelope
- A correlation ID on every request, shared with the OpenTelemetry trace ID
- Response caching, per-IP rate limiting, upstream retries with backoff, timeouts
- Liveness and readiness health checks; Swagger UI at `/docs`
- Unit, e2e and contract tests as three Vitest projects
- Multi-stage Docker image, Kustomize manifests for k3d, Harness pipelines as code

## Quick start

```bash
nvm use
npm install
npm run start:dev
```

Open <http://localhost:3000/docs>.

## Repository map

| Path | Contents | Docs |
| --- | --- | --- |
| `package.json`, `.env.example` | Scripts, configuration | [Getting started](docs/README-getting-started.md) |
| `src/` | Application code | [Architecture](docs/README-architecture.md) |
| `test/` | e2e and contract tests, test helpers | [Testing](docs/README-testing.md) |
| `eslint.config.mjs`, `tsconfig.json` | Lint, format and compiler rules | [Code quality](docs/README-code-quality.md) |
| `Dockerfile`, `docker-compose.yml`, `k8s/` | Image, local stack, Kustomize manifests | [Docker & Kubernetes](docs/README-docker-k8s.md) |
| `.harness/` | CI/CD pipelines | [Harness](docs/README-harness.md) |
| `src/instrumentation.ts` | OpenTelemetry setup | [Telemetry](docs/README-telemetry.md) |
