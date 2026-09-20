# Plano de implementação — Issue #66: "28 — Anotações de consenso persistidas"

Link: https://github.com/nicolasddr/tcc/issues/66
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 53, 55 e 56)
Blocked by: #64 (fechada) — "Revisão de discordâncias" · vizinha de #65 (fechada) — "Outliers"

**A executar em 4 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60 a #65.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A anotação no banco: limite, tabela `consensus_notes`, migration, leituras e helpers de teste | ☑ |
| 2 | A action: quem escreve o quê, onde, e o que apagar um texto significa | ☐ |
| 3 | A ata na revisão: o Administrador escreve por célula, os membros da rodada leem | ☐ |
| 4 | O espaço privado do Avaliador, o glossário e a varredura dos ACs | ☐ |

**Nenhuma ADR nova.** A decisão de método já está na spec do Épico 2 ("Revisão de discordâncias e
anotações") e o recorte por rodada é o mesmo da **ADR 0011** e da #64. O que esta fatia acrescenta é
uma fronteira de visibilidade — ata pública, anotação privada —, e ela é decisão de produto dentro do
que a spec já escreveu, não uma escolha nova de método. Se a leitura do § 3 sobre "o Administrador vê
tudo" for recusada pelo orientador, aí sim nasce ADR, **antes** da Parte 2.

**Com migration.** Tabela nova, a primeira desde `round_outliers` (#65). `npx drizzle-kit generate`
na Parte 1, e o deploy desta fatia **precisa de `db push` em prod** — prod já atrasou duas vezes por
este caminho, e sem a tabela a tela de revisão quebra em produção na primeira leitura.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Tela de revisão por resposta | `(tabs)/rounds/[roundId]/page.tsx` | é **a** tela desta fatia; nenhuma rota nova nasce aqui |
| Montagem das células | `(tabs)/rounds/review-groups.ts` (`reviewGroups`) | dá a lista de células (definição × critério) a que a anotação se prende |
| Lista de células na tela | `(tabs)/rounds/review-groups-list.tsx` (`ReviewGroupsList`, `Cell`) | onde a caixa de anotação entra, por célula |
| Notas dos avaliadores | `(tabs)/rounds/review.ts` (`loadResponseNotes`) | modelo da leitura por resposta; a anotação segue a mesma forma |
| Porta de acesso da revisão | `(tabs)/rounds/review-access.ts` (`requireReviewAccess`, `requireReviewableRound`) | **já** resolve "o avaliador só alcança rodada em que avaliou" — a action repete a mesma regra |
| Rodadas revisáveis do avaliador | `(tabs)/rounds/review.ts` (`listReviewableRounds`, `listEvaluatedRoundIds`) | a checagem que a action reusa |
| Respostas da rodada | `pipeline/responses.ts` (`listRoundResponses`) | a navegação resposta a resposta já existe |
| Versão de codebook da rodada | `pipeline/codebook.ts` (`loadCodebookVersion`) | é dela que saem definição e critério válidos para a célula |
| Herança de critério geral | `pipeline/criteria.ts` (`criteriaOfDefinition`, `isGeneral`) | é o que diz se a célula existe de verdade |
| Forma de action com `useActionState` | `(tabs)/rounds/outlier-actions.ts` + `members/outlier-forms.tsx` | modelo de assinatura, mensagens, `revalidatePath` e form |
| Autorização de Administrador | `lib/authz.ts` (`isProjectAdmin`) | a trava de quem escreve a ata |
| Limites com CHECK espelhada | `lib/limits.ts` | onde `CONSENSUS_NOTE_MAX` nasce |
| Helpers de integração | `test/helpers.ts` (`addRound`, `addResponse`, `addEvaluation`, `cleanup`) | ganham `addConsensusNote` e uma linha nova de limpeza |

O que **falta** e esta fatia cria: a tabela da anotação, as leituras com o filtro de visibilidade, a
action de salvar, e as duas caixas na célula da revisão.

---

## 2. A anotação, por extenso

### O que é uma anotação

Um texto ligado a **uma célula de uma resposta** (definição × critério), escrito por **um vínculo de
membro**, dentro de **uma rodada**. É o registro do que a equipe decidiu naquela divergência, e é a
razão pela qual o codebook mudou entre uma rodada e a seguinte. Isso é dado de pesquisa do TCC, e é
por isso que o protótipo anterior estava errado ao guardar isso em estado local: recarregar a página
apagava o material que justifica a próxima versão do codebook.

### Duas anotações, dois donos, duas visibilidades

| | Quem escreve | Quem lê | O que é |
|---|---|---|---|
| **Ata** | só o Administrador | todos os membros daquela rodada | o registro da decisão da equipe |
| **Anotação privada** | cada Avaliador, a sua | só o próprio autor | rascunho para preparar a reunião |

A visibilidade é **coluna gravada**, e não consequência do papel de quem lê no momento da leitura.
Uma ata escrita hoje continua sendo ata se amanhã o autor perder o papel de Administrador, e um
rascunho privado continua privado se o autor virar Administrador depois. Dado de pesquisa não muda de
natureza retroativamente por mudança de papel — e essa é a diferença entre gravar `visibility` e
deduzi-la com um `join` em `project_members.role` na hora de ler.

### Uma anotação por célula por pessoa

A chave é `(resposta, definição, critério, vínculo)`. Salvar de novo **edita no lugar**; não existe
histórico de versões de anotação (§ 5). Isso mantém a tela honesta: o que está na caixa é o que está
no servidor.

### Apagar o texto é apagar a anotação

Salvar com o campo vazio **remove a linha**, e não grava `''`. Uma linha vazia seria uma anotação que
existe e não diz nada, e a tela teria que inventar como mostrá-la. A CHECK `btrim(text) <> ''` é o
backstop; quem decide é a action.

### Presa à rodada, como a revisão

O Avaliador não alcança anotação de rodada em que não avaliou pelo mesmo caminho que já não alcança
as discordâncias: `requireReviewableRound`. A action repete a checagem por conta própria, porque
autorização de escrita não pode depender de a tela ter feito a leitura certa antes.

### A anotação só existe depois do fechamento

A revisão abre quando a rodada fecha (história 54, já implementado: a tela mostra `EmptyState` com
rodada aberta). A action recusa rodada aberta pela mesma razão: anotar consenso sobre resultado
parcial é registrar uma decisão que a equipe ainda não podia ter tomado.

---

## 3. Decisões desta fatia

**"O Administrador vê tudo" é sobre rodadas, e não sobre anotação privada.** O AC vem logo depois de
"o Avaliador não alcança as de rodada em que não participou", e é o contraponto dele: o Administrador
não é limitado por rodada. Ler como "o Administrador lê o rascunho de cada avaliador" destruiria o AC
vizinho, que diz que a anotação do Avaliador **é privada dele** — sem qualificar. E destruiria a coisa
que faz o espaço privado funcionar: ninguém prepara com franqueza o que vai levar para a reunião num
campo que o condutor da reunião lê antes. **Decisão: o Administrador lê todas as atas de todas as
rodadas, e nenhuma anotação privada.** Se isso for contestado, é ADR antes da Parte 2, não `if` no
código depois.

**A tabela chama `consensus_notes` e mora ao lado das rodadas.** `(tabs)/rounds/consensus.ts`, ao lado
de `review.ts` e `outliers.ts`, porque a anotação pertence ao domínio da rodada e é a revisão que a
consome. O nome do domínio, no glossário, é **anotação de consenso** — não "comentário", que sugeriria
uma linha de conversa com respostas, que não é o que isto é.

**A coluna `round_id` existe e é impossível divergir da resposta.** A spec pede a tabela ligando
rodada, resposta, definição, critério e vínculo. `round_id` é derivável de `response_id`, então a
redundância só se paga se o banco garantir a coerência: FK **composta** `(response_id, round_id)` →
`responses (id, round_id)`, com um `unique` novo em `responses (id, round_id)` para sustentá-la (é
trivialmente satisfeito, porque `id` já é PK). Com isso, filtrar anotação por rodada é leitura direta,
e uma linha incoerente é recusada pelo banco em vez de por revisão de código.

**A anotação aponta para o vínculo, e não para o usuário.** Mesma razão da avaliação (ADR 0009): o
dado de pesquisa é de quem participou daquele projeto naquele papel. Consequência concreta: o
Administrador-avaliador tem **dois** vínculos, e quem escreve a ata é o vínculo de administrador. A
action resolve isso — não a tela, e não o formulário.

**Escrita explícita, com botão de salvar.** Nada de autosave com `debounce`, nada de estado local
guardando texto. O projeto já aprendeu (#60) que estado que precisa sobreviver a revalidação não mora
no componente; aqui ele mora no servidor, e o gesto de salvar é visível, porque gravar a ata de uma
decisão é um ato, não um efeito colateral de digitar.

**A anotação não entra na classificação de divergência.** `reviewGroups` não muda de lógica. A célula
diverge pelo que as pessoas pontuaram; anotar não "resolve" a divergência nem a apaga da tela. Quem
quiser marcar divergência como resolvida está pedindo outra funcionalidade (§ 5).

**Nenhuma notificação.** Salvar ata não escreve em `notifications` e não manda e-mail. A revisão é
assíncrona por desenho, e a fatia não tem AC de aviso.

**A caixa aparece em todas as células, e não só nas divergentes.** A tela mostra todas as células
desde a #64, e uma decisão de equipe sobre uma célula unânime ("mantivemos, ficou claro") é material
de pesquisa igual. Restringir às divergentes esconderia metade do registro.

---

## 4. Fronteira com as fatias vizinhas

**#64 (revisão de discordâncias)** é dona da tela, da classificação de divergência e da porta de
acesso. Esta fatia **acrescenta** um bloco dentro da célula e **não** mexe em `divergence.ts`, em
`reviewGroups` nem em `requireReviewAccess`.

**#65 (outliers)** é dona da marca e do par de ICR. Esta fatia não encosta em `outliers.ts` nem em
`agreement*`. A ata de uma célula em que um marcado pontuou é ata igual: a marca é sobre o cálculo.

**#67 (exportação CSV)** exporta **notas**, não anotações — a linha do CSV, por spec, vai até a marca
de outlier. Exportar a ata é fatia futura (§ 5), e a leitura por rodada da Parte 1 já deixa isso
barato.

**Nenhuma tela do Avaliador exibe coeficiente**, e isso continua valendo: o bloco novo não traz
número nenhum, e o teste de página da #64 que proíbe as palavras (Krippendorff, ICR, Alpha,
Concordância) segue vivo — o texto novo não pode reintroduzi-las no ramo do Avaliador.

---

# Parte 1 — A anotação no banco

**Objetivo:** a tabela, a migration, o limite e as leituras com o filtro de visibilidade. Nenhuma
action, nenhuma tela. No fim da Parte, `npm test` prova pelo banco o que a anotação aceita, o que ela
recusa e quem enxerga o quê.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `lib/db/schema.ts` (o cabeçalho e as tabelas
`scores`, `responses` e `round_outliers`), `lib/limits.ts`, `(tabs)/rounds/outliers.ts` (modelo de
módulo de leitura), `test/helpers.ts` e `drizzle.config.ts`.

### 1.1 `lib/limits.ts`

```ts
export const CONSENSUS_NOTE_MAX = 5000
```

O valor é o do issue e o da spec. Vai no `maxLength` do form, na action e na CHECK — as três camadas
concordando, como manda o cabeçalho do arquivo.

### 1.2 `lib/db/schema.ts` + migration

Primeiro, o `unique` novo em `responses`, que é o que sustenta a FK composta:

```ts
unique("rs_unique_id_round").on(table.id, table.roundId),
```

Depois a tabela:

```ts
export const consensusNotes = pgTable("consensus_notes", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  roundId: uuid("round_id").notNull(),
  responseId: uuid("response_id").notNull(),
  definitionId: uuid("definition_id").notNull(),
  criterionId: uuid("criterion_id").notNull(),
  projectMemberId: uuid("project_member_id").notNull(),
  visibility: text().notNull(),
  text: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, ...)
```

Restrições, todas declarativas (constraint sim, trigger não — ADR 0007):

- `cn_unique_cell_author`: `unique` em `(response_id, definition_id, criterion_id, project_member_id)`.
  É a chave do `onConflictDoUpdate` da Parte 2, e é o que garante "uma anotação por célula por pessoa".
- `cn_response_visibility`: índice em `(response_id, visibility)` — é a leitura da tela.
- `cn_round_member`: índice em `(round_id, project_member_id)` — é a leitura por rodada (exportação
  futura e "minhas anotações da rodada").
- `cn_visibility_check`: `visibility = ANY (ARRAY['shared','private'])`.
- `cn_text_len`: `char_length(text) <= 5000` (literal congelado, como manda o comentário do topo).
- `cn_text_not_blank`: `btrim(text) <> ''`.
- FK **composta** `(response_id, round_id)` → `responses (id, round_id)`, `restrict`. É ela que torna
  impossível uma anotação dizer que pertence a uma rodada e apontar para resposta de outra. Não há FK
  separada de `round_id`: a composta já cobre.
- FKs `definition_id` → `codebook_definitions` e `criterion_id` → `codebook_criteria`, `restrict`,
  como em `scores`.
- FK `project_member_id` → `project_members`, `restrict` — dado de pesquisa, como avaliação e marca.

`updatedAt` é `defaultNow()` **e** escrito pela action no `onConflictDoUpdate` (`now()` via `sql`). Nada
de `$onUpdate` aqui: o `update` desta tabela passa por um caminho só, e a data explícita é o que o
teste consegue afirmar.

Fluxo: `npx drizzle-kit generate` → conferir o SQL gerado em `supabase/migrations/` → `npm run
db:reset`. **Não** usar `supabase gen` (sobrescreve a chave local).

### 1.3 `(tabs)/rounds/consensus.ts`

```ts
export type ConsensusVisibility = 'shared' | 'private'

export type ConsensusNote = {
  id: string
  responseId: string
  definitionId: string
  criterionId: string
  projectMemberId: string
  authorName: string
  visibility: ConsensusVisibility
  text: string
  updatedAt: string
}

/** Ata da resposta mais, se `memberIds` trouxer vínculos, as anotações privadas deles. */
export function loadResponseConsensus(
  responseId: string,
  memberIds: readonly string[],
  db?: DbExecutor,
): Promise<ConsensusNote[]>

/** Todas as anotações de uma rodada visíveis a esses vínculos — leitura por rodada. */
export function loadRoundConsensus(
  roundId: string,
  memberIds: readonly string[],
  db?: DbExecutor,
): Promise<ConsensusNote[]>
```

- O filtro é **um só**, e é o coração desta fatia:
  `or(eq(visibility, 'shared'), inArray(projectMemberId, memberIds))`, com `memberIds` vazio caindo
  em `eq(visibility, 'shared')` (nunca montar `inArray` com lista vazia). Escrito **uma vez**, num
  helper local `visibleTo(memberIds)`, usado pelas duas leituras: é a garantia de que ninguém
  reimplementa o predicado pela metade na próxima fatia.
- `memberIds` é uma **lista**, e não um id, porque o Administrador-avaliador tem dois vínculos, e ele
  precisa enxergar o próprio rascunho de avaliador.
- `authorName` sai de `project_members → profiles`, como em `review.ts`.
- Guardar `isUuid(...)` no começo e devolver `[]`, como `outliers.ts` e `review.ts` já fazem.
- Ordem: `visibility` descendente (`shared` antes de `private`) e `authorName` ascendente.
- **Sem** regra de autorização aqui. Este módulo lê o que lhe pedem; quem decide quais vínculos são do
  leitor é a página (Parte 3) e a action (Parte 2).

### 1.4 `(tabs)/rounds/consensus-cells.ts` (função pura)

```ts
export type CellConsensus = { minutes: ConsensusNote[]; mine: ConsensusNote | null }

export function consensusByCell(
  notes: readonly ConsensusNote[],
  authorMemberId: string | null,
): Map<string, CellConsensus>
```

Chave `${definitionId}:${criterionId}`, a mesma forma de `review-groups.ts`. `minutes` são as
anotações `shared` daquela célula (lista, não item: nada no schema impede um projeto com dois
vínculos de administrador, e a tela não pode escolher uma e sumir com a outra). `mine` é a anotação do
vínculo com que **este leitor escreve** — que é a ata, se ele é Administrador, e o rascunho, se é
Avaliador. Função pura, testada sem banco.

### 1.5 `test/helpers.ts`

- `addConsensusNote(tx, { roundId, responseId, definitionId, criterionId, projectMemberId, visibility, text? })`
  → id, com `text` default.
- `cleanup`: apagar `consensus_notes` **antes** de `evaluations` e de `responses`. Sem isso o
  `restrict` derruba a limpeza e quebra toda a suíte de integração — foi o que aconteceu quando
  `evaluations` nasceu (#60) e de novo com `round_outliers` (#65).

### 1.6 Testes da Parte 1

`(tabs)/rounds/consensus.int.test.ts`:

- [ ] **Uma por célula por pessoa**: a segunda anotação do mesmo vínculo na mesma célula é recusada
      (23505); vínculo diferente na mesma célula é aceito; mesma pessoa em célula diferente é aceita.
- [ ] **Texto vazio e texto longo demais são recusados pelo banco**: `''`, `'   '` e 5001 caracteres.
- [ ] **Visibilidade fora do vocabulário é recusada**.
- [ ] **Rodada incoerente é impossível**: anotação com `round_id` de outra rodada que não a da resposta
      viola a FK composta.
- [ ] **A ata é visível a quem não é o autor**: `loadResponseConsensus(responseId, [outroVinculo])`
      devolve a ata.
- [ ] **O rascunho é invisível para outro vínculo** e visível para o próprio (`memberIds` com ele).
- [ ] **`memberIds` vazio devolve só a ata** — o caso do Administrador sem vínculo de avaliador.
- [ ] **`loadRoundConsensus` recorta por rodada**: anotação da rodada 1 não aparece na 2.

`(tabs)/rounds/consensus-cells.unit.test.ts`:

- [ ] Agrupa por célula; célula sem anotação não aparece no mapa.
- [ ] `mine` é a do vínculo pedido, e é `null` quando `authorMemberId` é `null`.
- [ ] Ata do próprio Administrador aparece **nos dois** campos (`minutes` e `mine`) — é o caso que o
      formulário da Parte 3 depende para vir preenchido.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com a migration commitada junto do
`schema.ts`. Nenhuma tela mudou e nenhuma action existe ainda.

### O que a Parte 2 herda

**Migration:** `supabase/migrations/0014_square_carlie_cooper.sql`, aplicada com `npm run db:reset`.

**Gotcha da geração:** o `drizzle-kit generate` emitiu o `ALTER TABLE "responses" ADD CONSTRAINT
"rs_unique_id_round"` **depois** da FK composta que o referencia, e nessa ordem o Postgres recusa a
migration (a FK exige o unique já existente). O arquivo foi reordenado à mão: o `ALTER` de
`responses` é a **primeira** instrução. Se a Parte 2 regerar a migration por qualquer motivo,
conferir essa ordem de novo.

**Nomes finais das constraints** (todos como no § 1.2, sem divergência):
`cn_unique_cell_author`, `cn_response_visibility`, `cn_round_member`, `cn_visibility_check`,
`cn_text_len`, `cn_text_not_blank`, `consensus_notes_response_round_fkey` (a composta
`(response_id, round_id)` → `responses (id, round_id)`), `consensus_notes_definition_id_fkey`,
`consensus_notes_criterion_id_fkey`, `consensus_notes_project_member_id_fkey`, e o
`rs_unique_id_round` em `responses`.

**`(tabs)/rounds/consensus.ts` — o que saiu diferente do § 1.3:** as assinaturas de
`loadResponseConsensus` e `loadRoundConsensus` são as do plano. O módulo exporta **três coisas a
mais**, que a Parte 2 deve reusar em vez de escrever literais:

- `CONSENSUS_SHARED` e `CONSENSUS_PRIVATE` — as constantes do vocabulário;
- `isConsensusVisibility(value: string)` — o narrowing. O Drizzle devolve `visibility` como `string`
  (coluna `text`), então as leituras filtram por ele antes de montar `ConsensusNote`, no mesmo
  padrão de `isScaleValue` em `review.ts`.

`visibleTo(memberIds)` é local ao módulo e **não** é exportado: ele também descarta ids não-uuid
antes de montar o `inArray`, então `memberIds` sujo cai no ramo "só a ata" em vez de estourar.

**`(tabs)/rounds/consensus-cells.ts`:** `consensusByCell` é como o § 1.4. `minutes` sai ordenada por
`authorName` (`pt-BR`), com desempate por `projectMemberId`.

**`test/helpers.ts`:** `addConsensusNote(tx, opts)` — **objeto único**, sem argumentos posicionais
além da `tx` (são seis campos obrigatórios; posicional seria ilegível). `cleanup` apaga
`consensus_notes` antes de `round_outliers`/`evaluations`/`responses`, recortando pela subquery de
`roundIds` que já existia.

**Savepoint: sim, precisou** — igual à #65. Os casos de recusa usam o mesmo helper `refused`, que
abre `tx.transaction(...)` aninhada (savepoint) para que o erro do Postgres não aborte a transação
externa do `inRollbackTx`. Copiar o helper, não tentar sem ele.

**Códigos de erro que os testes afirmam:** `23505` (segunda anotação do mesmo vínculo na mesma
célula), `23514` (texto vazio/em branco/5001 chars, visibilidade fora do vocabulário) e **`23503`**
para a rodada incoerente — é violação de FK, não de CHECK.

**Fixture de teste:** o cenário usa uma definição com **dois** critérios, e os ids das células saem
de `loadCodebookVersion` + `resolveCells`, como em `agreement.int.test.ts`. `addCodebookVersion` não
devolve ids de definição/critério.

**Ambiente:** o `supabase` CLI desta máquina já está em **2.117.0** e não precisa mais do contorno de
re-assinatura (o SIGKILL era da 2.107). Docker Desktop continua sendo pré-requisito.

**Nada de tela e nada de action existem ainda**, e `relations.ts` não foi tocado — ele não cobre
`evaluations`, `scores` nem `round_outliers`, e `consensus_notes` segue a mesma linha.

---

# Parte 2 — A action

**Objetivo:** salvar e apagar a anotação, com a regra inteira de quem pode escrever o quê e onde. No
fim da Parte, a suíte prova os três ACs de visibilidade e o de recorte por rodada **sem passar por
tela nenhuma**.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, o "o que a Parte 2 herda", `(tabs)/rounds/outlier-actions.ts`
(forma, mensagens, revalidação), `(tabs)/rounds/review-access.ts`, `(tabs)/rounds/review.ts`
(`listEvaluatedRoundIds`) e `pipeline/criteria.ts`.

### 2.1 `(tabs)/rounds/consensus-actions.ts`

```ts
export type ConsensusState =
  | { error: string }
  | { ok: true; saved: boolean; nonce: number }
  | null

export async function saveConsensusNote(
  prev: ConsensusState,
  formData: FormData,
): Promise<ConsensusState>
```

Campos: `project_id`, `round_id`, `response_id`, `definition_id`, `criterion_id`, `text`.
`saved: false` é "o texto foi apagado", e é o que deixa a tela dizer "anotação removida" em vez de
fingir que gravou algo.

**Uma action só para os dois tipos de anotação.** Quem é o autor decide a visibilidade; um segundo
`saveMinutes`/`savePrivateNote` duplicaria toda a validação de célula e rodada para variar uma coluna,
e criaria a chance de a segunda cópia esquecer uma checagem.

Na ordem:

1. `requireUserId()`.
2. Campos obrigatórios presentes → senão `INVALID`.
3. Dentro de `transaction`, **resolver o autor**:
   - `isProjectAdmin(userId, projectId)` → carregar o vínculo de **administrador** desse usuário
     nesse projeto; `visibility = 'shared'`.
   - senão, carregar o vínculo de **avaliador ativo**; `visibility = 'private'`.
   - nenhum dos dois → `DENIED`. **É esta linha que barra quem não é membro**, e é o primeiro teste da
     Parte.
4. A rodada existe, é **deste** projeto e está **fechada** → senão `ROUND_MISSING` / `ROUND_OPEN`.
5. A resposta existe e é **desta** rodada → senão `RESPONSE_MISSING`.
6. Se o autor é Avaliador: ele enviou avaliação **nesta** rodada (mesma consulta de
   `listEvaluatedRoundIds`) → senão `ROUND_DENIED`, com mensagem que diz que a discussão fica presa à
   rodada em que se avaliou. **Este é o AC de recorte por rodada, e ele vive aqui, não na tela.**
7. A célula existe na versão de codebook que **a rodada** congelou: a definição é daquela versão, e o
   critério é daquela versão e se aplica àquela definição (específico dela ou geral) → senão
   `CELL_MISSING`. Sem isso, um `formData` forjado grava anotação numa célula que a tela nunca mostra.
8. `text.trim()`:
   - vazio → `delete` pela chave `(response_id, definition_id, criterion_id, project_member_id)`;
     devolve `saved: false` mesmo quando não havia linha (apagar o que não existe é sucesso, não erro).
   - acima de `CONSENSUS_NOTE_MAX` → recusa dizendo o tamanho atual e o teto, como
     `reasonTooLongMessage` já faz.
   - senão → `insert ... onConflictDoUpdate` na chave, gravando `text` **com trim**, `updatedAt: now()`
     e **sem** tocar em `visibility` no `set` (a coluna já é determinada pelo vínculo do conflito).
9. `revalidatePath` de `/projects/{id}/rounds/{roundId}`. Só essa: nenhuma outra tela mostra anotação.

Mensagens de erro no tom que o projeto já usa — dizem **por que** a regra existe, porque elas acabam
citadas na monografia. Em especial a de rodada aberta ("a revisão abre quando a rodada fecha; anotar
consenso sobre resultado parcial registra uma decisão que a equipe ainda não podia ter tomado") e a de
recorte por rodada.

### 2.2 Testes da Parte 2

`(tabs)/rounds/consensus-actions.int.test.ts` — usa as actions, que commitam, então vai de `ownerDb`
+ `cleanup()`, como `outlier-actions.int.test.ts`.

- [ ] **Quem não é membro é barrado**, e nada é gravado.
- [ ] **O Administrador grava ata**: a linha nasce com `visibility = 'shared'` e com o vínculo de
      administrador.
- [ ] **O Avaliador grava rascunho**: `visibility = 'private'` e o vínculo de avaliador.
- [ ] **A ata é visível para o outro membro da rodada** (via `loadResponseConsensus` com o vínculo dele).
- [ ] **O rascunho de um avaliador não aparece para outro avaliador** — o AC central, provado na borda.
- [ ] **O Administrador não lê rascunho de avaliador** (§ 3): `loadResponseConsensus` com os vínculos do
      Administrador não traz a `private` de ninguém.
- [ ] **Rodada em que o avaliador não avaliou é recusada**, mesmo com `response_id` válido.
- [ ] **Rodada aberta é recusada** para os dois papéis.
- [ ] **Resposta de outra rodada é recusada**; **célula fora da versão da rodada é recusada**.
- [ ] **Salvar duas vezes edita no lugar**: uma linha só, texto novo, `updatedAt` maior.
- [ ] **Texto vazio apaga**; apagar o que não existe devolve `saved: false` sem erro.
- [ ] **Acima de `CONSENSUS_NOTE_MAX` é recusado** e a linha anterior fica intacta.
- [ ] **O Administrador-avaliador escreve ata**, e não rascunho, quando tem os dois vínculos.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Nenhuma tela mudou ainda — e os quatro ACs de
visibilidade e recorte já estão provados.

### O que a Parte 3 herda

*(preencher: assinatura final da action, nomes das mensagens, e como o vínculo do autor foi resolvido —
a Parte 3 precisa da mesma resolução para saber qual `authorMemberId` passar a `consensusByCell`.)*

---

# Parte 3 — A ata na revisão

**Objetivo:** o Administrador escreve a ata por célula, dentro da resposta, e todos os membros daquela
rodada a leem. Ela sobrevive a recarregar e a sair e voltar, porque nunca esteve em outro lugar que
não o servidor.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, os "o que herda" anteriores,
`(tabs)/rounds/[roundId]/page.tsx`, `review-groups-list.tsx`, `members/outlier-forms.tsx` (forma do
form cliente) e `app/components/ui/field.tsx`.

### 3.1 A página carrega o que o leitor pode ver

Em `[roundId]/page.tsx`, dentro da transação que já existe:

- resolver os **vínculos do leitor** naquele projeto: `access.memberId` (avaliador, da #64) e, quando
  `access.isAdmin`, o vínculo de administrador. É a mesma resolução da action (§ 2.1), e por isso ela
  vira função exportada do módulo de acesso — `loadReviewMemberships(projectId, userId, tx)` →
  `{ adminMemberId: string | null; evaluatorMemberId: string | null }` — em vez de ser escrita duas
  vezes.
- `loadResponseConsensus(current.id, [adminMemberId, evaluatorMemberId].filter(Boolean), tx)`.
- `authorMemberId = adminMemberId ?? evaluatorMemberId` — o mesmo critério da action: com os dois
  vínculos, escreve-se como Administrador.
- `consensusByCell(notes, authorMemberId)` fora da transação, junto de `reviewGroups`.

Nada disso é condicional por papel: **a consulta é a mesma para todos**, e é o predicado de
visibilidade que faz o recorte. Aqui, diferente do coeficiente (#64) e da marca de outlier (#65), a
invisibilidade não pode ser estrutural por ramo — o Avaliador *precisa* ler a ata. O que protege o
rascunho é o `where`, e é por isso que ele mora num helper único (§ 1.3) com teste próprio.

### 3.2 A célula ganha um bloco

`ReviewGroupsList` passa a receber:

```ts
type ConsensusContext = {
  projectId: string
  roundId: string
  responseId: string
  canWriteMinutes: boolean
  byCell: ReadonlyMap<string, CellConsensus>
}

ReviewGroupsList({ groups, consensus }: { groups: DefinitionGroup[]; consensus: ConsensusContext | null })
```

`consensus: null` quando não há o que mostrar nem escrever (rodada sem célula) — e é o que mantém os
testes de componente da #64 válidos sem mudar a chamada deles.

Dentro de `Cell`, depois da lista de notas, um componente `ConsensusCell` (servidor):

- **A ata, quando existe:** rótulo "Ata da discussão", o texto em caixa com rolagem própria
  (`scrollBoxClass` + `preWrapClass`), com "por {autor}, {data}". Aparece para **todos** — é o AC.
- **O formulário, só se `canWriteMinutes`:** um `Disclosure` ("Registrar a decisão" / "Editar a ata"),
  com `Textarea` `maxLength={CONSENSUS_NOTE_MAX}`, `defaultValue` da ata atual, `SubmitButton`
  "Salvar ata", e o `hint` dizendo, em uma frase, que a ata fica visível para quem avaliou nesta
  rodada.
- **Sem ata e sem permissão de escrita:** nada. Nem caixa vazia nem "sem ata" — a célula já é densa, e
  ausência de ata não é erro.

Componente cliente novo: `(tabs)/rounds/consensus-form.tsx`, com `useActionState(saveConsensusNote)`,
hidden inputs de `project_id`/`round_id`/`response_id`/`definition_id`/`criterion_id`, `Alert` de erro
e uma confirmação discreta quando `ok` (inclusive a de remoção, quando `saved: false`).

**Gotcha do `Textarea` não controlado:** depois de salvar, a revalidação traz um `defaultValue` novo,
mas o DOM mantém o que está digitado — igual, então inofensivo. No caso de **remoção**, e ao trocar de
resposta pela `QueueNav`, o remount é necessário: `key={note?.updatedAt ?? 'empty'}` no `Textarea`
resolve os dois, sem estado local e sem `useEffect`.

### 3.3 Testes da Parte 3

`(tabs)/rounds/[roundId]/page.int.test.ts`:

- [ ] **A ata aparece para o Administrador e para o avaliador da rodada**, com o texto e o nome do autor.
- [ ] **O formulário de ata só existe para o Administrador** (o Avaliador não recebe `ConsensusForm` com
      `canWriteMinutes`).
- [ ] **Ata de outra resposta não vaza** na resposta em foco.
- [ ] **A ata sobrevive**: dois renders seguidos da página, sem nada em memória entre eles, devolvem o
      mesmo texto — é a tradução do AC "sobrevive a recarregar" para o que um teste pode afirmar.
- [ ] O texto novo **não contém** as palavras proibidas no ramo do Avaliador (asserção da #64, que já
      existe: garantir que ela cobre o bloco novo).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, e a tela conferida no Supabase local com
`/dev/login` (dois papéis, uma rodada fechada, uma célula divergente).

### O que a Parte 4 herda

*(preencher: forma final de `ConsensusContext`, onde o bloco entrou em `Cell`, e o que mudou nos testes
da #64 que já liam a árvore da célula.)*

---

# Parte 4 — O espaço privado do Avaliador, e o fechamento

**Objetivo:** o Avaliador ganha a caixa própria na mesma célula, invisível para todo mundo — inclusive
para o Administrador. O glossário passa a descrever o que existe, e os ACs do issue são varridos um a
um.

**Ler antes:** `AGENTS.md`, as seções 1 a 4, os "o que herda" anteriores, `docs/CONTEXT.md` (seções
"Pipeline e avaliação" e "Em aberto") e o § 3 deste plano.

### 4.1 A segunda caixa

`ConsensusCell` ganha, abaixo da ata:

- **Para o Avaliador:** `Disclosure` "Minha anotação (só você vê)", com o mesmo `ConsensusForm`, agora
  apontando para o rascunho (`mine`), e o `hint` dizendo que este espaço é privado e serve para
  preparar o que levar à reunião.
- **Para o Administrador:** nada. Ele não tem espaço privado nesta fatia (§ 5), e a ata dele já é a
  caixa de cima.

O componente cliente é o **mesmo** da Parte 3, parametrizado por rótulo e por `note`: são dois campos
com a mesma mecânica, e duplicar o formulário criaria dois lugares para corrigir o mesmo bug de
`maxLength`.

Consequência de desenho a conferir na tela: um Avaliador vê, na mesma célula, a ata (leitura) e o
próprio rascunho (escrita), e a diferença entre as duas precisa ser óbvia **sem ler o rótulo** — tons
diferentes de `Card`, como a tela já faz entre célula divergente e não divergente.

### 4.2 Testes da Parte 4

`(tabs)/rounds/[roundId]/page.int.test.ts`:

- [ ] **O rascunho de um avaliador não aparece na página do outro avaliador**, com o mesmo dado no banco.
- [ ] **O rascunho não aparece na página do Administrador** (§ 3).
- [ ] **O próprio autor vê o seu rascunho preenchido no formulário**.
- [ ] **O Avaliador não alcança a rodada em que não avaliou** — reafirmar o teste da #64 **com anotação
      gravada nessa rodada**, que é o AC 6 deste issue e o único caminho em que um `notFound` frouxo
      vazaria ata e rascunho de uma vez.

### 4.3 O glossário

`docs/CONTEXT.md`, na seção "Pipeline e avaliação", perto de **Nota** e **Outlier**:

> **Anotação de consenso**
> Texto que registra, por célula de uma resposta, o que se decidiu na revisão de discordâncias.
> Existem duas: a **ata**, escrita pelo Administrador e visível para quem avaliou naquela rodada, que é
> o registro da decisão da equipe e a razão pela qual o codebook mudou de uma rodada para a seguinte;
> e a **anotação privada** do Avaliador, que só ele vê e serve para preparar a reunião. As duas ficam
> presas à rodada em que foram escritas e são persistidas no servidor — não são estado de tela.
> Evitar: "comentário" (sugere uma conversa com respostas, que não é o que existe).

Conferir também o verbete **Rodada fechada**, que hoje diz que fechar "libera a revisão de
discordâncias": acrescentar que é a partir daí que a discussão é registrada. E, na seção "Em aberto",
acrescentar as linhas do § 5 que forem decisões em suspenso de verdade — não a lista inteira.

### 4.4 Varredura dos ACs

Passar os sete ACs do issue e os três testes item a item contra o que existe, e anotar no comentário de
fechamento da issue o commit de cada Parte. Os dois que costumam passar despercebidos:
**"sobrevive a sair e voltar"** (conferir na tela, não só no teste: sair do projeto, voltar, abrir
outra resposta e voltar à primeira) e **"respeita `CONSENSUS_NOTE_MAX`"** nas três camadas (form,
action e CHECK — colar 5001 caracteres na tela e ver a recusa com a mensagem da action, não um erro de
banco).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, os sete ACs conferidos, o glossário atualizado
e a cena de teste apagada do banco local (`scores` vazia — cena remanescente quebra `npm test`).

---

## 5. Fica para depois (registrar, não construir)

- **Espaço privado do Administrador.** Hoje ele só tem a ata. Provavelmente útil, não é AC, e mexe na
  resolução de autor da action.
- **Anotação da resposta inteira**, além da célula. A spec pede por critério; uma nota geral por
  resposta é outra tabela ou outra coluna, e outra decisão de método.
- **Histórico de edição da anotação.** A ata hoje é editada no lugar. Se a evolução da decisão virar
  dado de pesquisa, vira tabela de versões — e aí merece ADR.
- **Marcar a divergência como resolvida.** É estado, não texto, e mudaria o que a tela destaca.
- **Ata na exportação.** A #67 exporta notas; exportar ata é outra consulta, e `loadRoundConsensus` já
  deixa isso barato.
- **Aviso de ata nova.** Nenhuma notificação nesta fatia, por desenho.
- **Anonimização dos nomes na revisão**, já registrada como funcionalidade futura no glossário — vale
  também para o autor da ata.

## 6. Deploy

A migration da Parte 1 precisa de `db push` em prod junto do deploy desta fatia. Sem isso, a revisão de
discordâncias quebra em produção na primeira leitura de `consensus_notes`. Lembrar do ruído do `pg_net`
no diff e de conferir que o `unique` novo de `responses` foi junto — ele não cria índice novo de dado,
mas é pré-requisito da FK composta, e a migration falha pela metade sem ele.
