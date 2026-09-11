#!/usr/bin/env bash
set -euo pipefail

k3d cluster delete jsonplaceholder
k3d registry delete jsonplaceholder-registry
