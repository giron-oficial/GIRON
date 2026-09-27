#!/bin/bash
# Aplica no banco as migracoes (supabase/migrations/*.sql) que ainda nao foram aplicadas.
# Uso: ./scripts/aplicar-migracoes.sh teste
# Faz backup antes. Registra o que foi aplicado em giron_admin.migracoes.
set -euo pipefail
AMB="${1:?informe o ambiente: teste ou producao}"
DB="giron-$AMB-db"
cd "$(dirname "$0")/../supabase/migrations"
psql_vps(){ ssh giron-vps "docker exec -i $DB psql -U postgres -v ON_ERROR_STOP=1 -q $*"; }
echo "create schema if not exists giron_admin; create table if not exists giron_admin.migracoes (arquivo text primary key, aplicada_em timestamptz not null default now());" | psql_vps
FEITAS=$(echo "select arquivo from giron_admin.migracoes" | psql_vps -tA)
PEND=(); for f in [0-9]*.sql; do grep -qx "$f" <<<"$FEITAS" || PEND+=("$f"); done
[ ${#PEND[@]} -eq 0 ] && { echo "Nada novo para aplicar."; exit 0; }
echo "Vai aplicar: ${PEND[*]}"
ssh giron-vps "/opt/giron/scripts/backup.sh $AMB" | tail -1
for f in "${PEND[@]}"; do
  echo "-> $f"
  psql_vps < "$f"
  echo "insert into giron_admin.migracoes (arquivo) values ('$f');" | psql_vps
done
echo "OK"
