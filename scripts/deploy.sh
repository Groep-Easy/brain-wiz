#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------------
REPO_URL="https://github.com/Groep-Easy/brain-wiz.git"
# Path of this script relative to the repo root — update if you move it.
SCRIPT_REPO_REL_PATH="scripts/deploy.sh"

# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------
STEP=0
TOTAL_STEPS=8

step() {
    STEP=$((STEP + 1))
    echo "[${STEP}/${TOTAL_STEPS}] $*"
}

die() {
    echo ""
    echo "=================================================================="
    echo "ERROR: $*"
    echo "=================================================================="
    exit 1
}

print_usage() {
    cat <<EOF
Usage: ./scripts/deploy.sh [prod|dev|branch <branch-name>|current]

  prod              : Deploy from 'master'  → ~/brain-wiz          (ports 80/443)
  dev               : Deploy from 'develop' → ~/brain-wiz-dev      (ports 3080/3000)
  branch <name>     : Deploy from <name>    → ~/brain-wiz-branch   (ports 3080/3000)
  current           : Deploy the current working directory as-is, no git pull

EOF
    exit 1
}

# -------------------------------------------------------------------------
# 0. Parse arguments
# -------------------------------------------------------------------------
ENV=""
CUSTOM_BRANCH=""

case "${1:-prod}" in
    prod)
        ENV="prod"
        REPO_DIR="$HOME/brain-wiz"
        BRANCH="master"
        ;;
    dev)
        ENV="dev"
        REPO_DIR="$HOME/brain-wiz-dev"
        BRANCH="develop"
        ;;
    branch)
        # Require a branch name argument
        if [ -z "${2:-}" ]; then
            echo "ERROR: 'branch' mode requires a branch name."
            print_usage
        fi
        ENV="branch"
        CUSTOM_BRANCH="$2"
        REPO_DIR="$HOME/brain-wiz-branch"
        BRANCH="$CUSTOM_BRANCH"
        ;;
    current)
        ENV="current"
        REPO_DIR="$PWD"
        BRANCH="(current directory)"
        ;;
    *)
        echo "ERROR: Unknown environment '${1}'."
        print_usage
        ;;
esac

# Sanitize branch name for use as a Docker Compose project name suffix.
# Docker project names must match [a-z0-9][a-z0-9_-]*
SAFE_ENV_SUFFIX=$(echo "$ENV" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9_-' '_')
export COMPOSE_PROJECT_NAME="brainwiz_${SAFE_ENV_SUFFIX}"

echo "======================================"
echo " Starting Deployment: $ENV"
echo " Target Dir : $REPO_DIR"
echo " Branch     : $BRANCH"
echo " Project    : $COMPOSE_PROJECT_NAME"
echo "======================================"

# -------------------------------------------------------------------------
# 1. Check requirements
# -------------------------------------------------------------------------
step "Checking requirements..."
for cmd in git docker openssl netstat; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is not installed or not in PATH."
done

docker compose version >/dev/null 2>&1 || die "Docker Compose plugin is not installed."

# -------------------------------------------------------------------------
# 2. Synchronize repository
# -------------------------------------------------------------------------
step "Synchronizing repository..."
if [ "$ENV" != "current" ]; then
    if [ ! -d "$REPO_DIR/.git" ]; then
        echo "      Repository not found. Cloning branch '$BRANCH' into $REPO_DIR..."
        git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR"
    else
        echo "      Fetching latest from origin/$BRANCH..."
        git -C "$REPO_DIR" fetch --prune origin
        git -C "$REPO_DIR" checkout "$BRANCH"
        git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
    fi
else
    echo "      Skipping synchronization for 'current' environment."
fi

# -------------------------------------------------------------------------
# 3. Enforce script synchronization
#    Abort if the running script differs from the repo copy, so we never
#    continue a deployment with a stale version of this file.
# -------------------------------------------------------------------------
step "Checking script synchronization..."

# Resolve absolute path of the currently-running script BEFORE cd-ing.
RUNNING_SCRIPT="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")"
SCRIPT_DIR="$(dirname "$RUNNING_SCRIPT")"

cd "$REPO_DIR"

if [ "$ENV" != "current" ]; then
    # If launched from outside the target repo, copy .env so it travels with us.
    if [ "$SCRIPT_DIR" != "$REPO_DIR" ] && [ -f "$SCRIPT_DIR/.env" ]; then
        echo "      Copying .env from $SCRIPT_DIR to $REPO_DIR..."
        cp "$SCRIPT_DIR/.env" "$REPO_DIR/.env"
        chmod 600 "$REPO_DIR/.env"
    fi

    REPO_SCRIPT_PATH="$REPO_DIR/$SCRIPT_REPO_REL_PATH"

    if [ -f "$REPO_SCRIPT_PATH" ] && [ -f "$RUNNING_SCRIPT" ]; then
        if command -v sha256sum >/dev/null 2>&1; then
            RUNNING_HASH=$(sha256sum "$RUNNING_SCRIPT" | awk '{print $1}')
            REPO_HASH=$(sha256sum "$REPO_SCRIPT_PATH"   | awk '{print $1}')
        elif command -v shasum >/dev/null 2>&1; then
            RUNNING_HASH=$(shasum -a 256 "$RUNNING_SCRIPT" | awk '{print $1}')
            REPO_HASH=$(shasum -a 256 "$REPO_SCRIPT_PATH"   | awk '{print $1}')
        else
            # Cannot compare — skip the check rather than falsely passing.
            RUNNING_HASH=""
            REPO_HASH=""
            echo "      WARNING: No sha256 tool found; skipping script integrity check."
        fi

        if [ -n "$RUNNING_HASH" ] && [ "$RUNNING_HASH" != "$REPO_HASH" ]; then
            die "The running deploy script differs from the repo copy at $REPO_SCRIPT_PATH.
Please re-run from the updated version:
  cd $REPO_DIR && ./$SCRIPT_REPO_REL_PATH $ENV${CUSTOM_BRANCH:+ $CUSTOM_BRANCH}"
        fi
    fi
else
    echo "      Skipping script synchronization for 'current' environment."
fi

# -------------------------------------------------------------------------
# 4. Environment variable validation
# -------------------------------------------------------------------------
step "Validating environment variables..."
[ -f ".env.example" ] || die ".env.example is missing from the repository."

if [ ! -f ".env" ]; then
    if [ "$ENV" == "dev" ]; then
        echo "      No .env found. Copying .env.example for DEV environment..."
        cp .env.example .env
        chmod 600 .env
    else
        die "No .env file found. Non-dev deployments require a manually configured .env."
    fi
fi

chmod 600 .env

# Report every missing variable in one pass (don't abort on first).
MISSING=$(
    grep -v '^[[:space:]]*#' .env.example \
    | grep -v '^[[:space:]]*$' \
    | cut -d= -f1 \
    | while read -r VAR; do
        if ! grep -q "^[[:space:]]*${VAR}=" .env 2>/dev/null; then
            echo "  - $VAR"
        fi
    done
)
[ -z "$MISSING" ] || die "Missing environment variables in .env:\n$MISSING"

# -------------------------------------------------------------------------
# 5. Setup Docker Compose overrides
# -------------------------------------------------------------------------
step "Preparing Docker Compose configuration..."
if [ "$ENV" == "dev" ] || [ "$ENV" == "branch" ]; then
    PREFIX="${ENV}"
    echo "      Writing docker-compose.override.yml for '$ENV' environment..."
    cat > docker-compose.override.yml <<EOF
services:
  brain-wiz:
    container_name: ${PREFIX}-server
  nginx:
    container_name: ${PREFIX}-nginx-proxy
    ports:
      - "3000:443"
      - "3080:80"
  db:
    container_name: ${PREFIX}-postgres-db
  pgadmin:
    container_name: ${PREFIX}-pgadmin
    ports:
      - "5051:80"
  loki:
    container_name: ${PREFIX}-loki
  promtail:
    container_name: ${PREFIX}-promtail
  grafana:
    container_name: ${PREFIX}-grafana
    ports:
      - "3201:3000"
EOF
else
    # Remove any leftover override from a previous dev/branch run.
    rm -f docker-compose.override.yml
fi

# -------------------------------------------------------------------------
# 6. Check and free required ports
# -------------------------------------------------------------------------
step "Checking and freeing required ports..."
if [ "$ENV" == "prod" ]; then
    REQUIRED_PORTS=(80 443 5050 3200)
else
    REQUIRED_PORTS=(3000 3080 5051 3201)
fi

for port in "${REQUIRED_PORTS[@]}"; do
    # Stop conflicting Docker containers on this port.
    while IFS= read -r container; do
        [ -z "$container" ] && continue
        echo "      Port $port is held by Docker container $container — stopping it..."
        docker stop "$container" >/dev/null 2>&1 || true
    done < <(docker ps -q --filter "publish=$port" 2>/dev/null || true)

    # Kill conflicting host processes.
    if command -v lsof >/dev/null 2>&1; then
        while IFS= read -r pid; do
            [ -z "$pid" ] && continue
            PROC_NAME=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
            echo "      Port $port is held by host PID $pid ($PROC_NAME) — terminating..."
            # Attempt graceful kill first, then escalate.
            kill "$pid" 2>/dev/null \
                || kill -9 "$pid" 2>/dev/null \
                || sudo -n kill -9 "$pid" 2>/dev/null \
                || echo "      WARNING: Could not kill PID $pid — may need manual intervention."
        done < <(lsof -ti :"$port" 2>/dev/null || true)
    fi

    # Verify port is now free (portable: works on Linux and macOS).
    if netstat -an 2>/dev/null | awk '/LISTEN/{print $4}' | grep -qE "[.:]${port}$"; then
        die "Port $port is still in use and could not be freed.
A system service (e.g. a local Postgres instance) may be holding it.
Stop it manually and retry."
    fi
done

# -------------------------------------------------------------------------
# 7. Generate SSL certificate
# -------------------------------------------------------------------------
step "Checking SSL certificate..."
mkdir -p nginx/ssl

CERT_FILE="nginx/ssl/nginx-selfsigned.crt"
KEY_FILE="nginx/ssl/nginx-selfsigned.key"
CERT_DAYS_REMAINING=0

if [ -f "$CERT_FILE" ]; then
    CERT_DAYS_REMAINING=$(openssl x509 -enddate -noout -in "$CERT_FILE" 2>/dev/null \
        | sed 's/notAfter=//' \
        | xargs -I{} openssl x509 -enddate -noout -checkend 2592000 -in "$CERT_FILE" \
            2>/dev/null && echo "ok" || echo "expiring")
fi

if [ ! -f "$CERT_FILE" ] || [ "$CERT_DAYS_REMAINING" == "expiring" ]; then
    [ -f "$CERT_FILE" ] \
        && echo "      Certificate expires soon or is invalid — regenerating..." \
        || echo "      No certificate found — generating self-signed wildcard certificate..."

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out  "$CERT_FILE" \
        -subj "/C=US/ST=State/L=City/O=BrainWiz/OU=IT/CN=*" \
        >/dev/null 2>&1

    chmod 600 "$KEY_FILE"
    echo "      Certificate generated."
else
    echo "      Existing certificate is valid."
fi

# -------------------------------------------------------------------------
# 8. Deploy
# -------------------------------------------------------------------------
step "Deploying containers..."

# Determine whether sudo is required for Docker.
DOCKER_CMD="docker compose -f docker-compose.prod.yml"
if ! docker ps >/dev/null 2>&1; then
    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker compose -f docker-compose.prod.yml"
        echo "      Note: using sudo for Docker commands."
    else
        die "Cannot access Docker. Either add your user to the 'docker' group or configure passwordless sudo for 'docker'."
    fi
fi

if [ -f "docker-compose.override.yml" ]; then
    DOCKER_CMD="$DOCKER_CMD -f docker-compose.override.yml"
fi

echo "      Stopping existing containers (timeout 30 s)..."
$DOCKER_CMD down --timeout 30

echo "      Pulling latest images..."
$DOCKER_CMD pull

echo "      Building and starting containers..."
$DOCKER_CMD up --build -d

# -------------------------------------------------------------------------
# Done — print accessible URLs
# -------------------------------------------------------------------------
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
    SERVER_IP=$(ipconfig getifaddr en0 2>/dev/null || true)
fi
[ -z "$SERVER_IP" ] && SERVER_IP="<server-ip>"

if [ "$ENV" == "prod" ]; then
    APP_URL="https://${SERVER_IP}"      # standard 443, no port in URL
    GRAFANA_PORT=3200
    PGADMIN_PORT=5050
else
    APP_URL="https://${SERVER_IP}:3000"
    GRAFANA_PORT=3201
    PGADMIN_PORT=5051
fi

echo ""
echo "======================================"
echo " Deployment completed successfully!"
echo " Project : $COMPOSE_PROJECT_NAME"
echo " Branch  : $BRANCH"
echo "======================================"
echo ""
echo " Welcome page          ${APP_URL}"
echo " Game Host (TV)        ${APP_URL}/host"
echo " Player client         ${APP_URL}/client"
echo " Grafana               http://${SERVER_IP}:${GRAFANA_PORT}"
echo " pgAdmin               http://${SERVER_IP}:${PGADMIN_PORT}"
echo ""
echo " NOTE: Self-signed certificate — click Advanced → Proceed in browser."
echo "       Requires UvA VPN for off-campus access."
echo "======================================"
