# Harness

The CI/CD pipelines, written as code in `.harness/`.

> **Status:** these pipelines follow the Harness NextGen YAML schema but have
> never run against a real Harness account. Every external identifier is a
> `REPLACE_WITH_REAL_*` placeholder.

## How Harness fits

Harness is a control plane, not a host: it deploys into a cluster you provide.
It reaches that cluster through a **Delegate**, a worker you install inside the
cluster that only makes outbound HTTPS connections. Because nothing needs to
connect in, the local k3d cluster is a valid target, with no public IP or tunnel.

The free tier covers this project: 5 developers, 2,000 Harness Cloud build
credits a month, and unlimited builds on self-hosted runners.

## Files

```text
.harness/
  pipelines/ci.yaml               install → lint, typecheck, unit (in parallel) → e2e
                                  → build and push image → promote tag (master only)
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
  `kustomize edit set image` on `k8s/overlays/local` with the tag it just built,
  then commits and pushes the change. CD applies whatever is committed, so the
  two pipelines share nothing but the repo. Harness's native alternative, the
  "Kustomize Patches" manifest type, injects the tag at deploy time instead.
- **The environment picks the overlay.** The service's manifest path is
  `k8s/overlays/<+env.variables.overlay>`, so one service definition serves both
  environments.
- **Every deploy stage has a rollback step.** It runs if the stage fails,
  including when the smoke test fails.
- **Contract tests aren't a merge gate.** They run on a schedule, so a flaky
  upstream never blocks a merge.

## Setup

1. **Create a Harness account and project.** The YAML uses the org `default` and
   the project `json_placeholder_api`; edit it to match if yours differ.
2. **Install the Delegate into k3d.** In the Harness UI, go to Project Settings →
   Delegates → New Delegate → Kubernetes. The UI generates a Helm command with a
   one-time token. Run it against the `k3d-jsonplaceholder` context, then wait for
   the Delegate to show as "Connected".
3. **Create the connectors** with the identifiers the YAML references:

   | Connector | Identifier | Used by |
   | --- | --- | --- |
   | GitHub | `REPLACE_WITH_REAL_GITHUB_CONNECTOR` | CI, contract tests, service |
   | Docker registry | `REPLACE_WITH_REAL_REGISTRY_CONNECTOR` | CI |
   | Kubernetes (k3d) | `REPLACE_WITH_REAL_K8S_CONNECTOR` | `local-k3d-infra.yaml` |
   | Kubernetes (prod) | `REPLACE_WITH_REAL_PROD_K8S_CONNECTOR` | `prod-infra.yaml` |

   Set both Kubernetes connectors to "Inherit from Delegate".
4. **Replace the remaining placeholders:** `REPLACE_WITH_REAL_REGISTRY`,
   `REPLACE_WITH_REAL_DOMAIN` (the CI commit email), `REPLACE_WITH_REAL_USER_GROUP`
   (who can approve prod) and `REPLACE_WITH_REAL_HOST` (the prod ingress host).
5. **Import the YAML from git in dependency order:** services → environments →
   infrastructures → pipelines → triggers. Pipelines refer to the other entities
   by identifier.
6. **Run CI by hand once**, and check the image reaches the registry before you
   rely on CD.

## Gotchas

- **Smoke tests run on the Delegate, inside the cluster.** They call the Service's
  cluster DNS name, `json-placeholder-api.default.svc.cluster.local`. The host's
  `localhost:8080` doesn't resolve from inside the cluster.
- **The build, push and promote steps only run on `master`.** On other branches,
  CI only lints and tests.
- **The deployment check is a plain smoke test** (two curls), not Harness's
  metrics-based Continuous Verification. Wiring that up needs a real account.
