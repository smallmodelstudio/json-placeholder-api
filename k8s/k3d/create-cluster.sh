#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME="jsonplaceholder"
REGISTRY_NAME="jsonplaceholder-registry"
REGISTRY_PORT="5000"

if ! k3d registry list | grep -q "^${REGISTRY_NAME}"; then
  k3d registry create "${REGISTRY_NAME}" --port "${REGISTRY_PORT}"
fi

if ! k3d cluster list | grep -q "^${CLUSTER_NAME}"; then
  # 8080/8443 (not 80/443) so the cluster's Traefik doesn't fight anything
  # already bound to the low ports on the host.
  k3d cluster create "${CLUSTER_NAME}" \
    --registry-use "k3d-${REGISTRY_NAME}:${REGISTRY_PORT}" \
    -p "8080:80@loadbalancer" \
    -p "8443:443@loadbalancer"
fi

kubectl config use-context "k3d-${CLUSTER_NAME}"
echo "Cluster '${CLUSTER_NAME}' is ready; registry at localhost:${REGISTRY_PORT}."
