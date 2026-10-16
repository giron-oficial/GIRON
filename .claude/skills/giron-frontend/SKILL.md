---
name: giron-frontend
description: Regras do visual do GIRON (tema escuro com verde). Use SEMPRE que for criar, mudar ou revisar qualquer tela, componente, cor, fonte ou layout em frontend/ — painel, clientes, contratos, login, link de cadastro, menus, botões.
--# GIRON — visual escuro com verde

O dono (Tom) aprovou em 14/10/2026 o visual **escuro com verde neon**: **opção A no computador** (menu lateral fixo, painel em faixas) e **opção B no celular** (barra de baixo com o "+" no meio e a aba "Resumo"). Substitui o Pulso Claro (01/10), que NÃO vale mais.
Modelo: https://claude.ai/artifact/NqxuhdY8gcq1PwyeYbsSC7 . Aplicado no sistema em 16/10/2026.
Ele não quer cara de SaaS genérico e **não quer parecido com o CredPlus** (azul-marinho com vidro e dourado): aqui é preto-azulado + verde neon, sem dourado, sem vidro.

## Princípios

1. **Celular primeiro.** Toda tela tem que funcionar com 390 px de largura, botões de pelo menos 44 px.
2. **Informação primordial no topo.** Painel: capital em trânsito (cartão verde-escuro com brilho verde, o maior); no computador, ao lado, o cartão "<mês> até agora" (juros, capital recebido, emprestado); depois as 4 situações; depois "Cobrar agora" + "Clientes do mês". No celular os números do mês vão pro fim (âncora `#resumo`, aberta pela aba "Resumo").
3. **Escuro e calmo, com o verde só no que importa.** Cartões `cartao` (azul-escuro com borda fina, sem sombra). Verde neon = botão principal, link, item ativo do menu, WhatsApp.
4. **Situações em cor CHEIA, com degradê da mesma cor** e letras brancas (objeto `situacoes` de `pages/Inicio.tsx`). Bolinha do "vence hoje" vermelha piscando (`anima-pulso`).
5. **Português simples na tela.** Sem termos técnicos e sem emoji na interface.

## Tokens (definidos em `frontend/src/index.css`, bloco `@theme`)

| Token (classe Tailwind) | Valor | Uso |
|---|---|---|
| `fundo` | #0B0F1A | fundo da página |
| `superficie` / `superficie-2` | #121A2C / #1A2338 | cartões / campos, linhas, hover |
| `borda` | #1E2840 | bordas finas |
| `texto` / `suave` | #E8ECF5 / #8B93A7 | texto principal / secundário |
| `tinta` | #0F1524 | menu lateral e barra de baixo |
| `marca` / `marca-brilho` | #7CFFB2 | verde neon: link, ativo, destaque |
| `marca-clara` | #2EE6A6 | começo de degradê verde (barrinhas) |
| `sobre-verde` | #06110C | letra em cima do verde |
| `critico` / `vencido` / `hoje` / `amanha` | #A48CFF / #FF7A7A / #6AA6FF / #FBB224 | cores das situações (texto ou fundo `/15`) |
| `sobre-amanha` | #2A1A00 | letra em cima do amarelo cheio |

Selos e avisos: fundo da cor com `/15` e texto na própria cor (ex.: `bg-vencido/15 text-vencido`). **Não use** `bg-white`, `text-slate-*` nem tons pastel claros (#FFE9E8 etc.): somem ou ofuscam no escuro.
Fonte: **uma só, Plus Jakarta Sans** (não misturar). Números com `tabular-nums`, dinheiro em 700–800.
Utilitários: `cartao` e `verde` (fundo #7CFFB2, letra escura). Cantos: 18 px nos cartões grandes, 14 px em cartões menores, 12–16 px em botões.

.

## Campos de digitar (regras do dono, 01/10/2026)

- **Valor a preencher aparece em CINZA** (placeholder). Não deixe número "de exemplo" preto dentro do campo: preto é só o que a pessoa digitou ou um dado real do cliente.
- **Dinheiro sempre no formato do Brasil enquanto digita:** use `mascaraReais()` (os números entram pela direita: 150000 → 1.500,00) com "R$" fixo na frente do campo; mostrar com `reais()` ou `reaisCampo()`.
- **Porcentagem completa, sem arredondar**, com vírgula: `percentualCompleto()` (ex.: 5,676594878984537). Digitação com `mascaraPercentual()`.
- **Juro ligado nos dois sentidos:** digitou o %, aparece o valor em R$; digitou o valor em R$, aparece o % (ver `pages/EmprestimoNovo.tsx`). Mudou o valor emprestado ou o prazo, recalcula o lado que não foi digitado por último.
- O banco guarda o % com 8 casas depois da vírgula (`numeric(12,8)`); a diferença é desprezível (frações de centavo).

## Peças prontas — reutilize, não recrie

- `components/Moldura.tsx`: computador = menu lateral fixo (opção A); celular = barra do topo (logo + iniciais que abrem conta/plano/Sair) e barra de baixo Início · Clientes · + · Calcular · Resumo (opção B). Toda tela interna fica dentro dela.
- `components/Tela.tsx`: Moldura + "← Voltar" + título/subtítulo + `acoes` + `largo`.
- `components/estilo.ts`: `campo`, `rotulo`, `botaoVerde`, `botaoClaro`, `botaoEscuro`, `tituloSecao`, `erroCaixa`, selos, `iniciais()`.
- `components/Icone.tsx`: ícones de traço (24x24, traço 1.8).
- `lib/formatos.ts`, `lib/painel.ts`; `pages/Inicio.tsx` é a referência do tema.

## Telas

No visual novo (16/10/2026): painel, clientes (lista, ficha, novo), novo empréstimo, contrato, calculadora e login. **Ainda no visual antigo claro:** link de cadastro (`LinkCadastro.tsx`, a tela que o CLIENTE do Fomentado abre) e `Status.tsx` — o dono ainda não decidiu se a tela do cliente final fica escura.

## Antes de entregar

- Teste em 390 px e em 1280 px: nada cortado, nada saindo pro lado (valores em R$ grandes não podem virar "R$ 21.5…").
- Rode `npm run build` dentro de `frontend/` e confira se não há erro.
- Publique no teste com `./scripts/publicar-teste.sh` e registre no `06-ESPECIFICACAO/HISTORICO-DE-IMPLEMENTACAO.md` do cofre GIRON-CEREBRO.
