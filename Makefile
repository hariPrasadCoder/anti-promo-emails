.PHONY: dev install install-backend install-frontend backend frontend help

# Default — runs everything
dev:
	@echo "Starting Anti-Promo Email Optimizer..."
	@cd backend && uvicorn main:app --reload --port 8000 &
	@cd frontend && npm run dev

install:
	@echo "Installing backend dependencies..."
	cd backend && pip3 install -r requirements.txt
	@echo "Installing frontend dependencies..."
	cd frontend && npm install
	@echo "Done. Copy backend/.env.example to backend/.env and fill in your credentials."

backend:
	cd backend && uvicorn main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

help:
	@echo ""
	@echo "  make          Start backend + frontend"
	@echo "  make install  Install all dependencies"
	@echo "  make backend  Backend only (port 8000)"
	@echo "  make frontend Frontend only (port 3000)"
	@echo ""
