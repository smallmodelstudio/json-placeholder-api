# Harness

The CI/CD pipelines, written as code in `.harness/`.

> **Status:** these pipelines follow the Harness NextGen YAML schema. The
> local-k3d path (org `default`, project `json_placeholder_api`, registry
> `ghcr.io/smallmodelstudio`, connector identifiers below) is filled in and
> ready to import; only the prod-only identifiers
> (`REPLACE_WITH_REAL_PROD_K8S_CONNECTOR`, `REPLACE_WITH_REAL_USER_GROUP`,
> `REPLACE_WITH_REAL_HOST` and the prod overlay's registry/tag) stay
> placeholders until a real prod cluster exists — see
> [No-cost setup](#no-cost-setup) below.

## How Harness fits

Harness is a control plane, not a host: it deploys into a cluster you provide.
It reaches that cluster through a **Delegate**, a worker you install inside the
cluster that only makes outbound HTTPS connections. Because nothing needs to
connect in, the local k3d cluster is a valid target, with no public IP or tunnel.

The free tier covers this project: 5 developers, 2,000 Harness Cloud build
credits a month, and unlimited builds on self-hosted runners. `ci.yaml` and
`contract-tests.yaml` run on a **local runner** (`runtime.type: Docker`) —
a Docker Delegate plus the Harness Docker Runner binary, both running on a
developer's own machine — so CI builds don't spend Harness Cloud credits at
all. Switch a stage back to `runtime.type: Cloud` if no local runner is
available.

## Files

```text
.harness/
  pipelines/ci.yaml               install → lint, typecheck, unit (in parallel) → e2e
                                  → build and push image → promote tag to both
                                  overlays (master only)
  pipelines/cd.yaml               deploy to k3d → smoke test → manual approval
                                  → deploy to prod → smoke test
  pipelines/contract-tests.yaml   npm run test:contract
  triggers/contract-tests-cron.yaml   runs the contract tests daily at 06:00 UTC
  services/json-placeholder-api.yaml  Kubernetes service; manifests come from k8s/overlays/<overlay>
  environments/                   local-k3d and prod; each sets the overlay variable
  infrastructures/                the Kubernetes connector and namespace for each environment
```

## How it works

- **CI hands the image tag to CD through git.** CI's last step runs
  `kustomize edit set image` on both `k8s/overlays/local` and
  `k8s/overlays/prod` with the tag it just built and pushed, then commits and
  pushes the change. CD applies whatever is committed, so the two pipelines
  share nothing but the repo, and a prod deploy — once approved — always
  rolls out the exact image that passed CI and the local k3d smoke test, not
  a separately-tracked tag. Harness's native alternative, the "Kustomize
  Patches" manifest type, injects the tag at deploy time instead.
- **The environment picks the overlay.** The service's manifest path is
  `k8s/overlays/<+env.variables.overlay>`, so one service definition serves both
  environments.
- **Every deploy stage has a rollback step.** It runs if the stage fails,
  including when the smoke test fails.
- **Contract tests aren't a merge gate.** They run on a schedule, so a flaky
  upstream never blocks a merge.

## No-cost setup

Everything below stays free: Harness Cloud's build minutes, a self-hosted
Delegate you run yourself, ghcr.io (free for a public package) and the local
k3d cluster. Prod is deliberately left unwired — see
[Deferred: prod](#deferred-prod).

1. **Create the Harness project.** Org `default`, project identifier
   `json_placeholder_api` (the YAML already uses these).
2. **Create a GitHub PAT for the registry.** In GitHub → Settings → Developer
   settings → Personal access tokens, create one scoped to `write:packages`
   and `read:packages`. If `smallmodelstudio` is an org you don't have
   package-publish rights on, push to your own namespace instead
   (`ghcr.io/<your-username>/json-placeholder-api`) and update `repo:` in
   `ci.yaml` and the two `newName`/image lines that reference
   `ghcr.io/smallmodelstudio` accordingly. After the first push, open the
   package's settings on GitHub and set its visibility to **Public** — that
   lets the k3d cluster pull it with no imagePullSecret.
3. **Install the local CI runner.** From the Harness UI's onboarding/getting
   started page, copy the "Run your Pipeline locally" script command — it
   downloads `script-prod.sh` and runs it as
   `sh script.sh <ACCOUNT_ID> <DELEGATE_TOKEN> <DELEGATE_IMAGE_VERSION>`. On
   Linux it does two things: `docker run`s a Docker-type Delegate
   (`--net=host`, `DELEGATE_TYPE=DOCKER`), then downloads and starts the
   `harness-docker-runner` binary (needs `sudo`, listens on port 3000). This
   is what `ci.yaml`/`contract-tests.yaml`'s `runtime.type: Docker` stages
   run builds on — a one-to-one Delegate-to-Runner pair per machine, no
   connector needed at the stage level. Confirm it registered: Project
   Settings → Delegates should show `docker-delegate` as **Connected**.
   Since `harness-docker-runner` is started with `sudo ... &` and isn't
   managed by systemd, running the script twice leaves a stale process
   behind — `sudo ss -ltnp | grep 3000` shows which PID actually holds the
   port; kill any other `harness-docker-runner` PID from
   `ps -eo pid,stat,etime,cmd | grep harness-docker-runner`.
4. **Install a second, Kubernetes Delegate into k3d — needed for CD, not CI.**
   The Docker Delegate above only runs CI build steps on the host; it has no
   access to the k3d cluster. In the Harness UI, go to Project Settings →
   Delegates → New Delegate → Kubernetes. The UI generates a Helm command
   with a one-time token. Run it against the `k3d-jsonplaceholder` context
   (created by `k8s/k3d/create-cluster.sh`), then wait for the Delegate to
   show as "Connected".
5. **Create the connectors** with the identifiers the YAML already references:

   | Connector | Identifier | Used by |
   | --- | --- | --- |
   | GitHub | `github_connector` | CI, contract tests, service |
   | Docker registry (ghcr.io, using the PAT from step 2) | `ghcr_connector` | CI |
   | Kubernetes (k3d, "Inherit from Delegate") | `k3d_local_connector` | `local-k3d-infra.yaml` |

6. **Import all the YAML from git, in dependency order:** services →
   environments → infrastructures → pipelines → triggers. This includes the
   `prod` environment/infrastructure entities — `cd.yaml`'s "Deploy to prod"
   stage refers to them by identifier, so they need to exist even though
   `prod-infra.yaml`'s connector is still a placeholder (see
   [Deferred: prod](#deferred-prod)); that only matters once the pipeline
   actually reaches that stage.
7. **Run CI by hand once**, and check the image reaches
   `ghcr.io/smallmodelstudio/json-placeholder-api` before you rely on CD.
8. **Run CD.** The "Deploy to local k3d" stage should roll out and pass its
   smoke test. It then pauses at the "Promote to prod?" manual approval —
   leave that pending or reject it; there's nothing to approve into yet.

### Deferred: prod

`REPLACE_WITH_REAL_PROD_K8S_CONNECTOR`, `REPLACE_WITH_REAL_USER_GROUP` (who
can approve prod), `REPLACE_WITH_REAL_HOST` (the prod ingress host), and the
prod overlay's `REPLACE_WITH_REAL_REGISTRY`/`REPLACE_WITH_REAL_TAG` stay
placeholders until a real cluster backs the `prod` environment — for
example Oracle Cloud's Always Free tier running k3s. Dropping one in later
doesn't need any pipeline changes, only filling in those identifiers.

## Gotchas

- **Smoke tests run on the Delegate, inside the cluster.** They call the Service's
  cluster DNS name, `json-placeholder-api.default.svc.cluster.local`. The host's
  `localhost:8080` doesn't resolve from inside the cluster.
- **The build, push and promote steps only run on `master`.** On other branches,
  CI only lints and tests.
- **The deployment check is a plain smoke test** (two curls), not Harness's
  metrics-based Continuous Verification. Wiring that up needs a real account.
