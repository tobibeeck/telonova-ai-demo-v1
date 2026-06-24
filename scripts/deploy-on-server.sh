#!/usr/bin/env bash
set -euo pipefail

REMOTE_DIR="/opt/telonova"
REPO="https://github.com/tobibeeck/telonova-ai-demo-v1.git"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

cd "$REMOTE_DIR"

if [[ ! -d .git ]]; then
  git clone "$REPO" .
else
  git fetch origin
  git reset --hard origin/main
fi

if [[ ! -f .env.local ]]; then
  echo "Missing .env.local – copy from your dev machine first."
  exit 1
fi

if [[ ! -f data/gcp-service-account.json ]]; then
  echo "WARNING: data/gcp-service-account.json missing – Gemini will not work."
fi

$COMPOSE down || true
$COMPOSE up -d --build

sleep 10
docker compose exec -T ollama ollama pull llama3.2:1b
$COMPOSE ps

echo "App: http://$(hostname -I | awk '{print $1}')/"
