---
name: giron-frontend
description: Regras do visual do GIRON (tema Azul Espacial). Use SEMPRE que for criar, mudar ou revisar qualquer tela, componente, cor, fonte ou layout em frontend/ — painel, clientes, contratos, login, link de cadastro, menus, botões.
---

# GIRON — visual Azul Espacial

O dono (Tom) escolheu em **26/10/2026** o tema **Azul Espacial**: fundo azul quase preto, cartões azul-marinho com borda fina, números grandes em branco, azul da marca nos botões e destaques e brilho azul-claro nos gráficos. Substitui o "Escuro com verde" (14/10), que NÃO vale mais. Pedido do dono: **onde era verde, agora é azul**.
Design system: https://claude.ai/artifact/KjvviGQ4z2ErdmHb6xobkj . Aplicado no sistema em 26/10/2026.
Layout continua o mesmo: **opção A no computador** (menu lateral fixo, painel em faixas) e **opção B no celular** (barra de baixo com o "+" no meio e a aba "Resumo").
Ele não quer cara de SaaS genérico e **não quer parecido com o CredPlus** (azul-marinho com vidro e dourado): aqui não tem dourado nem vidro nos cartões. **Exceção pedida pelo dono (16/10/2026): o liga/desliga é em VIDRO (glass)** — `components/Interruptor.tsx`, use em TODO lugar que é "sim ou não" (nunca caixinha de marcar); nas páginas claras do cliente, passe `claro`.

## Princípios

1. **Celular primeiro.** Toda tela tem que funcionar com 390 px de largura, botões de pelo menos 44 px.
2. **Informação primordial no topo.** Painel: capital em trânsito (cartão azul-escuro com brilho azul, o maior); no computador, ao lado, o cartão "<mês> até agora" (juros, capital recebido, emprestado); depois as 4 situações; depois "Cobrar agora" + "Clientes do mês". No celular os números do mês vão pro fim (âncora `#resumo`, aberta pela aba "Resumo").
3. **Escuro e calmo, com o azul só no que importa.** Cartões `cartao` (azul-escuro com borda fina, sem sombra). Azul da marca (`marca`) = botão principal, link, item ativo do menu. WhatsApp = vidro verde (`zap`). Verde (`sucesso`) só pra "em dia", alta e pagamento recebido.
4. **Situações em cor CHEIA, com degradê da mesma cor** e letras brancas (objeto `situacoes` de `pages/Inicio.tsx`). Bolinha do "vence hoje" vermelha piscando (`anima-pulso`).
5. **Português simples na tela.** Sem termos técnicos e sem emoji na interface.

## Tokens (definidos em `frontend/src/index.css`, bloco `@theme`)

Os nomes antigos foram mantidos pra não mexer em todas as telas: `marca`, `sobre-verde` e a utility `verde` agora são AZUIS.

| Token (classe Tailwind) | Valor | Uso |
|---|---|---|
| `fundo` | #050A16 | fundo da página (azul quase preto) |
| `superficie` / `superficie-2` | #0A1426 / #0F1D36 | cartões / campos, linhas, hover |
| `borda` | #1B2D4F | bordas finas |
| `texto` / `suave` | #EEF4FF / #8EA3C4 | texto principal / secundário |
| `tinta` | #07101F | menu lateral e barra de baixo |
| `marca` | #2F80FF | azul da marca: botão principal, link, ativo |
| `marca-clara` / `marca-brilho` | #4CC2FF | brilho: começo de degradê, pontos dos gráficos |
| `sobre-verde` | #FFFFFF | letra em cima do azul da marca (nome antigo) |
| `sucesso` | #34D17A | em dia, alta (▲), pagamento recebido |
| `critico` / `vencido` / `hoje` / `amanha` | #A37BFF / #F0525C / #3FA9FF / #F5C02E | cores das situações (texto ou fundo `/15`) — regra fixa |
| `sobre-amanha` | #2A1A00 | letra em cima do amarelo cheio |

Cartões de destaque (capital em trânsito, "Cliente vai pagar", contrato): degradê de #0C2550 pra `superficie`, borda #1D3D75, rótulo #BFD8FF.
Selos e avisos: fundo da cor com `/15` e texto na própria cor (ex.: `bg-vencido/15 text-vencido`). **Não use** `bg-white`, `text-slate-*` nem tons pastel claros: somem ou ofuscam no escuro.
Fontes: **Exo 2** nos títulos e números grandes (`font-display`, h1–h3) e **Inter** no resto (`font-sans`), as duas do Google Fonts. Números com `tabular-nums`, dinheiro em 700–800. **Dinheiro SEMPRE com centavos** (`reais()`, ex.: R$ 3.000,00) — nunca esconder o ",00" (regra do dono, 26/10/2026). Números do painel grandes; em colunas estreitas use tamanho que se ajusta ao espaço (`@container` + `text-[clamp(...cqi...)]`) em vez de cortar.
Utilitários: `cartao`, `vidro` (painel de vidro azul-escuro: cartões de destaque do painel, todos iguais), `verde` (botão principal em **vidro azul**, letra branca) e `zap` (**vidro verde** — TODO botão de WhatsApp: Cobrar, Mandar, Enviar; em `estilo.ts` é `botaoZap`). Cartões das 4 situações no painel são de **vidro da própria cor** (`pages/Inicio.tsx`). Cantos: 18 px nos cartões grandes, 14 px em cartões menores, 12–16 px em botões.

## Campos de digitar (regras do dono, 01/10/2026)

- **Valor a preencher aparece em CINZA** (placeholder). Não deixe número "de exemplo" preto dentro do campo: preto é só o que a pessoa digitou ou um dado real do cliente.
- **Dinheiro sempre no formato do Brasil enquanto digita:** use `mascaraReais()` (os números entram pela direita: 150000 → 1.500,00) com "R$" fixo na frente do campo; mostrar com `reais()` ou `reaisCampo()`.
- **Porcentagem completa, sem arredondar**, com vírgula: `percentualCompleto()` (ex.: 5,676594878984537). Digitação com `mascaraPercentual()`.
- **Juro ligado nos dois sentidos:** digitou o %, aparece o valor em R$; digitou o valor em R$, aparece o % (ver `pages/EmprestimoNovo.tsx`). Mudou o valor emprestado ou o prazo, recalcula o lado que não foi digitado por último.
- O banco guarda o % com 8 casas depois da vírgula (`numeric(12,8)`); a diferença é desprezível (frações de centavo).

## Peças prontas — reutilize, não recrie

- `components/Moldura.tsx`: computador = menu lateral fixo (opção A) com **fogo azul vivo por trás de vidro** (`components/FogoAzul.tsx` + `.fogo-azul` no index.css; peças de dentro com `vidro-menu`); celular = barra do topo (logo + iniciais que abrem conta/plano/Sair) e barra de baixo Início · Clientes · + · Calcular · Resumo (opção B). Toda tela interna fica dentro dela.
- `components/Tela.tsx`: Moldura + "← Voltar" + título/subtítulo + `acoes` + `largo`.
- `components/estilo.ts`: `campo`, `rotulo`, `botaoVerde`, `botaoClaro`, `botaoEscuro`, `tituloSecao`, `erroCaixa`, selos, `iniciais()`.
- `components/Icone.tsx`: ícones de traço (24x24, traço 1.8).
- `lib/formatos.ts`, `lib/painel.ts`; `pages/Inicio.tsx` é a referência do tema.

## Telas

No visual novo (16/10/2026): painel, clientes (lista, ficha, novo), novo empréstimo (e o modo "Transformar em parcelado"), contrato, calculadora, configurações e login. Multa e juro de atraso: sempre pela `lib/atraso.ts` (não refazer a conta na tela). **Ainda no visual antigo claro:** link de cadastro (`LinkCadastro.tsx`, a tela que o CLIENTE do Fomentado abre) e `Status.tsx` — o dono ainda não decidiu se a tela do cliente final fica escura.

## Antes de entregar

- Teste em 390 px e em 1280 px: nada cortado, nada saindo pro lado (valores em R$ grandes não podem virar "R$ 21.5…").
- Rode `npm run build` dentro de `frontend/` e confira se não há erro.
- Publique no teste com `./scripts/publicar-teste.sh` e registre no `06-ESPECIFICACAO/HISTORICO-DE-IMPLEMENTACAO.md` do cofre GIRON-CEREBRO.
