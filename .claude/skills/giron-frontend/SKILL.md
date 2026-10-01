---
name: giron-frontend
description: Regras do visual do GIRON (tema "Pulso Claro"). Use SEMPRE que for criar, mudar ou revisar qualquer tela, componente, cor, fonte ou layout em frontend/ — painel, clientes, contratos, login, link de cadastro, menus, botões.
---

# GIRON — tema Pulso Claro

O dono (Tom) aprovou o tema **Pulso Claro** em 01/10/2026. Ele não quer nada com cara de SaaS genérico e **não quer parecido com o CredPlus** (o CredPlus é escuro, azul-marinho, com bordas de vidro, dourado e letra pesada: evite tudo isso).
Fonte visual: canvas no Claude Design https://claude.ai/artifact/D39ZyGM9XKzJuzwFjpc4RA
(artboards "4 · Pulso CLARO — celular" e "4 · Pulso CLARO — computador"). As outras propostas do canvas foram RECUSADAS, inclusive o Pulso escuro.

## Princípios

1. **Celular primeiro.** O Fomentado usa o GIRON andando, no celular. Toda tela tem que funcionar bem com 390 px de largura, com botões de pelo menos 44 px. O computador é a versão ampliada.
2. **Informação primordial no topo.** No painel: capital em trânsito (cartão verde-escuro → preto, o maior), depois juros recebidos, capital recebido e emprestado no mês (cartões brancos menores); logo abaixo, as 4 situações.
3. **Claro e leve, com pontos fortes de cor.** Fundo cinza bem claro com brilho suave de verde e lilás no alto, cartões brancos com sombra leve (sem borda), menus em preto (`tinta`).
4. **Situações em cor CHEIA, com degradê da mesma cor.** Os cartões de críticos/vencidos/hoje/amanhã são pintados inteiros (pedido do dono: "uma cor só, não deixa branco"), num degradê de 135° do tom claro pro forte da MESMA cor (valores no objeto `situacoes` de `pages/Inicio.tsx`). Texto branco; no amarelo, texto escuro (`sobre-amanha`).
5. **Português simples na tela.** "Cobrar", "vence hoje", "voltou pro caixa". Sem termos técnicos e sem emoji na interface.

## Tokens (definidos em `frontend/src/index.css`, bloco `@theme`)

| Token (classe Tailwind) | Valor | Uso |
|---|---|---|
| `fundo` | #F5F6F8 | fundo da página |
| `superficie` / `superficie-2` | #FFFFFF / #F0F1F4 | cartões / trilhos, divisórias, hover |
| `borda` | #E6E8EC | linhas finas quando precisar |
| `texto` / `suave` | #111318 / #6B7280 | texto principal / secundário |
| `tinta` | #111318 | menu lateral, barra de baixo, avatar |
| `marca` / `marca-clara` / `marca-brilho` | #0B8A55 / #22D184 / #5BE3A4 | verde: texto-link / começo do degradê / destaque sobre fundo escuro |
| `critico` | #7C5CFA (roxa) | crítico: atraso a partir de `dias_para_critico` |
| `vencido` | #E5484D (vermelha) | venceu (1 dia até virar crítico) |
| `hoje` | #2F6FED (azul) | vence hoje (bolinha VERMELHA piscando: `anima-pulso`, pedido do dono) |
| `amanha` / `sobre-amanha` | #F5A800 / #3D2800 | vence amanhã / texto em cima do amarelo |

Fontes: `font-display` = **Sora** (títulos e números de dinheiro, peso 700–800), `font-sans` = **Manrope** (resto). Carregadas no `index.html`.

Utilitários: `cartao` (branco + sombra suave) e `verde` (degradê #22D184 → #0B8A55 com texto branco: botão principal, "+", WhatsApp).
Cantos: 20 px no celular, 26 px nos cartões grandes do computador, 14 px em botões.

## Peças prontas — reutilize, não recrie

- `components/Moldura.tsx`: menu lateral preto (computador) + barra preta flutuante embaixo (celular). Toda tela interna fica dentro dela.
- `components/Tela.tsx`: Moldura + "← Voltar" + título. Use em telas simples.
- `components/Icone.tsx`: ícones de traço. Precisa de um novo? Acrescente o desenho lá (24x24, traço 1.8).
- `lib/formatos.ts`: `reais()`, `dataBr()`, `linkWhatsApp()`, `nomeModalidade`.
- `lib/painel.ts`: números do painel e classificação das situações.
- `pages/Inicio.tsx`: referência de como aplicar o tema (cores das situações no objeto `situacoes`).

## Telas antigas

Clientes, contratos, empréstimo, login e link de cadastro ainda usam as classes padrão do Tailwind (`bg-white`, `text-slate-600`, `bg-slate-900`...). Elas combinam razoavelmente com o tema claro, mas ainda não têm a cara do Pulso. Ao mexer numa delas, aproveite e troque pelas classes do tema (`cartao`, `verde`, `text-suave`, cores das situações).

## Antes de entregar

- Teste em 390 px e em 1280 px: nada cortado, nada saindo pro lado.
- Rode `npm run build` dentro de `frontend/` e confira se não há erro.
- Publique no teste com `./scripts/publicar-teste.sh` e registre no `06-ESPECIFICACAO/HISTORICO-DE-IMPLEMENTACAO.md` do cofre GIRON-CEREBRO.
