.PHONY: up down logs build seed dev-back dev-front

# Docker Compose ile tüm sistemi ayağa kaldır
up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

# İmajları derle
build:
	docker build -t havuz-teklif-backend:latest ./backend
	docker build -t havuz-teklif-frontend:latest ./frontend

# Yerel geliştirme
dev-back:
	cd backend && npm install && npm run dev

dev-front:
	cd frontend && npm install && npm run dev
