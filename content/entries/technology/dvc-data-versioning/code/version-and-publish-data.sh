#!/usr/bin/env bash
set -euo pipefail

dataset="data/raw"
remote="team-storage"

dvc add "$dataset"
dvc status

# Publish immutable content before sharing the Git metadata that references it.
dvc push --remote "$remote" "$dataset.dvc"
dvc status --cloud --remote "$remote"

git add "$dataset.dvc" data/.gitignore
git commit -m "data: publish validated raw snapshot"
