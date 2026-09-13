# Docker & Kubernetes

How the app is packaged as an image and deployed to a local k3d cluster.

## Docker

```bash
docker build -t json-placeholder-api:local .
docker run --rm -p 3000:3000 --env-file .env.example json-placeholder-api:local

# or the app plus the telemetry backend (see Telemetry)
docker compose up --build
```

The `Dockerfile` has three stages:

| Stage | Does |
| --- | --- |
| `deps` | `npm ci` |
| `build` | `nest build`, then `npm prune --omit=dev` |
| `runtime` | Copies in only `dist/`, the pruned `node_modules/` and `package.json` |

The runtime image:

- **Runs as the non-root `node` user.**
- **Uses `dumb-init` as PID 1.** The kernel gives PID 1 no default signal
  handling, and PID 1 has to reap orphaned processes. `dumb-init` takes on both
  jobs and forwards `SIGTERM` to Node, so `app.enableShutdownHooks()` runs and the
  container stops promptly.
- **Health-checks `/health/live`** using Node's own `http` module, since the slim
  image has no curl.
- **Starts with `node --import ./dist/src/instrumentation.js`**, so OpenTelemetry
  loads before the app (see [Telemetry](README-telemetry.md)).

No config is baked in: `.dockerignore` excludes `.env*`, and settings are passed
at run time.

## Kubernetes

```text
k8s/
  base/               Deployment, Service, Ingress, ConfigMap, HPA, PodDisruptionBudget
  overlays/local/     k3d: 1 replica, NODE_ENV=development, host api.localhost, otel-lgtm
  overlays/prod/      3 replicas, larger resources; registry and host are
                      still placeholders, but CI promotes the tag (see
                      docs/README-harness.md)
  k3d/                create-cluster.sh, delete-cluster.sh
```

The base holds what every environment shares. Each overlay patches it using
Kustomize, so the manifests stay plain YAML with no templating.

| Resource | Key settings |
| --- | --- |
| Deployment | Liveness probe → `/health/live`, readiness probe → `/health/ready`; `envFrom` the ConfigMap; `terminationGracePeriodSeconds: 30`; `preStop` sleeps 5s before SIGTERM so the pod clears the Service's endpoints first; hardened `securityContext` (non-root, no privilege escalation, read-only root filesystem, all capabilities dropped) — pod-level `runAsUser: 1000` matches the Dockerfile's `USER node`, since kubelet can't verify `runAsNonRoot` against a named (non-numeric) image user on its own; no `replicas:` — the HPA owns that field |
| Service | ClusterIP, port 80 → container port 3000 |
| Ingress | Traefik; each overlay sets the host |
| ConfigMap | Same keys as `.env.example` |
| HPA | Scales on CPU (target 70%): 2–5 replicas in base, 1–3 in local |
| PodDisruptionBudget | `maxUnavailable: 1` (not `minAvailable`, so a single-replica overlay can still be drained) |

The two probes point at different endpoints on purpose. If liveness checked the
upstream, an upstream outage would make Kubernetes restart every pod, which fixes
nothing. Readiness failing only takes the pod out of the Service until the
upstream recovers.

### Local loop

Install k3d without sudo if needed:
`curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | K3D_INSTALL_DIR=$HOME/.local/bin USE_SUDO=false bash`

```bash
# 1. Create the cluster and its registry
./k8s/k3d/create-cluster.sh

# 2. Build the image and push it to the registry
docker build -t localhost:5000/json-placeholder-api:local .
docker push localhost:5000/json-placeholder-api:local

# 3. Deploy
kubectl apply -k k8s/overlays/local
kubectl rollout status deployment/json-placeholder-api

# 4. Call the app through Traefik
curl -H 'Host: api.localhost' http://localhost:8080/posts/1

# Tear down
./k8s/k3d/delete-cluster.sh
```

To see the manifests an overlay produces without applying them, run
`kubectl kustomize k8s/overlays/<name>`.

## Gotchas

- **The registry has two hostnames.** The host pushes to `localhost:5000`, but
  inside the cluster the node pulls from `k3d-jsonplaceholder-registry:5000`.
  They're the same registry, reached from different networks. The local overlay's
  `images:` entry rewrites the image to the in-cluster name; using
  `localhost:5000` there causes `ImagePullBackOff`.
- **The local overlay's committed image is whichever path touched it last.**
  This walkthrough leaves it pointing at
  `k3d-jsonplaceholder-registry:5000/...:local`, but Harness CI (see
  docs/README-harness.md) commits over that with the real registry and the
  commit SHA it just built every time it runs on `master`. Coming back to
  this manual loop after Harness has run means re-pushing to
  `localhost:5000/...:local` and rerunning `kustomize edit set image` (or
  `git checkout` the file back) to restore it.
- **Traefik is on host port 8080, not 80.** The cluster maps 8080 and 8443 so it
  doesn't collide with anything on the low ports.
- **The image has no devDependencies.** The local overlay sets
  `NODE_ENV=development` on the production image. Code that assumes
  "development means devDependencies are installed" will crash here (see
  `pino-pretty` in [Telemetry](README-telemetry.md)).
- **CPU-based autoscaling barely applies here.** A proxy spends its time waiting
  on the upstream rather than using CPU, so the HPA rarely scales.
- **The prod overlay has never been applied.** It renders cleanly, but its
  registry and host are `REPLACE_WITH_REAL_*` placeholders (the tag gets
  promoted by CI once it's run on `master`).
- **A pod stuck in `CreateContainerConfigError`** with `container has
  runAsNonRoot and image has non-numeric user (node), cannot verify user is
  non-root` means the Deployment's `runAsUser` doesn't match the image's
  `USER`. Fixed as of this writing (`runAsUser: 1000`), but if the Dockerfile's
  base image ever changes, re-check `node`'s UID stays 1000 (`docker run
  --rm <image> id node`) or update `runAsUser` to match.
- **`@nestjs/throttler@6.5.0` has no Nest-12-compatible release**, so a clean
  `npm ci` (no `node_modules` yet, as in the `deps` build stage or a fresh
  CI runner) fails with `ERESOLVE` once it can't find a peer-compatible
  `@nestjs/common`/`@nestjs/core`. `package.json`'s `overrides` block tells
  npm to treat throttler's peer declarations as satisfied by whatever
  `@nestjs/common`/`@nestjs/core` version the root project resolves to,
  instead of loosening resolution tree-wide with `--legacy-peer-deps`. Bumping
  any `@nestjs/*` package requires re-running `npm install` to refresh
  `package-lock.json` so the override stays in sync.
