#!/bin/sh
# Maakt een back-up van de database in ./backups (bewaart de laatste 14).
# Gebruik: ./scripts/backup.sh     (bv. dagelijks via cron op je homeserver)
set -eu
cd "$(dirname "$0")/.."
mkdir -p backups
FILE="backups/bijles-$(date +%Y%m%d-%H%M%S).sql.gz"
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' | gzip > "$FILE"
echo "Back-up gemaakt: $FILE"
ls -1t backups/bijles-*.sql.gz | tail -n +15 | xargs -r rm --
