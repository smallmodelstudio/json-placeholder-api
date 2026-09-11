# Harness CI/CD — pipeline as code

See `PLAN.md`'s Phase 7 for the full rationale. Short version: Harness does
not host a Kubernetes cluster for you — it's a control plane that deploys
*into* a cluster you provide, via a **Delegate** you install there that talks
outbound-only over HTTPS. The Phase 6 local k3d cluster is a fully valid
target; nothing here needs a public IP, port-forward, or tunnel.

Everything in this directory is written to the real Harness NextGen YAML
schema but is **unverified against a real tenant** — there is no Harness
account in this project yet, the same honest caveat Phase 6 gave
`k8s/overlays/prod`. Treat the placeholders below as the setup checklist.

## What's here

```text
.harness/
  pipelines/
    ci.yaml               lint + typecheck + unit (parallel) → e2e → build/push image
                           → promote the built tag into k8s/overlays/local
    cd.yaml                deploy to local k3d → smoke test → manual approval → deploy to prod
    contract-tests.yaml    npm run test:contract, scheduled (not a PR gate — see PLAN.md)
  triggers/
    contract-tests-cron.yaml   daily 06:00 UTC trigger for the above
  services/
    json-placeholder-api.yaml  Kubernetes service definition, Kustomize manifest source
  environments/
    local-k3d.yaml / prod.yaml   which overlay folder each environment deploys
  infrastructures/
    local-k3d-infra.yaml / prod-infra.yaml   which Kubernetes connector each environment uses
```

## Why CI promotes the image tag via a git commit, not a Harness artifact source

Kustomize's `images:` transformer (`k8s/overlays/*/kustomization.yaml`)
already pins the image ref and tag Phase 6 relies on. Harness has a
manifest/artifact-substitution path for Kustomize, but it's the piece of this
setup furthest from anything testable here without a real tenant. Instead,
CI's last step (`promote_local_overlay`) runs `kustomize edit set image` with
the tag it just built and pushed, then commits and pushes that change back to
the branch. CD then simply applies whatever is committed — no coupling
between the CI and CD pipelines beyond git. This is the same pattern
GitOps tools like Argo CD use, just driven by a Harness `Run` step instead.

If you'd rather use Harness's native artifact substitution once you're
validating this against a real tenant, look at Harness's "Kustomize Patches"
manifest type — it layers an artifact-aware patch on top of the base
Kustomize manifest without touching the committed `kustomization.yaml`.

## Setup checklist

1. **Harness account** — free tier (5 developers, 2,000 Cloud credits/month,
   unlimited self-hosted runner execution). Create an org/project and set
   `orgIdentifier`/`projectIdentifier` here to match if you don't reuse
   `default` / `json_placeholder_api`.

2. **Install the Delegate into the k3d cluster** from Phase 6:

   ```bash
   # from the Harness UI: Project Settings → Delegates → New Delegate →
   # Kubernetes → generates a helm command with a real --set delegateToken=...
   helm repo add harness-delegate https://app.harness.io/storage/harness-download/delegate-helm-chart/
   helm repo update
   helm upgrade -i k3d-jsonplaceholder-delegate harness-delegate/harness-delegate-ng \
     --namespace harness-delegate-ng --create-namespace \
     --set delegateName=k3d-jsonplaceholder \
     --set accountId=REPLACE_WITH_REAL_ACCOUNT_ID \
     --set delegateToken=REPLACE_WITH_REAL_DELEGATE_TOKEN \
     --set managerEndpoint=REPLACE_WITH_REAL_MANAGER_ENDPOINT \
     --set delegateDockerImage=REPLACE_WITH_REAL_DELEGATE_IMAGE \
     --kube-context k3d-jsonplaceholder
   kubectl get pods -n harness-delegate-ng   # wait for Running, then check
                                              # "Connected" in the Harness UI
   ```

   This is the one step that's genuinely interactive — the token and image
   tag are generated per-account and shown once in the UI.

3. **Connectors** (Project Settings → Connectors), identifiers must match
   what the YAML here references:

   | Connector | Referenced as | Used by |
   |---|---|---|
   | GitHub (this repo) | `account.REPLACE_WITH_REAL_GITHUB_CONNECTOR` | `pipelines/ci.yaml`, `pipelines/contract-tests.yaml`, `services/json-placeholder-api.yaml` |
   | Docker registry | `account.REPLACE_WITH_REAL_REGISTRY_CONNECTOR` | `pipelines/ci.yaml` |
   | Kubernetes cluster (local k3d, via the Delegate above) | `account.REPLACE_WITH_REAL_K8S_CONNECTOR` | `infrastructures/local-k3d-infra.yaml` |
   | Kubernetes cluster (prod, once one exists) | `account.REPLACE_WITH_REAL_PROD_K8S_CONNECTOR` | `infrastructures/prod-infra.yaml` |

   The two Kubernetes connectors should use "Inherit from Delegate" /
   delegate-selector auth against the Delegate installed in step 2 (and a
   second Delegate in whatever cluster prod ends up being) — that's what
   makes the outbound-only model work.

4. **Find-and-replace the remaining placeholders** once the above exist:
   `REPLACE_WITH_REAL_REGISTRY`, `REPLACE_WITH_REAL_DOMAIN` (git author email
   for the CI promotion commit), `REPLACE_WITH_REAL_USER_GROUP` (who can
   approve a prod promotion), `REPLACE_WITH_REAL_HOST` (prod ingress host,
   same value `k8s/overlays/prod` still has as a placeholder).

5. **Import into Harness** (Pipelines → + Pipeline → Import From Git,
   pointed at this repo/branch), one entity at a time: services →
   environments → infrastructures → pipelines → triggers. Import order
   matters because pipelines reference the others by identifier.

6. Run `pipelines/ci.yaml` once by hand first — confirm lint/typecheck/unit/
   e2e all pass through Harness the same way they do locally, then confirm
   the built image lands in the registry, before trusting `pipelines/cd.yaml`
   against the cluster.
