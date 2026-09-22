#!/bin/bash
# Deploy script for the Pi: pulls latest, rebuilds, restarts.
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker compose ps
