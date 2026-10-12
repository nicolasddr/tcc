# Plano D: Avaliar com o item de entrada à vista

Sugestão 3 da análise de 12/10 (`referencia-visual.html#s3`). Independe dos outros planos.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Item de entrada aberto acima da resposta, resposta rotulada e o prompt recolhido em "Ver o prompt (versão N)" | `feat(avaliar): item de entrada à vista acima da resposta` | ✅ |

## Contexto

- Arquivos: `app/projects/[id]/(tabs)/evaluate/page.tsx`, `evaluation-form.tsx` (`ResponseCard`
  ~107, `Columns` ~166), `context-panel.tsx`; testes `evaluate/page.int.test.ts` e
  `evaluate/context.int.test.ts`.
- Leia as ADRs 0011 (o que o avaliador vê muda o dado) e 0012 (ordem embaralhada, rótulo fixo
  "Resposta N"). O item de entrada já é mostrado hoje, só que fechado; abrir não muda o que o
  avaliador pode ver.
- Só layout: `context.ts`, `queue.ts`, `actions.ts` e `completeness.ts` não mudam.
- Continuam valendo, da série anterior (Plano A de melhorias de layout): duas colunas a partir de
  1024 px com a coluna da esquerda `lg:sticky`, a barra de envio fixa, "+ Justificar" e a escala
  sem cores de semáforo.

## Parte 1

**Hoje**
- Linha do progresso (`page.tsx` ~178): "Resposta 3" + "2 de 6 respostas avaliadas…" + ⓘ.
- Coluna da esquerda (`Columns`): o `ResponseCard` (nome do item, data e o texto da resposta, sem
  rótulo de "resposta") e, abaixo, o `ContextPanel`, um `Disclosure` "O que foi pedido à LLM" com
  nome e descrição do prompt, o texto do prompt e o item de entrada. Abaixo de 1024 px o painel
  sobe para antes da resposta (`order-first lg:order-none`).

**Proposta** (esboço do DEPOIS, coluna da esquerda)

```
┌ Item de entrada · consulta-017 ───────────────┐
│ como funciona a fotossíntese                  │
└───────────────────────────────────────────────┘
┌ Resposta da LLM · Resposta 3        12/10/2026 ┐
│ Informacional. A consulta busca entender…     │
└───────────────────────────────────────────────┘
▸ Ver o prompt (versão 3)
```

- **Item de entrada**: novo bloco aberto, renderizado no servidor (como o `ContextPanel` hoje), com
  o rótulo "Item de entrada · {nome do item}" e o conteúdo na `scrollBoxClass` com
  `preWrapClass`. Exporte de `context-panel.tsx` um `ItemPanel` e um `PromptPanel`.
- **Resposta**: o `ResponseCard` ganha o cabeçalho "Resposta da LLM · {label}" à esquerda e a data
  à direita. O nome do item sai dele, porque agora está no bloco de cima. O `label` ("Resposta 3")
  chega ao `EvaluationForm` por uma prop nova e vale também no modo leitura.
- **Linha do progresso**: perde o `label`; fica "2 de 6 respostas avaliadas por você nesta rodada"
  e o ⓘ. "Resposta N" continua aparecendo uma vez só na tela, agora no cabeçalho da resposta.
- **Prompt**: o `PromptPanel` é o `Disclosure` de hoje sem o bloco do item, com o resumo "Ver o
  prompt (versão {N})". Nome e descrição do prompt continuam dentro dele.
- **Ordem**: a mesma em todas as larguras: item, resposta, prompt recolhido, e o formulário (à
  direita a partir de 1024 px, abaixo antes disso). Sai o `order-first lg:order-none`.
- **Montagem**: o `EvaluationForm` recebe `item` e `context` (o prompt) como `React.ReactNode`, e o
  `Columns` empilha `item`, `ResponseCard` e `context` nessa ordem. O formulário continua sem
  conter os painéis (o teste "o painel fica FORA do formulário" segue valendo para os dois).
- A coluna da esquerda continua `lg:sticky … lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto`:
  item e resposta longos rolam dentro das próprias caixas, e a coluna rola se o conjunto passar da
  altura da tela.

**Passos**
1. **(TDD)** Em `evaluate/page.int.test.ts`:
   - reescreva "o rótulo "Resposta N" aparece uma vez, na linha do progresso…" (~752): agora
     aparece uma vez, **no formulário** (cabeçalho da resposta), nos dois modos;
   - o item de entrada aparece fora de `<details>` com o rótulo "Item de entrada · …";
   - o resumo do `Disclosure` é "Ver o prompt (versão N)" e não contém o item;
   - troque as asserções de "O que foi pedido" (~667, ~705–707).
   Leia cada vermelho antes de mexer no código.
2. `context-panel.tsx`: `ItemPanel` e `PromptPanel`.
3. `evaluation-form.tsx`: props `label` e `item`, `ResponseCard` com cabeçalho, `Columns` na ordem
   nova.
4. `page.tsx`: tira o `label` da linha do progresso e passa `item`, `context` e `label`.

**Pronto quando**
- Em 1280 px, item e resposta ficam visíveis enquanto o avaliador rola o formulário até a última
  definição.
- Em 375 px a ordem é item, resposta, prompt recolhido, formulário, sem rolagem horizontal.
- Um item de muitas linhas rola dentro da caixa.
- O modo leitura (avaliação já enviada) tem o mesmo cabeçalho.
- Um envio de verdade na cena funciona.
- Lint, typecheck e testes passam.
