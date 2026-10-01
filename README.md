# GIRON

Plataforma SaaS white-label de gestão e automação para microcrédito.

O GIRON não empresta dinheiro a ninguém. É um sistema que donos de operação de crédito (os **Fomentados**) pagam mensalidade para usar, gerenciando a própria carteira de clientes dentro da própria conta.

## Estrutura

- `frontend/` — telas do sistema (React + TypeScript + Tailwind), feitas primeiro para celular.
- `supabase/migrations/` — criação das tabelas do banco (SQL, em ordem).
- `scripts/` — atalhos (ex.: publicar no ambiente de teste).

## Rodar no computador

```bash
cd frontend
cp .env.example .env   # preencher a chave pública (anon)
npm install
npm run dev
```

## Ambientes

- **Teste:** `https://teste.gironga.com.br` (o provisório `teste.2-25-228-237.sslip.io` continua de reserva).
- **Produção:** ainda não existe.

## Regras

- Nunca colocar senhas, tokens ou dados reais de clientes neste repositório (ele é público).
- Documentação completa e decisões do projeto ficam no cofre privado (GIRON-CEREBRO).
