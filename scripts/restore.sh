#!/bin/sh
# Zet een back-up terug. Gebruik: ./scripts/restore.sh backups/bijles-JJJJMMDD-UUMMSS.sql.gz
set -eu
cd "$(dirname "$0")/.."
[ -f "${1:-}" ] || { echo "Gebruik: $0 <back-upbestand.sql.gz>"; exit 1; }
printf "Dit overschrijft de huidige database. Doorgaan? [j/N] "; read -r a; [ "$a" = "j" ] || exit 1
docker compose stop api worker
gunzip -c "$1" | docker compose exec -T db sh -c 'psql -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose start api worker
echo "Teruggezet."
