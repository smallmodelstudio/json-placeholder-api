<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

A [NestJS](https://nestjs.com/) proxy API in front of [JSONPlaceholder](https://jsonplaceholder.typicode.com/), adding typed DTOs, validation, retries/timeouts, and a consistent response/error envelope.

### A note on writes

`POST`/`PUT`/`PATCH`/`DELETE` on `/posts` are fully implemented and proxy straight through to JSONPlaceholder, but **JSONPlaceholder fakes persistence**: it returns a plausible response (e.g. a new `id` on create) without actually storing anything server-side. A `GET` immediately after a write will not reflect the change. This is upstream behavior, not a bug in this proxy.

### Production hardening

- **Caching:** GET responses are cached in-memory (`CACHE_TTL_MS`, default 30s) — check the `X-Cache: HIT`/`MISS` response header. `/health/*` is always excluded.
- **Rate limiting:** requests are capped per IP (`THROTTLE_LIMIT` per `THROTTLE_TTL_MS`, default 20 per 60s); exceeding it returns `429`. `/health/*` is exempt so infra probes are never throttled.
- **Health checks:** `GET /health/live` reports whether the process is up, with no dependency checks — point Kubernetes' liveness probe here. `GET /health/ready` pings JSONPlaceholder and returns `503` if it's unreachable — point the readiness probe here.

### API documentation

Interactive Swagger UI is served at `/docs` (raw OpenAPI JSON at `/docs-json`) once the app is running. DTO and entity schemas are generated automatically by the `@nestjs/swagger` CLI plugin from their TypeScript types and existing `class-validator` decorators — they aren't hand-annotated. Every documented success response reflects the real `{ data, meta }` envelope (see `src/common/decorators/api-envelope-response.decorator.ts`), not the bare entity type, since that's what a client actually receives.

## Architecture

```text
Controller → Service → UpstreamService (HttpService/axios) → jsonplaceholder.typicode.com
```

- **`UpstreamService`** (`src/upstream/`) is the single choke point for all outbound HTTP: typed `get/post/put/patch/delete`, retry with backoff on 5xx/network errors (never on 4xx), and axios-error → `UpstreamException` mapping. Feature services never touch `HttpService` directly.
- **Six resource modules** (`src/modules/`) each follow the same shape — `entities/`, `dto/{query,create,update}-*.dto.ts`, service, controller — hand-written per resource rather than a generic base class, since premature generics tend to fight Nest's DI system at this scale. Nested routes (e.g. `/posts/:id/comments`) are owned by the parent resource's controller, delegating to the child resource's service.
- **Cross-cutting concerns live in `AppModule`**, not `main.ts`: global `ValidationPipe`, `AllExceptionsFilter`, the `Logging`/`Transform`/`Cache`/`Timeout` interceptor chain, and `ThrottlerGuard` are all registered as `APP_*` providers. Both `main.ts` and the E2E test bootstrap (`test/support/create-test-app.ts`) just instantiate `AppModule`, so they can never drift out of sync with each other.
- **Every success response** is wrapped `{ data, meta: { timestamp, correlationId } }`; **every error** — validation failures, upstream errors, unhandled exceptions — is normalized to `{ statusCode, message, error, path, timestamp, correlationId }` by a single `AllExceptionsFilter`.
- Full rationale and phase-by-phase decisions are logged in `PROGRESS.md` as they were made — it's the fuller design record behind the summary above.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests (nocked upstream — never touches the real network)
$ npm run test:e2e

# test coverage
$ npm run test:cov

# contract tests — opt-in, hits the real jsonplaceholder.typicode.com to
# catch upstream drift that the nock-based e2e fixtures can't
$ npm run test:contract
```

## Deployment

### Docker

```bash
# build the image (multi-stage — see Dockerfile)
$ docker build -t json-placeholder-api:local .

# or via compose, which also reads .env.example for local config
$ docker compose up --build
```

The image runs as non-root `node`, forwards `SIGTERM` via `dumb-init` so
`app.enableShutdownHooks()` (`src/app.module.ts`) actually fires, and exposes
`GET /health/live` as its `HEALTHCHECK`.

### Kubernetes (local, via k3d)

Manifests live under `k8s/`: `base/` has the Deployment, Service, Ingress,
ConfigMap, HPA, and PodDisruptionBudget; `overlays/local/` and
`overlays/prod/` patch them per environment with Kustomize. Only `local` has
been applied against a real cluster — `prod` is written to the same shape
but points at placeholder registry/host values until a real cluster exists.

The loop, build → import → apply → curl:

```bash
# 1. spin up a k3d cluster with an attached local registry
$ ./k8s/k3d/create-cluster.sh

# 2. build and push the image to that registry (published on localhost:5000)
$ docker build -t localhost:5000/json-placeholder-api:local .
$ docker push localhost:5000/json-placeholder-api:local

# 3. apply the local overlay (1 replica, dev logging, Traefik ingress)
$ kubectl apply -k k8s/overlays/local
$ kubectl rollout status deployment/json-placeholder-api

# 4. hit it through Traefik — no /etc/hosts edit needed, just set Host
$ curl -H 'Host: api.localhost' http://localhost:8080/posts/1
$ curl -H 'Host: api.localhost' http://localhost:8080/docs

# tear down
$ ./k8s/k3d/delete-cluster.sh
```

Two things worth knowing if you poke at this further:

- **The image ref inside the cluster is not `localhost:5000/...`.** The host
  can reach the registry at `localhost:5000` because k3d publishes that
  port, but the node's containerd only has a registry mirror configured for
  `k3d-jsonplaceholder-registry:5000` (see `k8s/k3d/create-cluster.sh`'s
  `--registry-use`) — that's what `overlays/local`'s `images:` transformer
  rewrites the tag to. Pushing to `localhost:5000` and deploying
  `k3d-jsonplaceholder-registry:5000/...` is the same image; they're just
  two different hostnames for the same registry container, seen from two
  different network namespaces.
- **`livenessProbe` → `/health/live`, `readinessProbe` → `/health/ready`**
  (`k8s/base/deployment.yaml`), matching the split from the Docker phase —
  liveness never depends on the upstream, so a bad JSONPlaceholder day
  doesn't trigger a restart loop.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
