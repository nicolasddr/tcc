# Plano de implementação — Issue #83: "43 — Uso dos itens e participação dos avaliadores, por fase"

Link: https://github.com/nicolasddr/tcc/issues/83
Pai: Épico 4 (#79) · Spec: `docs/prd/epico-4-teste-de-replicacao.md` (histórias 10, 11 — só a parte da
página de membros — e 12; seção "Participação e uso" de Decisões de Implementação; "Participação e uso"
de Testing Decisions; NFR de Desempenho e de Segurança sobre a marca de participação)
Blocked by: nenhuma. Pode começar.

**A executar em 3 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda". Anote ali o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | O rótulo e os itens: função pura de rótulo agrupado por fase, uso dos itens carregando a fase da rodada, lista de itens e escolha de itens com a marca nova, e a prova de que item usado não é recusado na Fase 4 | ✅ |
| 2 | A participação: consulta agregada das avaliações enviadas por vínculo de membro e por rodada, o `memberId` na listagem de membros e a ponte pura vínculo → usuário | ✅ |
| 3 | A página de membros: a marca ao lado de cada Avaliador, só para o Administrador, o texto de ajuda, a verificação no navegador e a varredura dos ACs | ☐ |

**Nenhuma ADR nova.** A regra está na **emenda de 2026-10-02 da ADR 0004** ("a ferramenta informa e não
recusa"; "ao lado de cada avaliador ela mostra em quais rodadas, e de quais fases, ele já avaliou") e no
glossário (`docs/CONTEXT.md`, verbete **Fase 4**: "a novidade de itens e de avaliadores é
responsabilidade do Administrador"). Se algo divergir, emende a ADR em vez de improvisar no código.

**Sem migration.** `rounds.phase` já existe (#70), `evaluations` já liga resposta, rodada e vínculo
(`ev_round_member`), e `responses` já tem `rs_unique_round_item`. Nada de schema.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Rótulo de uso | `pipeline/item-usage.ts` (`itemUsageLabel(roundNumbers)`: `usado na rodada 3` / `usado nas rodadas 1, 3, 4`) e `pipeline/item-usage.unit.test.ts` | substituído pelo módulo neutro de D3, que recebe rodadas com fase (Parte 1) |
| Uso por item | `pipeline/responses.ts` (`ItemRoundUsage = Map<string, number[]>`, `loadItemRoundUsage`: `responses ⋈ rounds`, ordenado por `roundNumber`) | passa a selecionar `rounds.phase` e a devolver `RoundTag[]` (Parte 1) |
| Itens | `pipeline/items.ts` (`InputItem.roundNumbers: number[]`, `loadItems`) | o campo vira `rounds: RoundTag[]` (Parte 1) |
| Lista de itens | `pipeline/items-editor.tsx` (`ItemRow`: `itemUsageLabel(item.roundNumbers)` num `<Badge tone="neutral">`) | troca a chamada (Parte 1) |
| Escolha de itens ao gerar | `(tabs)/rounds/generate-responses.tsx` (linha ~134: `itemUsageLabel(item.roundNumbers)` num `Badge`) e `(tabs)/rounds/page.tsx` (`loadItems` só com rodada aberta) | troca a chamada; a página não muda (Parte 1) |
| Seleção | `(tabs)/rounds/preconditions.ts` (`selectionBlockers`: só recusa item **já usado nesta rodada**, `usedInRound`) | **sem mudança**. É o que garante que item usado em outra rodada não é recusado |
| Avaliações | `lib/db/schema.ts` (`evaluations`: `roundId`, `responseId`, `projectMemberId`, `submittedAt NOT NULL`; `ev_unique_response_member`). A linha só nasce no envio (`submitEvaluation`), não há rascunho | fonte da participação (Parte 2) |
| Vínculo de avaliador | `pm_unique_role(project_id, user_id, role)`: no máximo **um** vínculo `evaluator` por usuário por projeto. O Administrador-avaliador tem dois vínculos (ADR 0008) e avalia pelo de `evaluator` | ponte vínculo → linha da página (Parte 2) |
| Listagem de membros | `lib/authz.ts` (`listProjectMembers`, `ProjectMemberRow`: `userId`, `role`, `status`, `name`, `email`), `app/projects/members.ts` (`MemberRow`, `groupMembers`: agrupa **por usuário**, junta papéis), usado em `members/page.tsx` e `(tabs)/page.tsx` | ganha `memberId` (Parte 2) |
| Página de membros | `app/projects/[id]/members/page.tsx` (transação única; `isAdmin` já calculado; o painel de outliers já só carrega para o Administrador) e `app/projects/[id]/member-list.tsx` (Server Component; `MemberList` com `canManage`) | recebe a marca (Parte 3) |
| Testes vizinhos | `pipeline/responses.int.test.ts` ("loadItemRoundUsage diz em quais rodadas…", "…não mistura o uso de outro projeto"), `(tabs)/items/page.int.test.ts` ("a lista diz em quais rodadas cada item já produziu resposta, sem filtrar nem travar"), `(tabs)/rounds/page.int.test.ts` (linha ~1052, `generateOf`), `(tabs)/rounds/generate-responses.int.test.ts` (linha ~625, `openRound`), `(tabs)/rounds/phase-4-round.int.test.ts` (Ana, veterana, avalia na Fase 4), `members/page.int.test.ts` (`render`, `findElement`, `panelOf`), `app/projects/members.unit.test.ts` (helper `row`) | copiar helpers e espelhar os casos |

O que **falta**, e esta fatia cria: a fase da rodada no uso dos itens, um rótulo que agrupa por fase e
serve aos dois casos, a consulta de participação por vínculo e a marca na página de membros.

---

## 2. A regra, por extenso

### O rótulo

Uma função só monta a lista de rodadas agrupada por fase; o verbo muda conforme quem é rotulado:

| Entrada (rodada, fase) | Item | Avaliador |
|---|---|---|
| nenhuma | sem marca | sem marca |
| (3, 2) | `usado na rodada 3 (Fase 2)` | `avaliou na rodada 3 (Fase 2)` |
| (2, 2), (3, 2) | `usado nas rodadas 2 e 3 (Fase 2)` | `avaliou nas rodadas 2 e 3 (Fase 2)` |
| (1, 2), (2, 2), (3, 2) | `usado nas rodadas 1, 2 e 3 (Fase 2)` | idem com `avaliou` |
| (2, 2), (3, 2), (5, 3) | `usado nas rodadas 2 e 3 (Fase 2) e 5 (Fase 3)` | idem |
| (1, 2), (4, 3), (6, 4) | `usado nas rodadas 1 (Fase 2), 4 (Fase 3) e 6 (Fase 4)` | idem |

- Singular (`na rodada`) só quando há **uma** rodada no total; com duas ou mais, `nas rodadas`, mesmo que
  cada grupo tenha uma só.
- Dentro do grupo: `a`, `a e b`, `a, b e c`. Entre grupos: a mesma regra (`G1 e G2`, `G1, G2 e G3`).
- A fase aparece **sempre**, inclusive com uma rodada só ou com todas na mesma fase.
- A ordem é a das rodadas (número crescente). O agrupamento é por **trechos consecutivos** da mesma fase
  (D2 ⚠).

### De onde vem cada marca

- **Item**: das respostas (`responses ⋈ rounds`), uma por rodada (`rs_unique_round_item`). Inclui a
  rodada aberta, como hoje.
- **Avaliador**: das avaliações enviadas (`evaluations ⋈ rounds`), **agrupadas por vínculo de membro e
  por rodada** (várias avaliações na mesma rodada contam uma vez). Inclui a rodada aberta, as rodadas
  em que o vínculo foi marcado outlier e os vínculos inativos: participação é fato, não cálculo.
  Desativar é sobre acesso, e a marca de Outlier é sobre cálculo; nenhuma das duas apaga o que foi
  avaliado.

### Quem vê

Só o Administrador. A página de membros só **consulta** a participação quando `isAdmin` (NFR de
Segurança e de Desempenho: consulta agregada por projeto, carregada só para o Administrador). O
Avaliador não recebe marca nenhuma, nem a sua. A lista de itens e a escolha de itens já são telas só do
Administrador.

### O que não trava

Nada. `selectionBlockers` só recusa item repetido **na mesma rodada**; a fila do avaliador e
`submitEvaluation` não olham rodadas anteriores. Esta fatia não acrescenta recusa nenhuma; só prova.
Para tirar do cálculo quem já avaliou antes, o caminho continua sendo a marca de Outlier.

---

## 3. Decisões

As marcadas com ⚠ precisam de confirmação antes da Parte em que entram.

**D1. O tipo `RoundTag` e o formato do rótulo.**

```ts
export type RoundTag = { roundNumber: number; phase: number }

export function roundsLabel(rounds: readonly RoundTag[]): string | null
export function itemUsageLabel(rounds: readonly RoundTag[]): string | null
export function participationLabel(rounds: readonly RoundTag[]): string | null
```

`roundsLabel` devolve `na rodada 3 (Fase 2)` / `nas rodadas …` ou `null` sem rodada; os outros dois
prefixam `usado ` e `avaliou `. A função **confia na ordem e na unicidade** que a consulta entrega (as
duas consultas garantem: `ORDER BY round_number` e, na participação, `DISTINCT`). O formato antigo da
lista (`1, 3, 4`) vira `1, 3 e 4`, como no exemplo do spec: **os testes antigos do rótulo mudam** (citar
no commit).

**D2 ⚠. Agrupar por trechos consecutivos da mesma fase, não juntar todas as rodadas de uma fase.** Hoje
as fases só avançam, e os dois jeitos dão o mesmo texto. Com o retorno da #86, um item pode ter as
rodadas 3 e 4 (Fase 3), 5 (Fase 4) e 6 (Fase 3). Recomendação: **trechos**, `usado nas rodadas 3 e 4
(Fase 3), 5 (Fase 4) e 6 (Fase 3)`, porque preserva a ordem em que aconteceu, como a série de ICR depois
do retorno (história 20: "a sequência como ela aconteceu, por exemplo Fase 3, Fase 4, Fase 3").
Alternativa: juntar por fase (`3, 4 e 6 (Fase 3) e 5 (Fase 4)`), que lê "por fase" mais ao pé da letra
mas embaralha a ordem. O teste unitário cobre o caso com fase repetida.

**D3. Módulo neutro `app/projects/[id]/round-usage.ts`, sem banco.** O rótulo sai de `pipeline/` porque
passa a servir à página de membros (e, na #84, ao painel de concordância). `pipeline/item-usage.ts` e o
seu teste são **removidos** e viram `round-usage.ts` + `round-usage.unit.test.ts`. O módulo é importado
por dois Client Components (`items-editor.tsx`, `generate-responses.tsx`): **não importe nada de
`@/lib/db` nem de `./rounds`/`./responses` nele** (mesmo gotcha da #81, divergência 1). `RoundTag` mora
aqui e é importado como tipo pelas consultas.

**D4. A consulta de participação.** Em arquivo novo `(tabs)/rounds/participation.ts` (perto de
`agreement.ts`, porque a #84 vai usá-la no painel da rodada):

```ts
export type EvaluatorParticipation = Map<string, RoundTag[]> // chave: project_member_id

export async function loadEvaluatorParticipation(
  projectId: string,
  db: DbExecutor = ownerDb,
): Promise<EvaluatorParticipation>
```

`selectDistinct({ memberId: evaluations.projectMemberId, roundNumber: rounds.roundNumber, phase:
rounds.phase })` de `evaluations ⋈ rounds` (`rounds.id = evaluations.roundId`), filtrado por
`rounds.projectId`, ordenado por `roundNumber`. Uma consulta, sem filtro de status de rodada, de status
de membro nem de outlier (§ 2). Devolve todas as rodadas; **a restrição "só rodadas anteriores" é da
#84**, e não entra aqui.

**D5. A ponte vínculo → linha da página.** A página agrupa por usuário (`groupMembers`), a participação
é por vínculo. `listProjectMembers` passa a selecionar `memberId: projectMembers.id` (campo a mais em
`ProjectMemberRow` e `MemberRow`; `groupMembers` ignora, a visão geral não usa). Função pura nova em
`app/projects/members.ts`:

```ts
export function participationByUser(
  rows: readonly MemberRow[],
  participation: EvaluatorParticipation,
): Record<string, string> // userId → rótulo
```

Só linhas com `role === 'evaluator'` entram; quem não tem rodada não ganha chave (sem marca). O
Administrador-avaliador ganha a marca pelo vínculo de avaliador. `pm_unique_role` garante um só vínculo
de avaliador por usuário, então não há colisão. Alternativa descartada: consultar já por `userId`
(juntando `project_members` com `role = 'evaluator'`), que funcionaria hoje mas perderia a chave por
vínculo que a #84 precisa e que a issue pede.

**D6. Onde a marca aparece na linha.** `MemberList` ganha `participation?: Readonly<Record<string,
string>>`; a página passa só quando `isAdmin`. A marca é um `<Badge tone="neutral">`, como a dos itens,
**na coluna do nome** (abaixo da linha de papéis/e-mail, que é `min-w-0 flex-1`), e não no `span`
`shrink-0` da direita: o rótulo pode ser longo e o `Badge` é `whitespace-nowrap`. Se em 375px ele
estourar, aplicar `className="whitespace-normal!"` (memória: `cx` não resolve conflito do Tailwind, usar
o sufixo `!`). O mesmo vale para os dois `Badge` de item, conferidos na Parte 1.

**D7 ⚠. O texto de ajuda da seção "Equipe do projeto" fala da marca.** Hoje o `help` do Administrador
explica desativar × outlier. Proposta: acrescentar, ao final,

> A marca "avaliou nas rodadas" mostra em quais rodadas, e de quais fases, cada avaliador já enviou
> avaliação. Ela não impede ninguém de avaliar: para tirar do cálculo quem já tinha avaliado antes, use
> a marca de outlier na rodada.

É o lugar onde o Administrador lê a marca, e fecha a história 12 na tela. Alternativa: sem texto, a
marca se explica sozinha. Nenhuma palavra de juízo nem a palavra "novo" como veredito.

**D8. Para o Avaliador nada muda no código.** Só prova (Parte 3).

---

## 4. Fronteira com as fatias vizinhas

- **#84 (leitura ao lado da referência)** é dona da marca no **painel de concordância** da rodada da Fase
  4, da restrição a rodadas de número menor e do teste unitário "participação restrita às rodadas
  anteriores". Ela reaproveita `loadEvaluatorParticipation` (D4) e `participationLabel` (D1). Aqui:
  **não mexa no painel de concordância** nem filtre por rodada.
- **#85 (orientação e "o que mudou" na Fase 4)** é dona da frase que diz que itens e avaliadores devem
  mudar. Aqui não há frase nova fora do `help` de D7.
- **#86 (retorno)** cria o caso de fase repetida que D2 já trata. Nada a fazer aqui além do teste
  unitário.
- **Painel "Outliers por rodada"** da página de membros não muda.
- **`evaluations_enabled`** continua sem uso (fora do épico).

---

# Parte 1 — O rótulo e os itens

**Objetivo:** a marca de uso dos itens agrupa as rodadas por fase, na lista de itens e na escolha de
itens, e um teste prova que item já usado em rodada da Fase 3 não é recusado numa rodada da Fase 4.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, `pipeline/item-usage.ts` e o teste, `pipeline/responses.ts`
(`loadItemRoundUsage`), `pipeline/items.ts`, `pipeline/items-editor.tsx` (`ItemRow`),
`(tabs)/rounds/generate-responses.tsx`, os testes vizinhos da § 1.

**Confirmar antes de codar:** D2 ⚠.

### 1.1 O rótulo (TDD, unitário)

- [ ] Criar `app/projects/[id]/round-usage.ts` com `RoundTag`, `roundsLabel`, `itemUsageLabel`,
      `participationLabel` (D1) e `round-usage.unit.test.ts`:
  - sem rodada → `null` nos três;
  - uma rodada → `usado na rodada 3 (Fase 2)` e `avaliou na rodada 3 (Fase 2)`;
  - duas da mesma fase → `… nas rodadas 2 e 3 (Fase 2)`; três → `1, 2 e 3 (Fase 2)`;
  - fases diferentes → `usado nas rodadas 2 e 3 (Fase 2) e 5 (Fase 3)` (o exemplo do spec, literal);
  - três fases, um por grupo → `nas rodadas 1 (Fase 2), 4 (Fase 3) e 6 (Fase 4)` (plural com grupos
    unitários);
  - fase repetida depois de outra (D2) → `nas rodadas 3 e 4 (Fase 3), 5 (Fase 4) e 6 (Fase 3)`;
  - os dois rótulos usam a mesma lista (`participationLabel(x)` e `itemUsageLabel(x)` diferem só no
    verbo).
- [ ] Remover `pipeline/item-usage.ts` e `pipeline/item-usage.unit.test.ts`.

### 1.2 O uso carrega a fase

- [ ] `pipeline/responses.ts`: `ItemRoundUsage = Map<string, RoundTag[]>`; `loadItemRoundUsage` seleciona
      também `phase: rounds.phase` e empurra `{ roundNumber, phase }`.
- [ ] `pipeline/items.ts`: `InputItem.roundNumbers` → `rounds: RoundTag[]`.
- [ ] `items-editor.tsx` e `generate-responses.tsx`: `itemUsageLabel(item.rounds)`, import de
      `round-usage`. Nada mais muda nas telas (o `Badge`, o `disabled` só por `usedHere`).
- [ ] `npm run typecheck` aponta os testes que ainda usam `roundNumbers`; ajuste-os em 1.3.

### 1.3 Testes de integração e de página

- [ ] **Editado** (citar no commit) `responses.int.test.ts`, "loadItemRoundUsage diz em quais rodadas…":
      semear a rodada 3 com `phase: 3` e esperar `[{ roundNumber: 1, phase: 2 }, { roundNumber: 3, phase:
      3 }]`. O de "não mistura o uso de outro projeto" só muda se o typecheck pedir.
- [ ] **Editado** `generate-responses.int.test.ts` (~625): `usage.get(item)` vira `[{ roundNumber: 1,
      phase: … }]` com a fase da rodada do helper.
- [ ] **Editado** `(tabs)/items/page.int.test.ts`, "a lista diz em quais rodadas…": semear rodadas de
      fases diferentes (ex.: rodada 1 Fase 2, rodada 2 Fase 3) e esperar `usado nas rodadas 1 (Fase 2) e
      2 (Fase 3)` e `usado na rodada 2 (Fase 3)`; o item sem uso continua `null`.
- [ ] **Editado** `(tabs)/rounds/page.int.test.ts` (~1052): mesma troca na escolha de itens, com fase
      no rótulo.
- [ ] **Novo**, em `generate-responses.int.test.ts` (ou `phase-4-round.int.test.ts`, onde a cena já
      existe): **na Fase 4, o item já usado na rodada de referência da Fase 3 é aceito** — projeto na Fase
      4, rodada 1 fechada da Fase 3 com resposta do item X, rodada 2 aberta da Fase 4; `generateResponses`
      com X cria a resposta, e a escolha de itens da página mostra X habilitado com `usado na rodada 1
      (Fase 3)`.

### 1.4 Tela

- [ ] Abrir a lista de itens e a escolha de itens no navegador (memória "Preview pane: faixa preta";
      usar `/dev/login`), com um item usado em duas fases. Conferir em 375px (medido em iframe) que o
      `Badge` não estoura a linha; se estourar, aplicar D6 aos dois `Badge` de item.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes.

Commit sugerido: `feat(itens): marca de uso agrupa as rodadas por fase`. No corpo, listar os testes
antigos editados (rótulo e as quatro asserções de `roundNumbers`) e por quê: o formato do rótulo mudou
(D1) e o uso passou a carregar a fase.

### O que a Parte 2 herda

- **D2 confirmada: trechos consecutivos.** `roundsLabel` agrupa só rodadas vizinhas da mesma fase.
- **Nomes finais, como em D1:** `app/projects/[id]/round-usage.ts` exporta `RoundTag`, `roundsLabel`,
  `itemUsageLabel` e `participationLabel`; o módulo não importa nada (seguro para Client Component).
  `ItemRoundUsage = Map<string, RoundTag[]>`, `InputItem.rounds: RoundTag[]`.
- **Divergência 1 — D6 aplicada já na Parte 1.** Com duas fases o `Badge` cabia em 375px, mas o caso
  real da Fase 4 (três fases, `usado nas rodadas 1 e 2 (Fase 2), 3 e 4 (Fase 3) e 5 (Fase 4)`) estourava
  a escolha de itens (borda em 399px) e encostava na lista (373px). Os dois `Badge` de item ganharam
  `className="whitespace-normal!"` e quebram em duas linhas (borda em 321px). A Parte 3 deve fazer o
  mesmo no `Badge` da página de membros, que é ainda mais estreito.
- **Divergência 2 — o teste novo foi para `phase-4-round.int.test.ts`**, em "abrir e gerar", porque a
  cena já tem o item usado na rodada 1 (Fase 3); `Scene` ganhou `usedItem`, e o arquivo ganhou
  `findElement` e `generateOf` (renderiza a página de rodadas). A prova de "habilitado" é
  `selectionBlockers([usedItem], …)` vazio e o item fora de `generated`.
- A variável interna do agrupamento chama `numbers`, não `roundNumbers`, para a varredura
  `rg "roundNumbers|item-usage"` da Parte 3 sair limpa (já sai).
- Suíte: 85 arquivos, **1251 testes** (eram 1246: −3 do rótulo antigo, +7 do novo, +1 da Fase 4).

---

# Parte 2 — A participação

**Objetivo:** a participação de cada Avaliador sai das avaliações enviadas, por vínculo de membro e por
rodada, e chega à página como `userId → rótulo`, sem ainda aparecer na tela.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 2 herda", `lib/authz.ts` (`listProjectMembers`,
`ProjectMemberRow`), `app/projects/members.ts` e o teste, `(tabs)/rounds/agreement.ts`
(`listEvaluatorEffort`, para o estilo de consulta), `test/helpers.ts` (`addRound` com `phase`,
`addResponse`, `addEvaluation`, `addActiveEvaluator`, `addOutlier`).

### 2.1 A consulta (TDD, integração)

- [x] `(tabs)/rounds/participation.ts` com `loadEvaluatorParticipation` (D4) e
      `participation.int.test.ts` (com `inRollbackTx`, como `responses.int.test.ts`):
  - **sai das avaliações enviadas, por vínculo**: Ana avalia duas respostas da rodada 1 (Fase 2) e uma
    da rodada 3 (Fase 3); Bia avalia a rodada 2 → Ana `[{1, 2}, {3, 3}]` (a rodada 1 aparece **uma**
    vez), Bia `[{2, 2}]`;
  - **quem nunca avaliou não tem chave**: Carla, avaliadora ativa sem avaliação, fica fora do mapa;
  - **o Administrador-avaliador conta pelo vínculo de avaliador**: avaliação gravada no vínculo
    `evaluator` dele aparece com esse `project_member_id`, e o vínculo `administrator` não aparece;
  - **inclui a rodada aberta, o outlier e o vínculo inativo**: avaliação em rodada aberta conta; com
    `addOutlier` na rodada a avaliação continua contando; com o vínculo desativado, continua;
  - **não mistura projetos**: avaliação em outro projeto não entra.

### 2.2 A ponte vínculo → usuário (TDD, unitário)

- [x] `listProjectMembers` seleciona `memberId: projectMembers.id`; `ProjectMemberRow` e `MemberRow`
      ganham `memberId: string`. O helper `row` de `members.unit.test.ts` ganha um `memberId` padrão
      (**editado**, só o helper).
- [x] `participationByUser` em `app/projects/members.ts` (D5), com testes em `members.unit.test.ts`:
  - avaliador com rodadas → `{ [userId]: 'avaliou nas rodadas …' }`;
  - avaliador sem rodadas → sem chave;
  - linha de `administrator` cujo `memberId` estivesse no mapa → ignorada (só `evaluator` conta);
  - usuário com os dois vínculos → a marca sai do vínculo de avaliador.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Nenhuma tela mudou.

Commit sugerido: `feat(membros): participação dos avaliadores por vínculo e por rodada`.

### O que a Parte 3 herda

- **Nomes finais, como em D4 e D5:** `(tabs)/rounds/participation.ts` exporta `EvaluatorParticipation`
  (`Map<project_member_id, RoundTag[]>`) e `loadEvaluatorParticipation(projectId, db)`;
  `app/projects/members.ts` exporta `participationByUser(rows, participation)` → `Record<userId,
  rótulo>`. `ProjectMemberRow` e `MemberRow` têm `memberId` (o `id` de `project_members`).
- `members.ts` importa só o **tipo** de `participation.ts` (`import type`), então não puxa `@/lib/db`
  para quem o importa; o rótulo vem de `round-usage.ts`.
- A consulta não valida `isUuid(projectId)`, como `loadItemRoundUsage`: a página só deve chamá-la
  depois de achar o projeto (`project && isAdmin`).
- Nos testes, o vínculo `administrator` do Administrador-avaliador foi buscado filtrando por `role`:
  o helper `memberId(tx, project, user)` faz `limit 1` sem papel e, com dois vínculos, devolve qualquer
  um. Na Parte 3, use o id devolvido por `addActiveEvaluator` para o vínculo de avaliador.
- Sem divergência do plano. Suíte: 86 arquivos, **1260 testes** (eram 1251: +5 da consulta, +4 da
  ponte). Testes editados: só o helper `row` de `members.unit.test.ts` (ganhou `memberId`).

---

# Parte 3 — A página de membros

**Objetivo:** o Administrador vê, na página de membros, ao lado de cada Avaliador, em quais rodadas ele
avaliou, agrupadas por fase; o Avaliador não vê marca nenhuma; e a varredura confirma os cinco ACs.

**Ler antes:** `AGENTS.md`, §§ 1 a 4, "o que a Parte 3 herda", `members/page.tsx`, `member-list.tsx`,
`members/page.int.test.ts` (`render`, `findElement`), `app/components/ui/badge.tsx`, memórias
"Preview pane: faixa preta" e "cx não resolve conflito Tailwind".

**Confirmar antes de codar:** D7 ⚠.

### 3.1 A página (TDD, teste de página)

- [ ] Em `members/page.int.test.ts`, helper `listOf(id)` com `findElement(await render(id), MemberList)`
      devolvendo as props, e os casos:
  - **o Administrador vê a marca de cada Avaliador, agrupada por fase**: projeto com rodada 1 (Fase 2)
    e rodada 2 (Fase 3); Ana avaliou nas duas, Bia só na 2 → `participation` é `{ ana: 'avaliou nas
    rodadas 1 (Fase 2) e 2 (Fase 3)', bia: 'avaliou na rodada 2 (Fase 3)' }`;
  - **Avaliador sem avaliação não tem marca**: Carla, ativa, sem chave;
  - **o Administrador-avaliador tem a marca pelo vínculo de avaliador**;
  - **o Avaliador não vê marca nenhuma, nem a sua**: logado como Ana (que avaliou), `participation` é
    `undefined`.
- [ ] `members/page.tsx`: dentro da transação, com `project && isAdmin`, `loadEvaluatorParticipation(id,
      tx)` e `participationByUser(memberRows, …)`; senão, nada é consultado. Passar a `MemberList`.
- [ ] `member-list.tsx`: prop `participation` e o `Badge` na coluna do nome (D6).
- [ ] `help` da seção "Equipe do projeto" (D7, se confirmado).

### 3.2 Tela

- [ ] Conferir no navegador, como Administrador, com cena semeada (avaliadores com rodadas em duas
      fases, um sem avaliação, o Administrador-avaliador) e como Avaliador. Medir em 375px dentro de
      iframe; com rótulo longo, a marca quebra linha sem empurrar os botões "Ver respostas" e
      "Desativar". Se precisar, `whitespace-normal!`. Limpar a cena antes de `npm test` (memória "cena
      no banco quebra int test").

### 3.3 Varredura dos ACs

- [ ] A marca de uso agrupa por fase na lista e na escolha de itens → Parte 1 (1.3, testes de página).
- [ ] A página de membros mostra a participação por fase → 3.1.
- [ ] Avaliador sem avaliação não tem marca → 2.1 e 3.1.
- [ ] O Avaliador não vê marca, nem a sua → 3.1 (e lista de itens/escolha de itens já são só do
      Administrador: `items/page.int.test.ts`, "o avaliador ativo NÃO enxerga").
- [ ] Nenhum item nem avaliador é recusado → item: teste novo da Parte 1; avaliador:
      `phase-4-round.int.test.ts` (Ana, veterana, avalia a rodada da Fase 4). Nenhuma recusa nova no
      código (conferir com `git diff main --stat` que `selectionBlockers`, `submitEvaluation` e a fila não
      mudaram).
- [ ] `rg "roundNumbers|item-usage"` sem resto.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes; tela conferida nos dois papéis.

Commit sugerido: `feat(membros): marca de participação dos avaliadores na página de membros`, com
`Closes #83` no corpo.

### O que fica para depois

_(preencher ao fim da Parte: divergências, contagem final da suíte, o que a #84 precisa saber)_
