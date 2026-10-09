# Plano A: Avaliar com a resposta à vista e a escala sem semáforo

Sugestões da referência visual (`docs/plans/melhorias-layout/referencia-visual.html`):
- **Avaliar** (`#s-avaliar`): Partes 1 e 2;
- **Escala** (`#s-escala`): Parte 3.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Duas colunas com a resposta fixa, "Resposta N" uma vez só e navegação na linha do título | `feat(avaliar): resposta fixa ao lado do formulário` | ✅ |
| 2 | "+ Justificar", botões de nota maiores e barra de envio fixa | `feat(avaliar): justificativa sob demanda e barra de envio` | ✅ |
| 3 | Alto, Médio e Baixo sem cores de semáforo, no formulário e na revisão | `refactor(escala): alto, médio e baixo sem cores de semáforo` | ⬜ |

As três partes mexem no mesmo formulário, por isso vêm juntas e nesta ordem. A pílula de nota criada
na Parte 3 é usada depois no Plano B (Parte 5, revisão em linhas).

## Contexto comum

- Arquivos:
  - `app/projects/[id]/(tabs)/evaluate/page.tsx`, `evaluation-form.tsx`, `context-panel.tsx`,
    `scale.ts` (com o teste `scale.unit.test.ts`);
  - `app/projects/[id]/(tabs)/rounds/review-groups-list.tsx` (só na Parte 3);
  - `QueueNav` (`app/components/ui/queue-nav.tsx`), que também é usado na revisão de discordâncias.
- Antes de mexer, leia `docs/CONTEXT.md` (sobretudo Qualidade) e as ADRs 0010 (escala de três
  pontos), 0011 (o que o avaliador vê muda o dado) e 0012 (ordem embaralhada, rótulo fixo). Leia
  também o `AGENTS.md`: é Next 16, e qualquer API nova se confere em `node_modules/next/dist/docs/`.
- Só layout: `actions.ts`, `completeness.ts` e `queue.ts` não mudam.
- Continuam valendo: as descrições visíveis no formulário (commit 1a745ae), "O envio é definitivo."
  junto do botão (commit 91563dc) e a fila sem número de posição (ADR 0012).
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - antes de trocar uma frase, procure a antiga nos testes (`page.int.test.ts`,
    `progress.unit.test.ts`); o `markupTextOf` também lê o texto dos ⓘ;
  - para uma classe vencer as do `buttonClass`, use o sufixo `!`, porque o `cx` não resolve conflito
    de Tailwind.
- Verificação:
  - monte uma cena com uma rodada aberta, 3 definições e o usuário dev como avaliador ativo (na Parte
    3, também uma rodada com revisão de discordâncias);
  - entre por `/dev/login` na `:3100`;
  - confira em 1280 px e em 375 px (a medida de 375 px só vale dentro de um iframe);
  - limpe a cena antes do `npm test` e rode `npm run lint`, `npm run typecheck` e `npm test`.

## Parte 1: duas colunas e "Resposta N" uma vez

**Hoje** (`page.tsx`, de ~150 a ~214) tudo fica numa coluna. Primeiro vem o título "Avaliar na rodada N"
com "Avaliando como …". Depois, a linha com `label` ("Resposta 4"), o progresso e um ⓘ, a barra de
progresso e o `QueueNav`, seguidos do `ContextPanel` ("O que foi pedido à LLM") e do `EvaluationForm`.
O formulário abre com o `ResponseCard` (`evaluation-form.tsx` ~115), que repete o `label`. Quando o
avaliador rola até a última definição, a resposta já saiu da tela.

**Proposta**
- **Linha do título**: "Avaliar na rodada N" e o ⓘ ficam à esquerda, e o `QueueNav` sobe para a
  direita.
  - O `Section` não tem um lugar para isso, então ganha uma prop opcional `action`, mostrada à
    direita do `<h2>`. Não coloque botões dentro do heading.
  - "Avaliando como {nome}" vai para o texto do ⓘ do título, porque nenhum texto some.
- **"Resposta N" uma vez só**: o `label` fica apenas na linha do progresso. O `ResponseCard` passa a
  mostrar só o item e a data, também no modo leitura (avaliação já enviada).
- **Duas colunas a partir de 1024 px** (`lg:`):
  - a resposta fica à esquerda, com "O que foi pedido à LLM" logo abaixo dela, e o formulário fica à
    direita;
  - a coluna da esquerda usa `lg:sticky lg:top-4 lg:self-start`, e também
    `lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto` para que uma resposta longa não fique presa.
- **Abaixo de 1024 px**, a ordem continua a de hoje: "O que foi pedido à LLM", depois a resposta,
  depois o formulário. Use `order-*` para isso, sem duplicar o markup.
- **Montagem**: o `ContextPanel` é renderizado no servidor (`page.tsx`) e a `ResponseCard` vive dentro
  do formulário, que é client. O `EvaluationForm` recebe o painel pronto por uma prop (ex.:
  `context?: React.ReactNode`) e monta o grid. O modo leitura usa o mesmo grid.
- O `Alert` "Avaliação enviada…" continua acima do grid.
- Confira se algum ancestral (`PageShell` ou o layout `(tabs)`) tem `overflow` diferente de `visible`.
  Se tiver, o `sticky` não funciona.

**Pronto quando**
- Em 1280 px, a resposta continua visível enquanto o avaliador rola até a última definição.
- Em 375 px, a tela tem uma coluna, na ordem de hoje, sem rolagem horizontal.
- "Resposta N" aparece uma vez só, tanto no formulário quanto no modo leitura.
- Anterior e Próxima ficam na linha do título.
- Os testes estão ajustados e lint, typecheck e testes passam.

## Parte 2: "+ Justificar", botões md e barra de envio

**Hoje** (`evaluation-form.tsx`, de ~255 a ~335) cada critério tem os três botões em `size: 'sm'`
(28 px) e um `Textarea` de justificativa sempre aberto. Com 3 definições são seis caixas. O botão
"Enviar avaliação" e "O envio é definitivo." ficam no fim do formulário, com a frase
`incompleteMessage(missing)` logo acima.

**Proposta**
- **"+ Justificar"**: no lugar do `Textarea`, cada critério mostra um botão `link` "+ Justificar",
  com `aria-label="Justificar {critério}"` e `aria-expanded`.
  - Clicar abre o campo já com foco.
  - O campo continua aberto depois disso, e também abre sozinho se já houver texto no estado.
  - A justificativa continua opcional. Com o campo fechado nada é enviado, e a action já trata isso
    como vazio (`actions.ts` ~124).
- **Botões de nota**: `size: 'md'` (40 px), com o `aria-pressed` e o clique de alternar de hoje. As
  cores mudam só na Parte 3.
- **Barra de envio**: o `FormActions` vira uma barra `sticky bottom-0`, com fundo, borda superior e
  `z-index`.
  - Ela fica no rodapé enquanto o avaliador rola e para no fim do formulário.
  - Contém, nesta ordem: o contador "N de M notas", o botão "Enviar avaliação" e "O envio é
    definitivo.".
  - O `Alert` de erro fica logo acima da barra.
  - Em 375 px, contador e botão ficam numa linha e a frase numa segunda linha.

**⚠ A1. A frase "Faltam notas em …"** (`incompleteMessage`).
- Recomendado: o contador da barra a substitui, já que o selo "N de M" de cada definição mostra onde
  falta nota.
- Alternativa: manter a frase na barra, ao lado do contador, a partir de `sm`.

Confirmado: o contador substitui a frase.

**Pronto quando**
- As justificativas começam fechadas, e "+ Justificar" abre o campo com foco.
- O envio funciona com justificativa e sem ela (teste um envio de verdade na cena).
- Os botões medem 40 px de altura.
- A barra fica visível ao rolar e não cobre o último critério.
- 375 px está ok.
- Lint, typecheck e testes passam.

## Parte 3: escala sem cores de semáforo

**Hoje** Alto aparece verde, Médio amarelo e Baixo vermelho (`scaleTone` em `scale.ts`, `selected`
em `evaluation-form.tsx` ~35). Isso vale no formulário, no modo leitura (~205) e na revisão
(`review-groups-list.tsx` ~81).

**Por quê**: o glossário diz que a Qualidade "não diz se a qualidade está boa", sem veredito "nem cor
de aprovado". A ADR 0011 diz que o que é mostrado a quem produz o dado muda o dado, e a cor de
semáforo no formulário é um empurrão desse tipo.

DEPOIS (o trecho é do card da referência):

```html
<span class="btn sel-brand sm"><span class="gauge l3"><i></i><i></i><i></i></span>Alto</span>
<span class="btn secondary sm"><span class="gauge l2"><i></i><i></i><i></i></span>Médio</span>
…
<div class="row"><span class="t small">Ana Souza</span>
  <span class="badge b-scale"><span class="gauge l3"><i></i><i></i><i></i></span>Alto</span></div>
```

**Proposta**
- **`scale.ts`**: o `scaleTone` deixa de devolver `success`, `warning` e `danger`. A escala passa a
  usar os tokens `--color-quality-high/medium/low`, as mesmas classes `bg-quality-*` de
  `rounds/quality-bar.tsx` (~7). Troque o tipo `ScaleTone`, ou remova o `scaleTone` se ele ficar sem
  uso, e atualize o `scale.unit.test.ts`.
- **Novo** `evaluate/scale-marker.tsx`:
  - `ScaleMarker` são três barrinhas com `aria-hidden`, porque o rótulo já é texto. Ficam cheias
    `scaleRank(value)` barras, na cor `bg-quality-{value}`.
  - `ScaleBadge` é um `Badge` neutro com o marcador e o rótulo.
- **Formulário**: o estado selecionado fica igual para os três pontos, com borda e fundo da marca
  (ex.: `border-brand! bg-brand-tint! text-brand!`). Cada botão mostra o marcador ao lado do rótulo,
  e o `aria-pressed` continua.
- **Modo leitura e revisão**: usam o `ScaleBadge`.
- O selo "divergência extrema/adjacente" (vermelho) e o selo "outlier" continuam como estão. Na
  célula da revisão, o destaque é o selo de divergência.

**⚠ A2. Contraste do "Baixo".** `--color-quality-low` (#c9d6f2) quase some no fundo branco.
- Recomendado: desenhar as barras vazias só com contorno (`border-line`) e as cheias com o token.
- Se mesmo assim a barra de "Baixo" não se destacar, todas as barras cheias usam
  `--color-quality-high`, e só a quantidade de barras marca a ordem.

Confirmar antes de implementar.

**Pronto quando**
- Nenhum verde, amarelo ou vermelho na escala, no formulário, no modo leitura e na revisão.
- Os três pontos selecionados têm o mesmo visual.
- O marcador aparece em todos os lugares onde a nota aparece.
- Lint, typecheck e testes passam.
