#!/usr/bin/env bash
# Dump do Postgres de produção, compactado, com cópia opcional para o S3.
# Uso (cron diário): 0 6 * * * /home/ubuntu/brios3d_forge/deploy/backup.sh >> /home/ubuntu/backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")"

# Só as variáveis de backup; as credenciais do banco são lidas dentro do container.
BACKUP_S3_URI="$(grep -E '^BACKUP_S3_URI=' .env | cut -d= -f2- || true)"
BACKUP_KEEP_DAYS="$(grep -E '^BACKUP_KEEP_DAYS=' .env | cut -d= -f2- || true)"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-7}"

mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
file="backups/forge-${stamp}.sql.gz"

# Grava num .partial e só renomeia se o pg_dump terminar bem.
docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges' \
  | gzip > "${file}.partial"
mv "${file}.partial" "$file"
echo "$(date -u +%FT%TZ) dump ok: $file ($(du -h "$file" | cut -f1))"

if [ -n "$BACKUP_S3_URI" ]; then
  aws s3 cp "$file" "${BACKUP_S3_URI%/}/" --only-show-errors
  echo "$(date -u +%FT%TZ) enviado para ${BACKUP_S3_URI%/}/"
fi

find backups -name 'forge-*.sql.gz' -mtime +"$BACKUP_KEEP_DAYS" -delete
