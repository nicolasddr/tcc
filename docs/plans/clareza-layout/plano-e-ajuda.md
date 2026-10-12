# Plano E: balões ⓘ curtos e "Saiba mais" no lugar dos textos longos

Sugestão 4 da análise de 12/10 (`referencia-visual.html#s4`), mais a parte do ⓘ da sugestão 10
(`#s10`: 24 px, abre no clique ou toque, fecha com Esc, `aria-describedby`). Faça depois dos Planos
A a D.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | ⓘ de 24 px que abre no toque e liga o texto por `aria-describedby`; "Saiba mais" no `Section`; Equipe do projeto como primeiro uso | `feat(ajuda): ⓘ que abre no toque e "Saiba mais" na seção` | |
| 2 | Ajudas longas da Visão geral e de Rodadas em tópicos curtos | `refactor(textos): ajudas longas da visão geral e de rodadas em tópicos` | |
| 3 | As demais ajudas acima do limite, pela mesma regra | `refactor(textos): demais ajudas longas em "Saiba mais"` | |

## A regra

- **`Section`**: título + no máximo **uma frase visível** (`hint`).
- **ⓘ** (`help` do `Section`, `InfoTooltip`, `tooltip` do `Field`, `help` do `StatCard`): define um
  termo ou um estado em **até 25 palavras**. Exemplos: ICR, outlier, versão congelada, faixa de
  referência.
- Explicação com **mais de duas frases** ou mais de 25 palavras vira **"Saiba mais"**: um
  `Disclosure` recolhido com 1 a 3 tópicos curtos, abaixo do `hint`.
- **Nenhum texto some**: cada ideia do texto original fica num tópico, no `hint` ou num ⓘ. Encolher
  é permitido (frases mais curtas, sem repetição); apagar uma ideia não é.
- Em toda Parte que reescreve texto, a resposta final traz uma tabela **antes → depois** de cada
  texto, para o usuário conferir que nenhuma ideia se perdeu. Ao escrever, confira no código o que a
  frase descreve.

## Contexto comum

- Arquivos:
  - `app/components/ui/tooltip.tsx` (`InfoTooltip`), `ui/section.tsx`, `ui/disclosure.tsx`,
    `ui/field.tsx` (~34), `ui/stat.tsx` (~53);
  - `app/projects/[id]/(tabs)/rounds/how-to-read.tsx` (`HowToRead`, o "Como ler esta tabela", que é
    o modelo do "Saiba mais");
  - os textos: `(tabs)/members/page.tsx` (~110–155), `(tabs)/page.tsx` (~484–515),
    `rounds/open-round-card.tsx` (`openRoundHelp` ~18), `rounds/quality-labels.ts` (`QUALITY_HELP`,
    `QUALITY_SERIES_HELP`), `rounds/agreement-labels.ts` (`OUTLIER_PAIR_SUMMARY`,
    `OUTLIER_PAIR_HINT`), `rounds/agreement-panel.tsx` (~197).
- Leia o `docs/CONTEXT.md` antes de reescrever: Concordância (ICR), Outlier, Qualidade, Rodada
  aberta, Versão congelada.
- Memórias que pesam aqui: o balão abre para a direita e o balão fechado conta na largura da
  página (rolagem horizontal em 375 px); o `markupTextOf` lê o balão; pixel de captura não é pixel
  de CSS.

## Parte 1: o ⓘ e o "Saiba mais"

**Hoje** (`tooltip.tsx`)
- Botão de 18 px com `aria-label={text}`: o leitor de tela lê o parágrafo inteiro como nome do
  botão.
- O balão é `aria-hidden`, fica sempre no DOM com `opacity-0` e só aparece com hover ou foco
  (`group-hover`, `group-focus-within`). No celular, o toque não abre.
- O balão fechado ocupa largura e causa rolagem horizontal em 375 px quando o ⓘ fica à direita.

**Proposta**
- **`InfoTooltip`** vira client component, com a mesma API (`text`) e uma prop opcional `label`:
  - botão com alvo de **24 × 24 px** (o círculo visível pode continuar de 18 a 20 px dentro dele);
  - nome acessível curto: `aria-label={label ?? 'Mais informações'}`;
  - o balão tem `id` (de `useId`), `role="tooltip"`, sem `aria-hidden`, e o botão aponta para ele
    com `aria-describedby`. O texto é lido como descrição, e não como nome;
  - **abre e fecha no clique ou toque** (estado `open`, com `aria-expanded`). Esc fecha e deixa o
    foco no botão. Clique fora fecha;
  - em aparelho com mouse (`@media (hover: hover)`), o hover continua abrindo, e o Esc também
    esconde o balão aberto por hover (WCAG 1.4.13);
  - **fechado, o balão sai do layout** (`hidden`, ou seja `display: none`), e não com
    `opacity-0`. Um `id` referenciado por `aria-describedby` continua valendo com o elemento
    oculto. Isso também acaba com a rolagem horizontal causada pelos balões fechados.
- **"Saiba mais"**: novo `app/components/ui/learn-more.tsx`, `LearnMore({ summary = 'Saiba mais',
  points })`, um `Disclosure` fechado com os tópicos numa lista (`<ul>`), no visual do `HowToRead`.
  O `HowToRead` passa a usar o `LearnMore` (com o resumo "Como ler esta tabela" e os parágrafos
  como itens), sem mudar o que mostra.
- **`Section`** ganha `more?: { summary?: string; points: readonly string[] }`, mostrado logo abaixo
  do `hint`, antes do conteúdo.
- **Primeiro uso, Membros › Equipe do projeto** (o exemplo da referência):
  - `hint` (Administrador): "Quem participa e em que papel." (igual ao do avaliador);
  - "Saiba mais" com o resumo "Desativar ou marcar como outlier?" e os tópicos que hoje estão no
    `help` de 86 palavras e no fim do `hint` ("veja as respostas…, desative avaliadores"). Esboço:
    1. "Desativar tira o acesso ao projeto. As avaliações já enviadas continuam gravadas e no
       cálculo de concordância.";
    2. "Para tirar as notas de alguém do cálculo, marque a pessoa como outlier na rodada.";
    3. "A marca "avaliou em N rodadas" mostra em quais rodadas e fases cada avaliador já enviou
       avaliação. Ela não impede ninguém de avaliar.";
  - o `help` sai;
  - o "veja as respostas… e desative avaliadores" do `hint` de hoje já é dito pelos botões "Ver
    respostas" e "Desativar" de cada linha. Registre isso na tabela antes → depois.

**Passos**
1. **(TDD)** Teste do `InfoTooltip` (unitário, com `renderToStaticMarkup`): o botão tem
   `aria-label` curto e `aria-describedby` igual ao `id` do elemento `role="tooltip"`, e o texto
   não está no `aria-label`. Teste do `Section` com `more`: os tópicos ficam dentro de `<details>`
   sem `open`. Leia os vermelhos.
2. Ajuste os testes que liam o texto do balão pelo `aria-label`:
   `rounds/phase-4-reading.int.test.ts` (~878 e ~948, regex `aria-label="…"`) e qualquer outro
   teste que leia o `aria-label` de um ⓘ (`grep -rn "aria-label" app | grep test`). Passe a ler o
   conteúdo do `role="tooltip"` ou a prop `text`.
3. `InfoTooltip`, `LearnMore`, `HowToRead` usando `LearnMore`, `Section` com `more`.
4. Membros › Equipe do projeto.
5. Navegador: abrir e fechar o ⓘ por clique, por Esc e por clique fora; em 375 px, tocar abre (use
   a emulação `mobile`, que liga o toque); medir no iframe que a Visão geral não rola mais na
   horizontal por causa dos balões.

**Pronto quando**
- O ⓘ tem alvo de 24 px, abre no clique e no toque, fecha com Esc e com clique fora.
- O leitor de tela recebe o texto como descrição (confira o `aria-describedby` no `read_page`).
- A Equipe do projeto mostra uma frase e o "Saiba mais" fechado, com os três tópicos.
- Lint, typecheck e testes passam.

## Parte 2: Visão geral e Rodadas

**Hoje** (contagem aproximada de palavras)
- Visão geral › "Concordância por rodada": `help` de ~105 palavras, cinco frases sobre como ler a
  série por fase.
- `QUALITY_HELP` (~65), usado na Visão geral (~502) e em Rodadas (~375).
- `QUALITY_SERIES_HELP` (~90), na Visão geral (~512).
- Rodadas › cartão da rodada aberta: `openRoundHelp` junta cinco parágrafos num ⓘ
  (`openRoundSummary`, `roundLockedMessage`, `roundInputSummary` e duas frases fixas).
- Rodadas › Concordância: o ⓘ ao lado de `OUTLIER_PAIR_RESULT` junta `OUTLIER_PAIR_SUMMARY` e
  `OUTLIER_PAIR_HINT` (~70).

**Proposta**
- "Concordância por rodada": `hint` de hoje + "Saiba mais" com até três tópicos (o que cada ponto
  traz; a passagem da Fase 2 para a Fase 3; a Fase 3 e a Fase 4).
- "Qualidade na rodada N" e "Qualidade por rodada": `QUALITY_HELP` e `QUALITY_SERIES_HELP` viram
  listas de tópicos (ex.: `QUALITY_POINTS`, `QUALITY_SERIES_POINTS`, `readonly string[]`) usadas no
  `more`. Se um termo precisar de definição curta, ele fica num ⓘ de até 25 palavras.
- Cartão da rodada aberta: o ⓘ fica com uma frase (`openRoundSummary`), e os outros parágrafos
  viram um "Saiba mais" dentro do cartão, com o resumo "Como funciona a rodada aberta". Confira em
  `open-round-card.tsx` onde ele cabe sem empurrar os botões.
- Par com e sem outliers: o ⓘ fica com `OUTLIER_PAIR_SUMMARY` (uma frase) e o `OUTLIER_PAIR_HINT`
  vira um "Saiba mais" logo abaixo do par, em tópicos.
- Os testes que importam as constantes (`rounds/page.int.test.ts` ~66 e ~1533,
  `quality-labels.unit.test.ts`, `agreement-labels.unit.test.ts`) passam a afirmar os tópicos.

**Pronto quando**
- Nenhum dos textos acima fica num ⓘ com mais de 25 palavras.
- A tabela antes → depois está na resposta final.
- Visão geral (com série de concordância e de Qualidade) e Rodadas (rodada aberta, com outlier
  marcado) conferidas no navegador, em 1280 e 375 px.
- Lint, typecheck e testes passam.

## Parte 3: as demais ajudas

**⚠ E1. Até onde vai a regra.** A sugestão nomeia seis textos (Partes 1 e 2), mas a regra vale
para todo `Section`.
- Recomendado: aplicar a regra a todas as ajudas que passam do limite, nesta Parte.
- Alternativa: parar na Parte 2 e deixar a Parte 3 para outra rodada.

Confirmar antes de implementar.

**Proposta**
1. Faça o inventário: todos os `help=` de `Section`/`StatCard`, `tooltip=` de `Field` e
   `<InfoTooltip text=…>` (são cerca de 55; `grep -rn " help=\|<InfoTooltip text=\| tooltip=" app`).
   Para cada um, conte palavras e frases do texto (resolvendo as constantes), e liste os que passam
   de 25 palavras ou de duas frases. Mostre a lista antes de reescrever.
2. Para cada um da lista: frase curta no ⓘ, ou "Saiba mais" com tópicos, pela regra acima.
   Candidatos já vistos: Rodadas › "Rodadas do projeto" (~226), "Nova rodada" (~260), "Gerar
   respostas" (~282), revisão de discordâncias (~142); Codebook (`codebook/page.tsx` ~40 e ~62);
   Prompt (`prompt/page.tsx` ~85 e ~104); Itens (`items/page.tsx` ~34); Avaliar (`evaluate/page.tsx`
   ~153); Ajustes (`settings/page.tsx` ~56, `manage-project.tsx` `statusHelp`); Membros (Outliers
   por rodada, Avaliar neste projeto); `FROZEN_BADGE_HELP`; `versionExplanation`.
3. Mensagens de pendência que já aparecem visíveis no Próximo passo (Plano C) não entram.

**Pronto quando**
- A lista do inventário está na resposta final, com antes → depois.
- Nenhum ⓘ passa de 25 palavras, e nenhum `Section` tem mais de uma frase visível no `hint`.
- As telas mexidas foram conferidas no navegador.
- Lint, typecheck e testes passam.
