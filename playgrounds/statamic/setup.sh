#!/usr/bin/env bash
# Creates a local Statamic site in this folder with the headquery addon linked.
#
# Usage: ./setup.sh [--local | --ddev] [--no-seed]
#   --local    use the PHP and Composer installed on this machine
#   --ddev     run everything inside a DDEV project (https://ddev.com)
#   --no-seed  skip copying the demo content model from seed/ (blank Statamic site)
# Without --local/--ddev you are asked interactively (non-interactive default: --local).
set -euo pipefail
cd "$(dirname "$0")"

DDEV_PROJECT="headquery-statamic"
DDEV_URL="https://${DDEV_PROJECT}.ddev.site"

mode=""
seed=1
for arg in "$@"; do
  case "$arg" in
    --local) mode="local" ;;
    --ddev) mode="ddev" ;;
    --no-seed) seed=0 ;;
    -h|--help)
      sed -n '2,8p' "$(basename "$0")" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      echo "Unknown option: $arg (use --local or --ddev)" >&2
      exit 1
      ;;
  esac
done

if [ -f artisan ]; then
  echo "Statamic is already installed here." >&2
  exit 0
fi

if [ -z "$mode" ]; then
  if [ -t 0 ]; then
    read -r -p "Set up with [1] local PHP or [2] DDEV? [1] " choice
    case "${choice:-1}" in
      1|local) mode="local" ;;
      2|ddev) mode="ddev" ;;
      *) echo "Invalid choice: $choice" >&2; exit 1 ;;
    esac
  else
    mode="local"
  fi
fi

require() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      echo "'$cmd' is required for the $mode setup but was not found." >&2
      exit 1
    fi
  done
}

if [ "$mode" = "ddev" ]; then
  require ddev
  run_composer() { ddev composer "$@"; }
  # `ddev composer create-project` refuses subdirectories, so bypass the wrapper.
  run_create_project() { ddev exec composer create-project "$@"; }
  run_php() { ddev exec php "$@"; }
  run_bash() { ddev exec bash "$@"; }
  # With Mutagen (default on macOS) host and container are synced asynchronously.
  # Flush after host-side writes the container needs and vice versa. No-op otherwise.
  sync_files() { ddev mutagen sync >/dev/null 2>&1 || true; }
else
  require php composer
  run_composer() { composer "$@"; }
  run_create_project() { composer create-project "$@"; }
  run_php() { php "$@"; }
  run_bash() { bash "$@"; }
  sync_files() { :; }
fi

echo "Setting up the Statamic playground ($mode)..."

if [ "$mode" = "ddev" ]; then
  if [ ! -f .ddev/config.yaml ]; then
    ddev config \
      --project-name="$DDEV_PROJECT" \
      --project-type=laravel \
      --docroot=public \
      --create-docroot \
      --php-version=8.3
  fi
  # The addon lives outside the DDEV project root. Mount the monorepo's packages/ at
  # /var/packages: the container's project root is /var/www/html, so the Composer path
  # repository ../../packages/php/statamic resolves on the host and in the container alike.
  cat > .ddev/docker-compose.headquery.yaml <<'YAML'
services:
  web:
    volumes:
      - ${DDEV_APPROOT}/../../packages:/var/packages
YAML
  ddev start
fi

# Install into a temp dir inside this folder (visible to the DDEV container), then move
# the files next to README.md / setup.sh without overwriting them. The move runs where
# Composer ran (container or host), so Mutagen doesn't have to shuffle vendor/ around.
tmp=".hq-install"
rm -rf "$tmp"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp"
cat > "$tmp/move.sh" <<'SH'
set -euo pipefail
shopt -s dotglob
for f in .hq-install/site/*; do
  name="$(basename "$f")"
  case "$name" in README.md|setup.sh|seed|.ddev) continue ;; esac
  rm -rf "./$name"
  mv "$f" .
done
rm -rf .hq-install/site
SH
sync_files
run_create_project statamic/statamic "$tmp/site" --prefer-dist --no-interaction
run_bash "$tmp/move.sh"
sync_files
rm -rf "$tmp"

if [ ! -f artisan ]; then
  echo "Statamic install failed: no artisan file in $(pwd)." >&2
  exit 1
fi

run_composer config repositories.headquery path ../../packages/php/statamic
run_composer config minimum-stability dev
run_composer config prefer-stable true
run_composer require headquery/statamic:@dev --no-interaction

# Set KEY=VALUE in .env, replacing an existing line or appending a new one.
set_env() {
  if grep -q "^$1=" .env; then
    sed -i.bak "s|^$1=.*|$1=$2|" .env && rm -f .env.bak
  else
    printf '%s=%s\n' "$1" "$2" >> .env
  fi
}

[ "$mode" = "ddev" ] && set_env APP_URL "$DDEV_URL"
# The REST API (and more than one user) requires Statamic Pro; free for local development.
set_env STATAMIC_PRO_ENABLED true
set_env STATAMIC_API_ENABLED true
set_env HEADQUERY_SCHEMA_ROUTE true
set_env HEADQUERY_SCHEMA_TOKEN dev-schema-token
sync_files

if [ "$seed" = 1 ]; then
  # Demo content model (collection, taxonomy, globals, navigation, assets) plus
  # config/statamic/api.php exposing it. Overwrites the skeleton's api.php.
  echo "Copying demo content from seed/..."
  cp -R seed/. .
  sync_files
  run_php please stache:refresh
fi

run_php please make:user --super || true

echo
if [ "$mode" = "ddev" ]; then
  echo "Done. Open ${DDEV_URL} (ddev launch)."
else
  echo "Done. Run: php artisan serve"
fi
if [ "$seed" = 0 ]; then
  echo "Expose resources in config/statamic/api.php to use the REST API."
fi
