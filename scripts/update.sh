#!/bin/bash
set -e

cd /opt/carousel-pro

echo "[$(date)] git pull..."
git pull

echo "[$(date)] пересборка и перезапуск..."
docker compose down
docker compose up -d --build

sleep 5
if docker compose ps | grep -q "Up"; then
  echo "[$(date)] ✅ Обновление успешно"
  docker compose logs --tail=15
else
  echo "[$(date)] ❌ Контейнер не запустился! Логи:"
  docker compose logs --tail=50
  exit 1
fi
