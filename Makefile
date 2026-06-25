# =============================================================================
# Brain Wiz — deployment helpers
# =============================================================================
# Production deploy uses the base compose file explicitly (-f docker-compose.yml)
# so the local-dev docker-compose.override.yml is never applied on the server.
# =============================================================================

COMPOSE_PROD := docker compose -f docker-compose.yml
CERT_DIR     := nginx/ssl
CERT_CN      ?= brain-wiz

.PHONY: help cert deploy deploy-obs down logs ps

help:
	@echo "Targets:"
	@echo "  make cert        Generate a self-signed TLS cert (one-time, 365 days)"
	@echo "  make deploy      git pull + build + start core stack (app, nginx, db)"
	@echo "  make deploy-obs  Same, plus the observability profile (Loki/Promtail/Grafana)"
	@echo "  make down        Stop and remove the stack"
	@echo "  make logs        Tail logs for all running services"
	@echo "  make ps          Show service status"

# One-time on a fresh host (regenerate when it expires). nginx will not start
# without these files because nginx.conf references them.
cert:
	@mkdir -p $(CERT_DIR)
	@if [ -f "$(CERT_DIR)/nginx-selfsigned.crt" ]; then \
		echo "Certificate already exists at $(CERT_DIR) — delete it first to regenerate."; \
	else \
		openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
			-keyout "$(CERT_DIR)/nginx-selfsigned.key" \
			-out    "$(CERT_DIR)/nginx-selfsigned.crt" \
			-subj "/CN=$(CERT_CN)"; \
		echo "Self-signed certificate generated at $(CERT_DIR)."; \
	fi
	@# The nginx-unprivileged container runs as UID 101, which is NOT the host
	@# user that owns these files. nginx must be able to (a) traverse the cert
	@# directory and (b) read the key/cert, so make both world-traversable/
	@# readable. A restrictive umask otherwise leaves the dir at 700 and nginx
	@# fails with "fopen(... .key) Permission denied" even when the key is 644.
	@chmod 755 "$(CERT_DIR)"
	@chmod 644 "$(CERT_DIR)/nginx-selfsigned.key" "$(CERT_DIR)/nginx-selfsigned.crt"

deploy:
	git pull --ff-only
	$(COMPOSE_PROD) up --build -d

deploy-obs:
	git pull --ff-only
	$(COMPOSE_PROD) --profile observability up --build -d

down:
	$(COMPOSE_PROD) down

logs:
	$(COMPOSE_PROD) logs -f

ps:
	$(COMPOSE_PROD) ps
