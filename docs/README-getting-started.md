# Getting started

How to install, configure and run the API locally.

## Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 24, pinned in `.nvmrc` | Everything |
| Docker | Recent | The image and the local telemetry stack |
| k3d, kubectl | Recent | [Local Kubernetes](README-docker-k8s.md) |

## Run

```bash
nvm use
npm install
npm run start:dev
```

The app listens on port 3000.

| URL | Serves |
| --- | --- |
| <http://localhost:3000/docs> | Swagger UI |
| <http://localhost:3000/docs-json> | OpenAPI spec |
| <http://localhost:3000/posts/1> | An example request |

## Configuration

Settings come from environment variables. Every variable has a default, so none
are required. To override one locally, copy `.env.example` to `.env`, which is
gitignored and loaded automatically. Values are validated at startup
(`src/config/env.validation.ts`), and an invalid value stops the app from booting.

| Variable | Default | Controls |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development`, `production` or `test`; sets the log level |
| `PORT` | `3000` | Listen port |
| `UPSTREAM_BASE_URL` | `https://jsonplaceholder.typicode.com` | Proxied API |
| `UPSTREAM_TIMEOUT_MS` | `5000` | Timeout per upstream attempt |
| `UPSTREAM_MAX_RETRIES` | `2` | Retries on upstream 5xx or network errors |
| `CACHE_TTL_MS` | `30000` | How long GET responses stay cached |
| `THROTTLE_TTL_MS` | `60000` | Rate-limit window |
| `THROTTLE_LIMIT` | `20` | Requests allowed per window, per IP |

The `OTEL_*` variables are covered in [Telemetry](README-telemetry.md).

## npm scripts

| Script | Does |
| --- | --- |
| `start` | Run from source |
| `start:dev` | Run from source; restart on change |
| `start:debug` | Same as `start:dev`, plus the Node inspector |
| `build` | Compile to `dist/` |
| `start:prod` | Run the compiled build with OpenTelemetry loaded; run `build` first |
| `lint` | ESLint, applying auto-fixes |
| `format` | Prettier over `src/` and `test/` |
| `typecheck` | Type-check with tsgo; emits nothing |
| `test` | Unit tests |
| `test:watch` | Unit tests; re-run on change |
| `test:cov` | Unit tests with a coverage report |
| `test:debug` | Unit tests under the inspector, one file at a time |
| `test:e2e` | e2e tests against a mocked upstream |
| `test:contract` | Contract tests against the real upstream |
| `test:all` | All three test projects |

## Writes aren't persisted

`POST`, `PUT`, `PATCH` and `DELETE` succeed, but JSONPlaceholder fakes
persistence: it returns a plausible response and stores nothing. A `GET` straight
after a write won't reflect it. This is upstream behaviour, not a proxy bug.
