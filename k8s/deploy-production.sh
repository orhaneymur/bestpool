#!/usr/bin/env bash
# =============================================================================
# bestpool / Havuz Teklif — k3s üretim güncelleme scripti
#
# Kullanım (sunucuda, repo kök dizininde):
#   bash k8s/deploy-production.sh              # imajlar Docker Hub'da hazırsa: apply + rollout
#   BUILD=1 bash k8s/deploy-production.sh      # sunucuda imajları da build + push eder
#   PULL=1 bash k8s/deploy-production.sh       # önce git pull ile kaynağı günceller
#
# Notlar:
#  - k3s, imajları containerd ile Docker Hub'dan çeker (imagePullPolicy: Always).
#  - BUILD=1 için sunucuda "docker login" yapılmış olmalı.
#  - Diğer 5 siteyi ETKİLEMEZ; yalnızca "havuz" namespace'ine dokunur.
# =============================================================================
set -euo pipefail

# Script konumundan repo köküne geç
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

NS="havuz"
MANIFEST="deploy/k3s-pool.yaml"
BACKEND_IMAGE="since1907/bestpool-backend:latest"
FRONTEND_IMAGE="since1907/bestpool-frontend:latest"
KUBECTL="sudo k3s kubectl"

echo "==> Repo: $REPO_ROOT"

if [ "${PULL:-0}" = "1" ]; then
  echo "==> git pull"
  git pull --ff-only
fi

if [ "${BUILD:-0}" = "1" ]; then
  echo "==> Backend imajı build ediliyor"
  docker build -t "$BACKEND_IMAGE" ./backend
  echo "==> Frontend imajı build ediliyor"
  docker build -t "$FRONTEND_IMAGE" ./frontend
  echo "==> İmajlar Docker Hub'a push ediliyor"
  docker push "$BACKEND_IMAGE"
  docker push "$FRONTEND_IMAGE"
fi

echo "==> Manifest uygulanıyor ($MANIFEST)"
$KUBECTL apply -f "$MANIFEST"

echo "==> Pod'lar yenileniyor (yeni :latest imajları çekilir)"
$KUBECTL -n "$NS" rollout restart deploy/havuz-backend deploy/havuz-frontend

echo "==> Rollout durumu bekleniyor"
$KUBECTL -n "$NS" rollout status deploy/havuz-backend --timeout=180s
$KUBECTL -n "$NS" rollout status deploy/havuz-frontend --timeout=180s

echo "==> Güncel durum"
$KUBECTL -n "$NS" get pods -o wide
$KUBECTL -n "$NS" get ingress

echo "==> Tamamlandı. Adres: http://pool.derneklab.com"
