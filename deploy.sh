#!/usr/bin/env bash
set -euo pipefail

# -------------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------------
REPO_URL="https://github.com/Groep-Easy/brain-wiz.git"
SCRIPT_NAME="deploy.sh"

function print_usage() {
    echo "Usage: ./$SCRIPT_NAME [prod|dev|branch <branch-name>]"
    echo "  prod              : Deploys from master to ~/brain-wiz"
    echo "  dev               : Deploys from develop to ~/brain-wiz-dev (alt ports)"
    echo "  branch <name>     : Deploys from <name> to ~/brain-wiz-branch (alt ports)"
    exit 1
}

# -------------------------------------------------------------------------
# 0. Parse arguments
# -------------------------------------------------------------------------
if [ "$#" -eq 0 ]; then
    ENV="prod"
elif [ "$#" -eq 1 ]; then
    ENV="$1"
elif [ "$#" -eq 2 ] && [ "$1" == "branch" ]; then
    ENV="branch"
    CUSTOM_BRANCH="$2"
else
    print_usage
fi
if [ "$ENV" == "prod" ]; then
    REPO_DIR="$HOME/brain-wiz"
    BRANCH="master"
elif [ "$ENV" == "dev" ]; then
    REPO_DIR="$HOME/brain-wiz-dev"
    BRANCH="develop"
elif [ "$ENV" == "branch" ]; then
    REPO_DIR="$HOME/brain-wiz-branch"
    BRANCH="${CUSTOM_BRANCH}"
else
    echo "ERROR: Invalid environment '$ENV'"
    print_usage
fi

echo "======================================"
echo " Starting Deployment: $ENV"
echo " Target Dir: $REPO_DIR"
echo " Branch:     $BRANCH"
echo "======================================"

# -------------------------------------------------------------------------
# 1. Check requirements
# -------------------------------------------------------------------------
echo "[1/8] Checking requirements..."
for cmd in git docker openssl; do
    if ! command -v $cmd >/dev/null 2>&1; then
        echo "ERROR: $cmd is not installed."
        exit 1
    fi
done

if ! docker compose version >/dev/null 2>&1; then
    echo "ERROR: Docker Compose is not installed."
    exit 1
fi

# -------------------------------------------------------------------------
# 2. Synchronize Repository
# -------------------------------------------------------------------------
echo "[2/8] Synchronizing Repository..."
if [ ! -d "$REPO_DIR/.git" ]; then
    echo "      Repository not found. Cloning into $REPO_DIR..."
    git clone -b "$BRANCH" "$REPO_URL" "$REPO_DIR"
else
    echo "      Fetching latest from origin..."
    git -C "$REPO_DIR" fetch origin "$BRANCH"
    echo "      Hard resetting to origin/$BRANCH..."
    git -C "$REPO_DIR" reset --hard "origin/$BRANCH"
fi

# -------------------------------------------------------------------------
# 3. Enforce Script Synchronization
# Ensure we are running the version of the script that is in the repo
# Resolve the running script path BEFORE we cd!
# -------------------------------------------------------------------------
RUNNING_SCRIPT="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")"
SCRIPT_DIR="$(dirname "$RUNNING_SCRIPT")"

cd "$REPO_DIR"

# If the user ran the script from outside the target repo directory, copy .env to the target
if [ "$SCRIPT_DIR" != "$REPO_DIR" ] && [ -f "$SCRIPT_DIR/.env" ]; then
    echo "      Copying .env from $SCRIPT_DIR to $REPO_DIR..."
    cp "$SCRIPT_DIR/.env" "$REPO_DIR/.env"
fi

REPO_SCRIPT_PATH="$REPO_DIR/$SCRIPT_NAME"

if [ -f "$REPO_SCRIPT_PATH" ] && [ -f "$RUNNING_SCRIPT" ]; then
    # We use shasum or sha256sum depending on OS
    if command -v sha256sum >/dev/null 2>&1; then
        RUNNING_HASH=$(sha256sum "$RUNNING_SCRIPT" | awk '{print $1}')
        REPO_HASH=$(sha256sum "$REPO_SCRIPT_PATH" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        RUNNING_HASH=$(shasum -a 256 "$RUNNING_SCRIPT" | awk '{print $1}')
        REPO_HASH=$(shasum -a 256 "$REPO_SCRIPT_PATH" | awk '{print $1}')
    else
        RUNNING_HASH="1"
        REPO_HASH="1"
    fi

    if [ "$RUNNING_HASH" != "$REPO_HASH" ]; then
        echo "=================================================================="
        echo "ERROR: The running deployment script differs from the repository."
        echo "Please restart the script so the updated version executes:"
        echo "  cd $REPO_DIR && ./$SCRIPT_NAME $ENV"
        echo "=================================================================="
        exit 1
    fi
fi

# -------------------------------------------------------------------------
# 4. Environment Variables Validation
# -------------------------------------------------------------------------
echo "[4/8] Validating Environment Variables..."
if [ ! -f ".env.example" ]; then
    echo "ERROR: .env.example file is missing from the repository."
    exit 1
fi

if [ ! -f ".env" ]; then
    if [ "$ENV" == "dev" ]; then
        echo "      No .env found. Automatically copying .env.example for DEV environment..."
        cp .env.example .env
    else
        echo "ERROR: no .env file found. Production deployments require a manual .env configuration."
        exit 1
    fi
fi

# Extract keys, ignoring comments and blank lines
MISSING=$(grep -v '^[[:space:]]*#' .env.example | grep -v '^[[:space:]]*$' | cut -d= -f1 | while read -r VAR; do
    # Using grep to check if the variable is defined in .env (even if empty)
    if ! grep -q "^[[:space:]]*${VAR}=" .env; then
        echo "$VAR"
    fi
done)

if [ -n "$MISSING" ]; then
    echo "ERROR: Missing environment variables in .env:"
    echo "$MISSING"
    exit 1
fi

# -------------------------------------------------------------------------
# 5. Setup Docker Overrides (Dev only)
# -------------------------------------------------------------------------
echo "[5/8] Preparing Docker Compose..."
if [ "$ENV" == "dev" ] || [ "$ENV" == "branch" ]; then
    PREFIX="dev"
    [ "$ENV" == "branch" ] && PREFIX="branch"
    echo "      Creating docker-compose.override.yml for ${ENV} environment..."
    cat <<EOF > docker-compose.override.yml
services:
  brain-wiz:
    container_name: ${PREFIX}-server
  nginx:
    container_name: ${PREFIX}-nginx-proxy
    ports:
      - "3001:443"   # HTTPS on alternate port
      - "3080:80"    # HTTP redirect on alternate port
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
    # Ensure no override file exists from a dirty state
    rm -f docker-compose.override.yml
fi

# -------------------------------------------------------------------------
# 6. Check and free required ports
# -------------------------------------------------------------------------
echo "[6/8] Freeing Required Ports..."
if [ "$ENV" == "prod" ]; then
    # Standard HTTP (80) and HTTPS (443) — no port number in browser URL.
    REQUIRED_PORTS=(80 443 5050 3200)
else
    REQUIRED_PORTS=(3001 3080 5051 3201)
fi

for port in "${REQUIRED_PORTS[@]}"; do
    # 1. Stop conflicting Docker containers
    CONFLICTING_CONTAINERS=$(docker ps -q --filter "publish=$port" 2>/dev/null || true)
    for container in $CONFLICTING_CONTAINERS; do
        echo "      Port $port used by Docker container $container. Stopping it..."
        docker stop "$container" >/dev/null 2>&1 || sudo docker stop "$container" >/dev/null 2>&1 || true
    done

    # 2. Kill conflicting host processes
    if command -v lsof >/dev/null 2>&1; then
        PIDS=$(lsof -ti :$port 2>/dev/null || true)
        for pid in $PIDS; do
            echo "      Port $port used by host PID $pid. Terminating..."
            kill -9 "$pid" 2>/dev/null || sudo -n kill -9 "$pid" 2>/dev/null || true
        done
    fi

    # 3. Verify port is free — portable check that works on both Linux and macOS.
    # macOS netstat uses dot notation (*.5432), Linux uses colon (0.0.0.0:5432).
    if netstat -an 2>/dev/null | awk '/LISTEN/{print $4}' | grep -qE "[.:]${port}$"; then
        echo ""
        echo "=================================================================="
        echo "ERROR: Port $port is still in use and could not be closed."
        echo "This means a system service (like a local Postgres server) is"
        echo "running on your machine, and the script doesn't have permission"
        echo "to force-close it. Please stop it manually and try again."
        echo "=================================================================="
        exit 1
    fi
done

# -------------------------------------------------------------------------
# 7. Generate SSL Certificates
# -------------------------------------------------------------------------
echo "[7/8] Generating SSL Certificates..."
mkdir -p nginx/ssl
if [ ! -f "nginx/ssl/nginx-selfsigned.crt" ]; then
    echo "      No SSL certificates found. Generating self-signed wildcard certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/nginx-selfsigned.key \
        -out nginx/ssl/nginx-selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=BrainWiz/OU=IT/CN=*" >/dev/null 2>&1
    echo "      Certificate generated."
fi

# -------------------------------------------------------------------------
# 8. Deployment
# -------------------------------------------------------------------------
echo "[8/8] Pulling Latest Docker Images..."
# Use COMPOSE_PROJECT_NAME to isolate dev and prod networks/volumes if they run on the same machine
export COMPOSE_PROJECT_NAME="brainwiz_${ENV}"

# We check if sudo is needed for docker
DOCKER_CMD="docker compose"
if ! docker ps >/dev/null 2>&1; then
    if sudo -n docker ps >/dev/null 2>&1; then
        DOCKER_CMD="sudo docker compose"
        echo "      Note: Using sudo for docker commands."
    else
        echo "ERROR: Cannot access Docker. Run as a user with Docker permissions or configure sudoers."
        exit 1
    fi
fi

echo "      Stopping current containers..."
$DOCKER_CMD down

echo "      Pulling images..."
$DOCKER_CMD pull

echo "[8/8] Starting Containers..."
$DOCKER_CMD up -d

# -------------------------------------------------------------------------
# Done — print all accessible URLs
# -------------------------------------------------------------------------
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="<server-ip>"

if [ "$ENV" == "prod" ]; then
    APP_PORT=""          # standard 443, no port in URL
    APP_PREFIX="https://${SERVER_IP}"
    GRAFANA_PORT=3200
    PGADMIN_PORT=5050
else
    APP_PORT=3001
    APP_PREFIX="https://${SERVER_IP}:${APP_PORT}"
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
echo " Welcome page (links to both apps)"
echo "   ${APP_PREFIX}"
echo ""
echo " Game Host (TV / main screen)"
echo "   ${APP_PREFIX}/host"
echo ""
echo " Player client (open on phone)"
echo "   ${APP_PREFIX}/client"
echo ""
echo " Grafana (logs and dashboards)"
echo "   http://${SERVER_IP}:${GRAFANA_PORT}"
echo "   Login: admin / \${GRAFANA_ADMIN_PASSWORD:-changeme}"
echo ""
echo " pgAdmin (database viewer)"
echo "   http://${SERVER_IP}:${PGADMIN_PORT}"
echo ""
echo " NOTE: Self-signed certificate -- click Advanced -> Proceed in browser."
echo "       Requires UvA VPN for off-campus access."
echo "======================================"
