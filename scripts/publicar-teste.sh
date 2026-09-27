#!/bin/bash
# Compila as telas e publica no ambiente de TESTE (VPS do GIRON).
# Uso (na pasta do projeto): ./scripts/publicar-teste.sh
set -euo pipefail
cd "$(dirname "$0")/../frontend"
npm run build
rsync -a --delete dist/ giron-vps:/opt/giron/app-teste/html/
echo "Publicado em https://teste.2-25-228-237.sslip.io"
