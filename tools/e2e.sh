#!/usr/bin/env bash
#
# e2e.sh — run Playwright e2e tests with graceful server startup/teardown.
#
# Usage:
#   ./tools/e2e.sh                    # run all e2e tests
#   ./tools/e2e.sh tests/foo.spec.js  # run specific spec file
#   ./tools/e2e.sh -g "pattern"       # run tests matching pattern
#
set -euo pipefail

PORT=8787
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[e2e]${NC} $*"; }
warn() { echo -e "${YELLOW}[e2e]${NC} $*"; }
err()  { echo -e "${RED}[e2e]${NC} $*" >&2; }

cleanup() {
    if [ -n "${SERVER_PID:-}" ]; then
        info "Stopping server (PID $SERVER_PID)..."
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    # Also kill anything lingering on the port
    local stragglers
    stragglers=$(lsof -ti:$PORT 2>/dev/null || true)
    if [ -n "$stragglers" ]; then
        warn "Killing lingering processes on port $PORT: $stragglers"
        echo "$stragglers" | xargs -r kill 2>/dev/null || true
    fi
}

trap cleanup EXIT INT TERM

# Kill anything already on the port
existing=$(lsof -ti:$PORT 2>/dev/null || true)
if [ -n "$existing" ]; then
    warn "Port $PORT already in use, killing: $existing"
    echo "$existing" | xargs -r kill 2>/dev/null || true
    sleep 1
fi

# Make sure build is current
if [ ! -f dist/quikdown_edit.esm.min.js ]; then
    info "No dist build found, building..."
    npm run build
fi

# Start the static server in background
info "Starting static server on port $PORT..."
npx serve . -l $PORT > /tmp/quikdown-e2e-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready
for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -sf "http://localhost:$PORT/" > /dev/null 2>&1; then
        info "Server ready at http://localhost:$PORT"
        break
    fi
    if [ "$i" = "10" ]; then
        err "Server failed to start within 10 seconds"
        cat /tmp/quikdown-e2e-server.log
        exit 1
    fi
    sleep 1
done

# Run Playwright tests — disable webServer since we manage it ourselves
info "Running Playwright tests: $*"
NO_WEBSERVER=1 npx playwright test --config=playwright.config.cjs "$@"
EXIT_CODE=$?

info "Tests complete (exit code: $EXIT_CODE)"
exit $EXIT_CODE
