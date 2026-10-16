#!/bin/bash
# Roda os testes da amortizacao do Recorrente (exemplo do dono, estorno, atrasados, quitacao, seguranca).
# Tudo roda dentro de uma transacao que e desfeita no fim: nao deixa dado nenhum.
# Uso: ./scripts/testar-amortizacao.sh teste
set -euo pipefail
AMB="${1:?informe o ambiente: teste ou producao}"
cd "$(dirname "$0")/../supabase/testes"
R=$(ssh giron-vps "docker exec -i giron-$AMB-db psql -U postgres -q -tA" < amortizacao.sql 2>&1 | grep -E "PASSOU|FALHOU|ERROR" || true)
echo "$R"
echo "$R" | grep -q -E "FALHOU|ERROR" && { echo "RESULTADO: TEM FALHA"; exit 1; }
echo "RESULTADO: $(echo "$R" | grep -c PASSOU) testes, todos passaram"
