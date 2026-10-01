---
name: giron-frontend
description: Regras do visual do GIRON (tema "Pulso"). Use SEMPRE que for criar, mudar ou revisar qualquer tela, componente, cor, fonte ou layout em frontend/ — painel, clientes, contratos, login, link de cadastro, menus, botões.
---

# GIRON — tema Pulso

O dono (Tom) aprovou o tema **Pulso** em 01/10/2026 e não quer nada com cara de SaaS genérico.
Fonte visual: canvas no Claude Design https://claude.ai/artifact/D39ZyGM9XKzJuzwFjpc4RA
(artboards "4 · Pulso — celular" e "4 · Pulso — computador"). As outras propostas daquele canvas foram RECUSADAS: não copie nada delas.

## Princípios

1. **Celular primeiro.** O Fomentado usa o GIRON andando, no celular. Toda tela tem que funcionar bem com 390 px de largura, com botões de pelo menos 44 px. O computador é a versão ampliada.
2. **Informação primordial no topo.** No painel: capital em trânsito (destaque verde, maior), depois juros recebidos, capital recebido e emprestado no mês; logo abaixo, as 4 situações.
3. **Escuro, vidro e brilho de cor.** Fundo quase preto azulado, cartões translúcidos (`vidro`), brilhos suaves de verde e azul no fundo. Nada de cartões brancos.
4. **Cor tem significado.** As cores das situações são fixas (ver tabela). Verde é a marca e o dinheiro entrando. Não use essas cores para enfeite.
5. **Português simples na tela.** "Cobrar", "vence hoje", "voltou pro caixa". Sem termos técnicos e sem emoji na interface.

## Tokens (definidos em `frontend/src/index.css`, bloco `@theme`)

| Token (classe Tailwind) | Valor | Uso |
|---|---|---|
| `fundo` | #0A0E17 | fundo da página |
| `superficie` / `superficie-2` | #121826 / #1A2232 | áreas sólidas, hover |
| `borda` | #252F42 | divisórias sólidas |
| `texto` / `suave` | #EEF2F7 / #8B95A7 | texto principal / secundário |
| `marca` / `marca-escura` / `sobre-marca` | #3DDC97 / #1E9E6A / #06281A | botão principal, destaque, texto em cima do verde |
| `critico` | #A78BFA (roxa) | crítico: atraso a partir de `dias_para_critico` |
| `vencido` | #F87171 (vermelha) | venceu (1 dia até virar crítico) |
| `hoje` | #60A5FA (azul) | vence hoje (bolinha pulsa: `anima-pulso`) |
| `amanha` | #FBBF24 (amarela) | vence amanhã |

Fontes: `font-display` = **Sora** (títulos e números de dinheiro), `font-sans` = **Manrope** (resto). Carregadas no `index.html`.

Utilitário `vidro`: fundo branco 4% + borda branca 8%. Use em cartões comuns.
Cartão de destaque (só o capital em trânsito): `border-marca/35 bg-linear-150 from-marca/30 to-marca/5`.
Cartão de situação: `bg-linear-to-b from-<cor>/20 to-white/[0.02] border-<cor>/30`.
Botão principal: `bg-linear-135 from-marca to-marca-escura text-sobre-marca font-bold shadow-lg shadow-marca/25`, cantos `rounded-xl`/`rounded-2xl`.

## Peças prontas — reutilize, não recrie

- `components/Moldura.tsx`: menu lateral (computador) + barra flutuante embaixo (celular). Toda tela interna fica dentro dela.
- `components/Tela.tsx`: Moldura + "← Voltar" + título. Use em telas simples.
- `components/Icone.tsx`: ícones de traço. Precisa de um novo? Acrescente o desenho lá (24x24, traço 1.8).
- `lib/formatos.ts`: `reais()`, `dataBr()`, `linkWhatsApp()`, `nomeModalidade`.
- `lib/painel.ts`: números do painel e classificação das situações.

## Atenção: paleta antiga remapeada

As telas feitas antes do Pulso usam `bg-white`, `text-slate-600`, `bg-emerald-600` etc. No `@theme` essas cores foram **remapeadas para o escuro** (`white` virou #121826, `slate-900` virou texto claro...). Isso é provisório.
- Em código novo, **use só os tokens da tabela**, nunca `white`/`slate`/`emerald`/`red`/`amber`.
- Ao mexer numa tela antiga, aproveite e troque as classes antigas pelos tokens.
- Não use `bg-white/5` pensando em branco translúcido: `white` agora é escuro. Use `vidro` ou `bg-[rgb(255_255_255/0.05)]`.

## Antes de entregar

- Teste em 390 px e em 1280 px: nada cortado, nada saindo pro lado.
- Rode `npm run build` dentro de `frontend/` e confira se não há erro.
- Publique no teste com `./scripts/publicar-teste.sh` e registre no `06-ESPECIFICACAO/HISTORICO-DE-IMPLEMENTACAO.md` do cofre GIRON-CEREBRO.
