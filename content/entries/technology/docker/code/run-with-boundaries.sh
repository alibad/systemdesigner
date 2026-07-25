#!/usr/bin/env bash
set -euo pipefail

: "${POSTGRES_IMAGE:?Set POSTGRES_IMAGE to an approved image digest}"
: "${API_IMAGE:?Set API_IMAGE to an approved image digest}"

docker network create application-network
docker volume create database-data

# The database is reachable by name only from peers on the user-defined bridge.
docker run --detach \
  --name database \
  --network application-network \
  --mount type=volume,src=database-data,dst=/var/lib/postgresql/data \
  --memory 1g \
  --cpus 1.5 \
  "$POSTGRES_IMAGE"

# Bind the public port explicitly and keep the image filesystem read-only.
docker run --detach \
  --name api \
  --network application-network \
  --publish 127.0.0.1:8080:8080 \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --memory 512m \
  --cpus 1 \
  "$API_IMAGE"
