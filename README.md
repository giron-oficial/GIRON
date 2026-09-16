# GIRON

Plataforma SaaS white-label de gestão e automação para microcrédito.

## O que é

O GIRON não empresta dinheiro a ninguém. É um sistema que outros donos de operação de crédito (chamados de **Fomentados**) pagam mensalidade pra usar, gerenciando a própria carteira de clientes dentro da própria conta.

## Como funciona

- Cada Fomentado acessa por um subdomínio próprio (ex: `joao.giron.app`)
- Sistema multi-tenant: um banco só, isolado por `tenant_id`
- White-label: cada Fomentado personaliza cor e logo
- Cobrança por mensalidade fixa — se vencer sem pagar, o acesso é bloqueado automaticamente

## Infraestrutura

- VPS: Hostinger, Ubuntu 24.04 LTS
- Banco de dados: Postgres + Supabase self-hosted
- Roteamento por subdomínio

## Estrutura do projeto

- `backend/` — API e lógica do sistema
- `frontend/` — interface visual
- `docs/` — documentação do projeto

## Status

Em construção. Roadmap:
1. ✅ Contratar VPS
2. ✅ Criar repositório GitHub
3. 🔄 Instalar banco de dados
4. ⏳ Construir a aplicação
5. ⏳ Ligar agentes de IA de monitoramento
