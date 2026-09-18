# Plano de implementação — Issue #65: "27 — Outliers: marca por rodada e ICR com e sem"

Link: https://github.com/nicolasddr/tcc/issues/65
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 45, 46, 47, 48, 49,
61 e 62)
Blocked by: #62 (fechada) — "Concordância: módulo de cálculo e ICR da rodada" · #64 (fechada) —
"Revisão de discordâncias"

**A executar em 4 partes, uma por chat.** As seções 1 a 4 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas quatro seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda" — anotar ali o que divergiu, como nos planos das #60, #61, #62, #63 e #64.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | A marca no banco: limite, tabela `round_outliers`, migration, leitura e helpers de teste | ☑ |
| 2 | As actions e a área de membros: marcar com justificativa, desmarcar, e a linguagem de desativação | ☑ |
| 3 | O número: ICR com todos e sem os outliers, lado a lado, e a lista de esforço honesta | ☑ |
| 4 | A revisão identifica o outlier, só para o Administrador, e o acerto do glossário | ☐ |

**Nenhuma ADR nova.** A decisão inteira já está registrada na **ADR 0011** (exclusão do cálculo com
porta única, e ICR invisível ao Avaliador) e a **ADR 0008** já recebeu a emenda que aponta para cá.
A **ADR 0009** é o que garante que desativar preserva a avaliação. Esta fatia **implementa** essas
ADRs; se algo divergir delas, o caminho é emendar a ADR, não improvisar no código.

**Com migration.** É a primeira tabela nova desde a #60. `npx drizzle-kit generate` na Parte 1, e o
deploy desta fatia **precisa de `db push` em prod** — prod atrasa a cada `db reset` local que não é
empurrado, e já atrasou duas vezes neste projeto.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Observações da rodada, já com o dono da nota | `(tabs)/rounds/agreement.ts` (`RoundObservation.projectMemberId`) | é por este campo que a exclusão filtra — **já está lá**, nada a acrescentar |
| Observações de todas as rodadas | `(tabs)/rounds/agreement.ts` (`loadProjectObservations`) | a lista de rodadas e a série leem daqui |
| Esforço por avaliador | `(tabs)/rounds/agreement.ts` (`listEvaluatorEffort`) | hoje filtra `status = 'active'`; a Parte 3 mexe nisso (§ 3) |
| Módulo puro do coeficiente | `lib/agreement.ts` (`ordinalAlpha`, `Agreement`) | chamado **duas vezes** a partir desta fatia; o módulo não muda |
| Painel de ICR da rodada | `(tabs)/rounds/agreement-panel.tsx` (`AgreementPanel`, `AgreementValue`) | onde os dois valores passam a aparecer |
| Matriz por célula | `(tabs)/rounds/agreement-matrix.ts` + `-table.tsx` | **não** ganha par (§ 3) |
| Série por rodada | `(tabs)/rounds/agreement-series.ts` + `-chart.tsx`, usada em `(tabs)/page.tsx` | ganha só a marca de "esta rodada tem exclusão" (§ 3) |
| Revisão de discordâncias | `(tabs)/rounds/review.ts`, `review-groups.ts`, `review-groups-list.tsx` | onde o outlier aparece identificado (Parte 4) |
| Área de membros | `app/projects/[id]/members/page.tsx` + `member-list.tsx` + `member-actions.tsx` | onde a marca é feita (AC) e onde a linguagem muda |
| Desativar membro | `app/projects/actions.ts` (`removeMember`) | preserva avaliação desde a #60; a Parte 2 acerta o **nome** e o texto |
| Autorização de Administrador | `lib/authz.ts` (`isProjectAdmin`) | a trava das duas actions |
| Forma de action com estado | `(tabs)/rounds/actions.ts` (`createRound`, `closeRound`) | modelo de assinatura, mensagens e `revalidatePath` |
| Limites com CHECK espelhada | `lib/limits.ts` | onde `OUTLIER_REASON_MAX` nasce |
| Helpers de integração | `test/helpers.ts` (`addEvaluation`, `addScore`, `memberId`, `cleanup`) | ganham `addOutlier` e uma linha nova de limpeza |

O que **falta** e esta fatia cria: a tabela da marca, as duas actions, o painel na área de membros, o
par de valores na tela e a identificação do outlier na revisão.

---

## 2. A marca, por extenso

### O que é uma marca

Uma linha ligando **um vínculo de avaliador** a **uma rodada**, com justificativa escrita, autor e
data. Enquanto ela está ativa, as notas daquele vínculo naquela rodada saem do cálculo — e só do
cálculo. Nada mais muda: o avaliador continua avaliando, as notas continuam gravadas e imutáveis, e
ele continua aparecendo na revisão.

A marca é **por rodada**, e não por projeto. Marcar o projeto inteiro é uma afirmação sobre a pessoa;
marcar a rodada é uma afirmação sobre um conjunto de notas, que é o que o Administrador de fato
observou (ADR 0011). É também o que impede uma marcação de hoje reescrever a série de rodadas
passadas por conta própria.

### Remover é registrar, não apagar

Remover a marca **não apaga a linha**: preenche `removed_at` e `removed_by`. O histórico de
marcações é AC (história 47), e uma linha apagada não é histórico. O efeito no cálculo é imediato
porque o filtro olha `removed_at IS NULL`, e não a existência da linha.

Uma consequência de desenho: a mesma pessoa pode ser marcada, desmarcada e marcada de novo na mesma
rodada, e o resultado são três linhas. O que precisa ser único é a marca **ativa** — uma só por
(rodada, vínculo) —, e isso é índice único parcial, não constraint sobre a tabela inteira. O projeto
já usa exatamente esse recurso em `inv_one_pending_per_invitee`.

### Só se marca quem avaliou

A action recusa marcar um vínculo que não enviou nenhuma avaliação naquela rodada. Dois motivos, e os
dois valem:

1. Marcar quem não avaliou não tira nada de cálculo nenhum. É gesto sem efeito, e gesto sem efeito na
   tela de uma ferramenta de pesquisa é convite a interpretação errada.
2. Fecha uma porta de FK. `round_outliers.project_member_id` é `restrict`, e `revokeEvaluatorRole`
   (`app/projects/actions.ts`) faz `DELETE` na linha de `project_members` quando não há avaliação
   enviada. Com a regra acima, marca e avaliação andam juntas, e o `restrict` de `evaluations` já
   barra o delete antes — o `restrict` da marca nunca chega a ser o primeiro a falar.

### Rodada aberta também aceita marca

O ICR aparece desde a primeira avaliação (#62), então a exclusão precisa existir enquanto o valor
existe. Não há trava de rodada fechada nas actions. O que existe é a regra acima: sem avaliação
enviada naquele vínculo, não há o que marcar.

### O que a marca não faz

- **Não notifica o avaliador.** Nenhuma linha em `notifications`, nenhum e-mail. É AC e é ADR.
- **Não muda a tela do Avaliador.** Nem a de avaliar, nem a de revisão: a Parte 4 carrega as marcas
  **apenas** no ramo de Administrador, para que a invisibilidade seja estrutural em vez de depender
  de um `if` dentro de um componente compartilhado — mesma escolha que a #64 fez com o coeficiente.
- **Não tira ninguém do acesso.** Acesso é `project_members.status`, e é outra porta.

---

## 3. Decisões desta fatia

**A tabela chama `round_outliers` e mora ao lado das rodadas.** O nome diz o recorte, que é a coisa
que mais se erra ao ler esta funcionalidade depois. `project_outliers` seria o desenho rejeitado pela
ADR 0011 com nome de tabela.

**O código do outlier mora em `(tabs)/rounds/`, mesmo com a tela em `members/`.** A marca pertence ao
domínio da rodada: é a rodada que dá o recorte, é o cálculo da rodada que a consome, e é lá que
`agreement.ts` já vive. A área de membros é onde o **gesto** acontece (AC), e importa de lá — como a
página de membros já importa de `lib/authz`. Espalhar o conceito por duas pastas por causa da rota
faria a próxima pessoa procurar em três lugares.

**O par de valores é um tipo, e não dois parâmetros soltos.** `agreementPair(observations, excluded)`
devolve `{ all, withoutOutliers, excluded }`, com `withoutOutliers: Agreement | null`. O `null` é
quem cumpre o AC "sem outlier, aparece um só, sem sugerir que falta algo" — a tela não escolhe, ela
recebe. E `all` não é opcional em lugar nenhum da assinatura: **é impossível** construir o par sem o
valor com todos, que é o AC mais forte do issue.

**A matriz por célula continua sendo só "com todos".** Duplicar cada célula da tabela criaria uma
grade de leitura dobrada para responder uma pergunta que ninguém faz por célula, e a #63 já lutou
para essa tabela caber na tela. O que a matriz ganha é **uma frase** dizendo sobre qual conjunto ela
foi calculada, para que ninguém leia a célula como se fosse o valor filtrado. Matriz com par é fatia
futura barata (§ 5), e não é AC.

**A série da visão geral continua desenhando o valor com todos.** Duas linhas na série diriam que as
rodadas são comparáveis entre si depois da exclusão, e elas não são: cada rodada tem o seu próprio
conjunto de marcados, escolhido depois de ver o resultado. O que a série ganha é uma **marca discreta
nas rodadas que têm exclusão**, com o link que já existe para a rodada, onde o par aparece por
extenso. O valor com todos nunca é escondido — que é literalmente o que ela já faz.

**A lista de esforço passa a mostrar quem foi desativado, se avaliou naquela rodada.** Hoje
`listEvaluatorEffort` filtra `status = 'active'`, e a partir desta fatia isso vira incoerência
visível: o coeficiente seria calculado sobre notas de gente que a tela ao lado não lista. As duas
perguntas são diferentes e passam a ser respondidas por consultas diferentes:

| Pergunta | Quem responde | Quem entra |
|---|---|---|
| Quem ainda falta terminar? (denominador do progresso) | `listEvaluatorsNotFinished` | só vínculos **ativos** |
| De quem são as notas que entraram no cálculo? | `listEvaluatorEffort` | ativos **mais** os desativados que enviaram avaliação naquela rodada |

É assim que o AC "desativar apenas tira do denominador do progresso" fica provado na tela, e não só
no teste.

**A rodada em foco da área de membros vive na URL** (`?round=<id>`). Estado que precisa sobreviver a
revalidação pertence à URL — a lição da #60 —, e aqui toda marcação revalida a página.

**Desativar muda de nome no código, e não só na tela.** `removeMember` vira `deactivateMember`, e
`RemoveMemberButton` vira `DeactivateMemberButton`. São quatro arquivos e nenhum comportamento novo.
O AC pede que a tela fale em desativar; deixar a action chamando `remove` mantém no código exatamente
a confusão que a ADR 0009 mandou tirar da interface, e é ela que faz alguém achar, daqui a três
meses, que existe um segundo caminho para sumir com as notas de alguém.

**Nada de "sugerir outliers".** Nenhuma função de desvio, de distância ao grupo, de ranking de quem
destoa. O issue não pede, a ADR 0011 rejeitou o diagnóstico automático, e uma sugestão na tela
transformaria a exclusão declarada em exclusão assistida — que é o risco metodológico inteiro desta
funcionalidade, escrito por extenso na ADR.

---

## 4. Fronteira com as fatias vizinhas

**#66 (anotações de consenso)** é dona da ata e da anotação privada. Esta fatia não cria nenhuma
tabela de texto além de `round_outliers`, e não encosta na célula da revisão além do rótulo do
outlier.

**#67 (exportação CSV)** é dona do dado bruto e, por spec, a exportação carrega a marca de outlier
por linha. Esta fatia deixa `loadRoundOutliers` pronta para isso e **não** escreve exportação nenhuma.

**#63 (matriz e série)** continua dona das duas leituras por célula e por rodada. Esta fatia
acrescenta o par no painel e a marca na série, sem mexer no cálculo por célula.

**#62 (módulo de cálculo)** continua dona de `lib/agreement.ts`. O módulo **não muda**: a exclusão é
filtro na entrada, e não parâmetro do coeficiente. Se alguém sentir vontade de passar uma lista de
excluídos para `ordinalAlpha`, é sinal de que o filtro está no lugar errado.

---

# Parte 1 — A marca no banco

**Objetivo:** a tabela, a migration, o limite e as leituras. Nenhuma action, nenhuma tela. No fim da
Parte, `npm test` prova pelo banco o que a marca aceita e o que ela recusa.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, `lib/db/schema.ts` (o cabeçalho e as tabelas
`evaluations`/`project_invitations`), `lib/limits.ts`, `test/helpers.ts` e `drizzle.config.ts`.

### 1.1 `lib/limits.ts`

```ts
export const OUTLIER_REASON_MAX = 2000
```

O nome é o do issue. A anotação de consenso (5000) fica para a #66.

### 1.2 `lib/db/schema.ts` + migration

```ts
export const roundOutliers = pgTable("round_outliers", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  roundId: uuid("round_id").notNull(),
  projectMemberId: uuid("project_member_id").notNull(),
  reason: text().notNull(),
  markedBy: uuid("marked_by").notNull(),
  markedAt: timestamp("marked_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  removedBy: uuid("removed_by"),
  removedAt: timestamp("removed_at", { withTimezone: true, mode: 'string' }),
}, ...)
```

Restrições, todas declarativas (constraint sim, trigger não — ADR 0007/0009):

- `ro_one_active_per_member`: índice único **parcial** em `(round_id, project_member_id)`
  `WHERE removed_at IS NULL`. É o que garante uma marca ativa por vínculo por rodada sem impedir o
  histórico. Espelhar a forma de `inv_one_pending_per_invitee`.
- `ro_round_active`: índice em `(round_id)` `WHERE removed_at IS NULL` — é a leitura do cálculo.
- `ro_removal_paired`: `(removed_at IS NULL AND removed_by IS NULL) OR (removed_at IS NOT NULL AND
  removed_by IS NOT NULL)`. Impede meia remoção registrada.
- `ro_reason_len`: `char_length(reason) <= 2000` (literal congelado, como manda o comentário no topo
  do arquivo).
- `ro_reason_not_blank`: `btrim(reason) <> ''`. A justificativa obrigatória é decidida na action; a
  CHECK é o backstop, no mesmo espírito de `cc_name_not_blank`.
- FKs, todas **restrict**: `round_id` → `rounds` e `project_member_id` → `project_members`, porque a
  marca é dado de pesquisa como a avaliação; `marked_by` e `removed_by` → `profiles`. Note que
  `removed_by` **não** pode ser `set null`, ao contrário de `invited_by` e `resolved_by`: o
  `ro_removal_paired` exige autor quando há remoção, e um `set null` transformaria a linha em estado
  ilegal na primeira exclusão de perfil.

Fluxo: `npx drizzle-kit generate` → conferir o SQL gerado em `supabase/migrations/` → `npm run
db:reset`. **Não** usar `supabase gen` (sobrescreve a chave local).

### 1.3 `(tabs)/rounds/outliers.ts`

```ts
export type OutlierMark = {
  id: string
  roundId: string
  projectMemberId: string
  evaluatorName: string
  reason: string
  markedAt: string
  markedByName: string
  removedAt: string | null
  removedByName: string | null
}

/** Marcas ATIVAS de uma rodada, em ordem de nome do avaliador. */
export function loadRoundOutliers(roundId: string, db?: DbExecutor): Promise<OutlierMark[]>

/** Todas as marcas da rodada, ativas e removidas, da mais recente para a mais antiga. */
export function loadOutlierHistory(roundId: string, db?: DbExecutor): Promise<OutlierMark[]>

/** roundId → vínculos com marca ATIVA, para a lista de rodadas e a série. */
export function loadProjectOutliers(
  projectId: string, db?: DbExecutor,
): Promise<Map<string, Set<string>>>

export function excludedMemberIds(marks: readonly OutlierMark[]): Set<string>
```

- Guardar `isUuid(...)` no começo de cada leitura e devolver vazio, como `agreement.ts` já faz.
- `loadProjectOutliers` existe pelo mesmo motivo que `loadProjectObservations`: a lista de rodadas e
  a série precisam de todas as rodadas numa consulta só, e não de uma por rodada.
- O nome do autor sai de dois `join` com `profiles` (um por `marked_by`, outro por `removed_by`),
  usando `alias`, como `lib/authz.ts` já faz.
- **Sem** função de cálculo aqui. Este módulo lê banco; quem combina com o coeficiente é a Parte 3.

### 1.4 `test/helpers.ts`

- `addOutlier(tx, roundId, projectMemberId, markedBy, opts?)` → id, com `reason` default e `opts`
  para já nascer removida (`removedBy`, `removedAt`).
- `cleanup`: apagar `round_outliers` **antes** de `evaluations` e de `projects`. Sem isso o
  `restrict` de `project_member_id` derruba a limpeza e quebra toda a suíte de integração — foi
  exatamente o que aconteceu quando `evaluations` nasceu, e está registrado no plano da #60.

### 1.5 Testes da Parte 1

`(tabs)/rounds/outliers.int.test.ts`:

- [ ] **Uma marca ativa por vínculo por rodada**: a segunda marca ativa é recusada (23505); depois de
      remover a primeira, a nova marca é **aceita**, e a rodada passa a ter duas linhas e uma ativa.
- [ ] **Justificativa vazia é recusada pelo banco**: `''` e `'   '` batem na CHECK; 2001 caracteres
      batem na CHECK de tamanho.
- [ ] **Meia remoção é recusada**: `removed_at` sem `removed_by` (e o contrário) viola
      `ro_removal_paired`.
- [ ] **A marca é por rodada**: marcar o vínculo na rodada 1 não faz `loadRoundOutliers` da rodada 2
      devolver nada.
- [ ] **Remover não apaga**: `loadRoundOutliers` deixa de devolver a marca e `loadOutlierHistory`
      continua devolvendo, com `removedAt`/`removedByName` preenchidos.
- [ ] **Desativar o vínculo não apaga a marca nem a avaliação**: `status = 'inactive'` e as duas
      linhas continuam lá.
- [ ] **`loadProjectOutliers` agrupa por rodada** e ignora as removidas.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, com a migration commitada junto do
`schema.ts`. Nenhuma tela mudou e nenhuma action existe ainda.

### O que a Parte 2 herda

**Migration:** `supabase/migrations/0013_fine_george_stacy.sql` (só cria `round_outliers`; nenhuma
outra tabela foi tocada). `npm run db:reset` aplicado localmente. **Prod ainda precisa do `db push`**
(§ 6).

**Constraints, com o nome final:** `ro_one_active_per_member` (índice único parcial em
`(round_id, project_member_id) WHERE removed_at IS NULL`), `ro_round_active` (índice parcial em
`(round_id)`), `ro_removal_paired`, `ro_reason_len` (2000, literal), `ro_reason_not_blank`, e as
quatro FKs `round_outliers_{round_id,project_member_id,marked_by,removed_by}_fkey`, **todas
`restrict`**. Sem divergência do § 1.2.

**`lib/limits.ts`:** `OUTLIER_REASON_MAX = 2000`.

**`(tabs)/rounds/outliers.ts`** — assinaturas como no § 1.3, sem desvio:

```ts
type OutlierMark = { id, roundId, projectMemberId, evaluatorName, reason,
                     markedAt, markedByName, removedAt, removedByName }
loadRoundOutliers(roundId: string, db: DbExecutor = ownerDb): Promise<OutlierMark[]>
loadOutlierHistory(roundId: string, db: DbExecutor = ownerDb): Promise<OutlierMark[]>
loadProjectOutliers(projectId: string, db: DbExecutor = ownerDb): Promise<Map<string, Set<string>>>
excludedMemberIds(marks: readonly OutlierMark[]): Set<string>
```

`loadRoundOutliers` ordena por nome do avaliador; `loadOutlierHistory` por `markedAt` desc e nome asc.
Os dois compartilham o mesmo `select` (`selectMarks`), com `alias(profiles, 'marker'|'remover')`.

**`test/helpers.ts`:** `addOutlier(tx, roundId, projectMemberId, markedBy, opts?)` com
`{ reason, markedAt, removedBy, removedAt }` — passar `removedBy` já nasce removida (a data cai em
`now()` do JS se não vier). `cleanup` apaga `round_outliers` antes de `evaluations`.

**Gotcha para quem escrever teste de recusa:** um erro de constraint aborta a transação inteira do
`inRollbackTx`. Quando o teste precisa continuar depois da recusa, envolver a escrita num savepoint
(`tx.transaction(...)`) — é o helper `refused` de `outliers.int.test.ts`. E, como `defaultNow()` é o
`now()` da transação, todas as marcas criadas no mesmo teste nascem com o **mesmo** `markedAt`: para
testar ordem, passar `markedAt` explícito.

---

# Parte 2 — As actions e a área de membros

**Objetivo:** o Administrador marca e desmarca na área de membros, com justificativa obrigatória, e a
tela passa a falar em desativar apresentando as duas coisas como diferentes.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, o "o que a Parte 2 herda" da Parte 1,
`(tabs)/rounds/actions.ts` (forma de action, mensagens e revalidação), `app/projects/actions.ts`
(`removeMember`), `members/page.tsx`, `member-list.tsx`, `member-actions.tsx` e
`(tabs)/rounds/close-round.tsx` (modelo de form com `useActionState`).

### 2.1 `(tabs)/rounds/outlier-actions.ts`

```ts
export type OutlierState = { error: string } | { ok: true; nonce: number } | null

export async function markOutlier(prev: OutlierState, formData: FormData): Promise<OutlierState>
export async function unmarkOutlier(prev: OutlierState, formData: FormData): Promise<OutlierState>
```

`markOutlier` recebe `project_id`, `round_id`, `project_member_id`, `reason`. Na ordem:

1. `requireUserId()`; `isProjectAdmin(userId, projectId)` → senão `MARK_DENIED`. **É esta linha que
   barra o Avaliador**, e ela é o primeiro teste da Parte.
2. `reason.trim()` vazio → recusa com mensagem que diz por que a justificativa existe (defensável na
   monografia), e não um "campo obrigatório" genérico. Acima de `OUTLIER_REASON_MAX` → recusa dizendo
   o teto. Gravar o texto **com trim**.
3. Dentro de `transaction`: a rodada existe e é **deste** projeto; o vínculo existe e é **deste**
   projeto; o vínculo enviou ao menos uma avaliação **nesta** rodada (§ 2) — senão recusa explicando
   que não há nota daquela pessoa nesta rodada para tirar do cálculo.
4. `insert`. `pgErrorCode(err) === '23505'` → "esta pessoa já está marcada nesta rodada; recarregue a
   página", que é a corrida de duas abas e não um erro de programa.

`unmarkOutlier` recebe `project_id`, `round_id`, `mark_id`. Mesma trava de Administrador; `update`
com `removedAt: sql\`now()\``, `removedBy: userId`, filtrando `id`, `roundId` e `isNull(removedAt)`.
Zero linhas afetadas → "esta marca já foi removida; recarregue a página".

Revalidar, nas duas: `/projects/{id}/members`, `/projects/{id}/rounds`, `/projects/{id}` e
`/projects/{id}/rounds/{roundId}`. São as quatro telas cujo número ou cujo rótulo muda na hora — e
"o ICR volta a incluir a pessoa imediatamente" é AC.

### 2.2 A área de membros

Em `members/page.tsx`, uma `Section` nova, **só para `isAdmin`**, depois da equipe:

- Título "Outliers por rodada"; o `hint` diz, em uma frase, que a marca tira as notas daquela pessoa
  **do cálculo daquela rodada**, que ela não altera o acesso e que a ferramenta não avisa o avaliador.
- Seletor de rodada por link, com a rodada em foco em `?round=<id>`; sem parâmetro, a rodada mais
  recente que tem avaliação. Só entram rodadas com ao menos uma avaliação enviada; sem nenhuma, um
  `EmptyState` explicando que a marca depende de existir nota para tirar.
- Um item por avaliador com avaliação enviada naquela rodada (a lista vem de `listEvaluatorEffort`,
  que a Parte 3 vai ajustar — aqui basta consumi-la): nome, quantas avaliações enviou, e:
  - **sem marca**: um `Disclosure` com o form de marcar — `textarea` obrigatório com
    `maxLength={OUTLIER_REASON_MAX}` e um `SubmitButton`;
  - **com marca**: um `Badge` "outlier", a justificativa por extenso numa caixa com rolagem própria
    (`scrollBoxClass`/`preWrapClass`), "marcado por X em DD/MM/AAAA", e o botão de remover, com
    confirmação.
- Um `Disclosure` "Histórico de marcações desta rodada", de `loadOutlierHistory`, mostrando também as
  removidas com as duas datas e os dois autores. É AC (história 47), e é o que torna a exclusão
  auditável na monografia.

Componentes novos em `members/outlier-panel.tsx` (servidor) e `members/outlier-forms.tsx`
(`'use client'`, pelos `useActionState`). Nada de estado local guardando texto de justificativa.

### 2.3 A linguagem de desativação

- `app/projects/actions.ts`: `removeMember` → `deactivateMember` (só o nome; o corpo já faz o certo).
- `member-actions.tsx`: `RemoveMemberButton` → `DeactivateMemberButton`, rótulo "Desativar",
  `pendingText` "Desativando…". O texto de confirmação passa a dizer as três coisas: a pessoa perde o
  acesso, **as avaliações dela continuam gravadas e continuam no cálculo**, e convites pendentes são
  cancelados.
- `member-list.tsx`: atualizar o `import` e o uso; o comentário `HU-021` continua válido.
- `members/page.tsx`: o `hint` da seção da equipe deixa de dizer "remova avaliadores" e passa a dizer
  "desative avaliadores", com a frase que separa as duas coisas: **desativar é sobre acesso, marcar
  outlier é sobre cálculo**, e desativar não tira ninguém do coeficiente. É AC, e é a frase que impede
  a porta dos fundos de existir na cabeça de quem usa.
- `app/projects/actions.int.test.ts`: renomear as chamadas e o título do teste.

### 2.4 Testes da Parte 2

`(tabs)/rounds/outlier-actions.int.test.ts`:

- [ ] **Avaliador barrado**: `markOutlier` e `unmarkOutlier` chamados por um avaliador do projeto não
      escrevem nada e devolvem erro. Idem para quem não é membro.
- [ ] **Justificativa obrigatória**: `''`, `'   '` e texto acima do teto são recusados e **nada** é
      gravado.
- [ ] **Marcar grava autor e data**, e a justificativa gravada é a versão com trim.
- [ ] **Só se marca quem avaliou naquela rodada**: vínculo sem avaliação na rodada é recusado.
- [ ] **Rodada de outro projeto é recusada**, e vínculo de outro projeto também.
- [ ] **Desmarcar grava autor e data e preserva a linha**; desmarcar duas vezes devolve erro na
      segunda, sem mexer no registro da primeira.
- [ ] **Marcar duas vezes** a mesma pessoa na mesma rodada é recusado com a mensagem de corrida.
- [ ] `deactivateMember` continua com o comportamento que `removeMember` tinha (o teste renomeado
      passa sem mudança de asserção).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. É possível marcar e desmarcar pela tela, com
o Supabase local e `/dev/login`. O ICR ainda **não** mudou na tela — isso é a Parte 3, e é esperado.

### O que a Parte 3 herda

**`(tabs)/rounds/outlier-actions.ts`** — assinaturas como no § 2.1, sem desvio:

```ts
type OutlierState = { error: string } | { ok: true; nonce: number } | null
markOutlier(prev: OutlierState, formData: FormData): Promise<OutlierState>
unmarkOutlier(prev: OutlierState, formData: FormData): Promise<OutlierState>
```

`markOutlier` lê `project_id`, `round_id`, `project_member_id`, `reason`; `unmarkOutlier` lê
`project_id`, `round_id`, `mark_id`. As duas revalidam os quatro caminhos do § 2.1 e **não** escrevem
em `notifications`. `unmarkOutlier` confere que a rodada é do projeto antes do `update` — sem isso um
Administrador do projeto A removeria marca do projeto B só informando o par (`project_id` dele,
`round_id` alheio), porque `isProjectAdmin` só olha o `project_id` do form.

**Divergência do § 2.2 — uma leitura nova.** O seletor de rodada precisava da lista de rodadas "com
ao menos uma avaliação enviada", que não existia. Ficou em `(tabs)/rounds/rounds.ts`, ao lado de
`listRounds`, e não em `outliers.ts` (é listagem de rodada, não leitura de marca):

```ts
type EvaluatedRound = { id: string; roundNumber: number; status: string }
listRoundsWithEvaluations(projectId: string, db: DbExecutor = ownerDb): Promise<EvaluatedRound[]>
```

`selectDistinct` com `innerJoin` em `evaluations`, ordenado por `roundNumber` **desc** — é essa ordem
que faz "sem `?round=`, a rodada mais recente com avaliação" ser só `rounds[0]`.

**`listEvaluatorEffort` não precisou de nada nesta Parte** — continua com a assinatura e o filtro
`status = 'active'` da #62. O painel consome e filtra `submitted > 0` na tela. Consequência a
resolver no § 3.4: **o avaliador desativado ainda não aparece no painel de outliers**, mesmo tendo
avaliado a rodada, então hoje não há como marcá-lo. Quando o filtro virar "ativo **ou** com avaliação
nesta rodada", ele passa a aparecer sem nenhuma mudança no painel.

**Componentes de `members/`:**

```ts
// members/outlier-panel.tsx (servidor)
type OutlierPanelData = {
  rounds: EvaluatedRound[]; round: EvaluatedRound | null
  effort: EvaluatorEffort[]; marks: OutlierMark[]; history: OutlierMark[]
}
OutlierPanel(props: { projectId: string } & OutlierPanelData)

// members/outlier-forms.tsx ('use client')
MarkOutlierForm({ projectId, roundId, projectMemberId, evaluatorName, roundNumber })
UnmarkOutlierForm({ projectId, roundId, markId, evaluatorName, roundNumber })
```

`loadOutlierPanel` (em `members/page.tsx`) monta o `OutlierPanelData` inteiro **dentro da transação
que a página já abria**, e só quando `isAdmin` — fora dele o painel recebe `EMPTY_OUTLIERS` e a
`Section` nem existe. Sem estado local: a rodada em foco é `?round=<id>` e a justificativa é um
`textarea` não controlado.

**`members/page.tsx` ganhou `searchParams: Promise<{ round?: string }>`**, e por isso o `render()` do
`members/page.int.test.ts` passa `searchParams: Promise.resolve({})`. Quem renderizar essa página em
teste daqui para frente precisa passar os dois.

**Renomes do § 2.3, todos aplicados:** `removeMember` → `deactivateMember`
(`app/projects/actions.ts`), `RemoveMemberButton` → `DeactivateMemberButton`
(`[id]/member-actions.tsx`, usado em `member-list.tsx`), rótulo "Desativar" e `pendingText`
"Desativando…". O `confirm` passou a dizer as três coisas (acesso, avaliações preservadas **e no
cálculo**, convites cancelados) e aponta a outra porta: marcar outlier na rodada. O `hint` da seção
da equipe diz a mesma separação. O teste renomeado passou sem mudar nenhuma asserção.

**Testes:** `(tabs)/rounds/outlier-actions.int.test.ts`, 9 casos, os oito do § 2.4 mais "depois de
desmarcar, dá para marcar de novo na mesma rodada" (a prova pela action do que a Parte 1 provou pelo
índice parcial). Gotcha: as actions commitam, então as fixtures vão por `ownerDb` + `cleanup()`, e
não por `inRollbackTx`.

**Conferido na tela** com Supabase local e `/dev/login`: marcar grava com trim e a página já volta com
a marca; desmarcar devolve a pessoa ao estado "marcar" e a linha vira "marca removida" no histórico,
com os dois autores e as duas datas. O ICR ainda **não** mudou na tela — é a Parte 3.

---

# Parte 3 — O ICR com todos e sem os outliers, lado a lado

**Objetivo:** o par de valores na tela do Administrador, com o valor com todos nunca escondido, e a
lista de esforço contando a verdade sobre quem entrou no cálculo.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, os dois "o que herda" anteriores,
`lib/agreement.ts`, `(tabs)/rounds/agreement.ts`, `agreement-labels.ts`, `agreement-panel.tsx`,
`agreement-series.ts`, `round-list.tsx` e `(tabs)/page.tsx`.

### 3.1 `(tabs)/rounds/agreement-pair.ts` (puro)

```ts
export type AgreementPair = {
  all: Agreement
  withoutOutliers: Agreement | null
  excluded: number
}

export function agreementPair(
  observations: readonly RoundObservation[],
  excluded: ReadonlySet<string>,
): AgreementPair
```

- `all` é sempre `ordinalAlpha(observations)`.
- `withoutOutliers` é `null` quando `excluded.size === 0`; senão é `ordinalAlpha` sobre as
  observações cujo `projectMemberId` não está em `excluded`.
- `excluded` (número) é `excluded.size`, para a tela dizer quantos saíram sem receber a lista.
- Pode acontecer de o valor filtrado ser **não calculável** (sobrou um avaliador só). Isso não é erro
  e não esconde nada: `Agreement` já sabe dizer o motivo, e a tela mostra o motivo ao lado do valor
  com todos, que continua lá. É o caso que o AC mais protege.
- Sem React, sem `@/lib/db`. Recebe o conjunto pronto; quem lê banco é `outliers.ts`.

### 3.2 `agreement-labels.ts`

```ts
export const AGREEMENT_ALL_LABEL = 'com todos'
export const AGREEMENT_WITHOUT_OUTLIERS_LABEL = 'sem os marcados como outlier'
export const OUTLIER_PAIR_HINT: string
export const MATRIX_SCOPE_NOTE: string
```

`OUTLIER_PAIR_HINT` é a frase que aparece junto do par: os dois valores são do mesmo dado, o segundo
retira as notas de quem foi marcado, e o primeiro continua sendo o resultado da rodada. Montada a
partir das próprias constantes, no espírito de `BAND_REFERENCE` e `MATRIX_LEGEND`.
`MATRIX_SCOPE_NOTE` é a frase que diz que a matriz por célula é **com todos** (§ 3).

### 3.3 As telas

- **`agreement-panel.tsx`**: `AgreementPanel` passa a receber `pair: AgreementPair` e
  `outliers: OutlierMark[]`. Com `withoutOutliers` nulo, renderiza exatamente o que renderiza hoje.
  Com o par, renderiza **dois** `StatCard` lado a lado — o com todos primeiro, sempre —, o
  `OUTLIER_PAIR_HINT` embaixo e a lista de quem saiu, cada um com a justificativa acessível (mesma
  caixa com rolagem da área de membros). O `smallSampleWarning` é calculado sobre o valor **com
  todos**; se o filtrado cair abaixo do corte, ele ganha o seu próprio aviso.
- **`AgreementValue`** (usada na lista de rodadas): passa a receber o par e, quando há exclusão,
  mostra os dois valores na mesma linha, com os rótulos curtos.
- **`agreement-series.ts`**: `SeriesPoint` ganha `hasOutlier: boolean`; `agreementSeries` recebe
  também o `Map` de `loadProjectOutliers`. A **coluna continua sendo a do valor com todos** (§ 3).
- **`agreement-series-chart.tsx`**: marca discreta nos pontos com `hasOutlier`, com `title`
  explicando, e uma linha na legenda. O link para a rodada já existe.
- **`agreement-matrix-table.tsx`**: acrescentar `MATRIX_SCOPE_NOTE` à legenda. Nada mais.
- **`(tabs)/rounds/page.tsx`** e **`(tabs)/page.tsx`**: carregar `loadProjectOutliers` na mesma
  transação que já carrega `loadProjectObservations` e passar adiante.

### 3.4 `listEvaluatorEffort` conta quem entrou no cálculo

Trocar o filtro `status = 'active'` por "ativo **ou** com avaliação enviada nesta rodada", e devolver
`status` junto. A lista passa a marcar o desativado como desativado e o marcado como outlier — e a
soma das linhas volta a bater com os avaliadores do coeficiente. `listEvaluatorsNotFinished`, que é o
denominador do progresso e alimenta o diálogo de fechar rodada, **não muda**: lá o desativado sai
mesmo, que é o AC.

### 3.5 Testes da Parte 3

`agreement-pair.unit.test.ts`:

- [ ] **Sem exclusão, `withoutOutliers` é `null`** e `all` é o mesmo valor de antes.
- [ ] **Com exclusão, os dois existem** e `all` é idêntico ao valor sem filtro nenhum — a asserção
      que prova que o valor com todos não foi substituído.
- [ ] **Excluir todo mundo menos um** dá `withoutOutliers` não calculável com `few_evaluators`, e
      `all` intacto.
- [ ] **Excluir um id que não avaliou** não muda `withoutOutliers` em relação a `all` (mas o par
      continua existindo, porque há marca).

`(tabs)/rounds/agreement.int.test.ts` (ou arquivo novo de integração desta fatia):

- [ ] **Marcar afeta o cálculo daquela rodada e só dela**: duas rodadas com as mesmas pessoas; marcar
      na rodada 2 muda o par da 2 e deixa o da 1 sem par nenhum.
- [ ] **Desmarcar restaura**: depois de `unmarkOutlier`, `withoutOutliers` volta a `null` e `all`
      nunca mudou em nenhum dos passos.
- [ ] **Desativar um membro não altera o coeficiente** e **tira do denominador do progresso**: com o
      vínculo `inactive`, `ordinalAlpha` da rodada dá exatamente o mesmo número, o nome some de
      `listEvaluatorsNotFinished` e **continua** em `listEvaluatorEffort` com `status` desativado.

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes. Na tela: rodada sem marca mostra um valor só;
com marca mostra dois, o com todos primeiro, com quem saiu e por quê.

### O que a Parte 4 herda

**`(tabs)/rounds/agreement-pair.ts`** — o tipo do § 3.1 saiu sem desvio, com **duas funções puras a
mais** que a tela precisava e que não cabiam na página:

```ts
type AgreementPair = { all: Agreement; withoutOutliers: Agreement | null; excluded: number }
agreementPair(observations: readonly RoundObservation[], excluded: ReadonlySet<string>): AgreementPair
withoutExcluded(observations: readonly RoundObservation[], excluded: ReadonlySet<string>): RoundObservation[]
evaluatedResponses(observations: readonly RoundObservation[]): number
```

`withoutExcluded` é o filtro que `agreementPair` usa por dentro, exportado porque a página precisa do
**mesmo** recorte para contar as respostas do lado filtrado; `evaluatedResponses` é a contagem de
`responseId` distinto que antes estava inline em `rounds/page.tsx`. Nenhuma das duas lê banco, e
`lib/agreement.ts` continua intocado — a exclusão é filtro na entrada, como manda o § 4.

**`listEvaluatorEffort` (`(tabs)/rounds/agreement.ts`)** — mesma assinatura, duas mudanças no corpo:

```ts
type EvaluatorEffort = { projectMemberId: string; name: string; status: string; submitted: number }
```

O `where` perdeu `status = 'active'` e ganhou `.having(or(eq(status,'active'), gt(count(evaluations.id), 0)))`
sobre o `leftJoin` que já existia — "ativo **ou** com avaliação nesta rodada". `status` entrou no
`select` e no `groupBy`. `listEvaluatorsNotFinished` **não** mudou. Consequência já visível: o
avaliador desativado que avaliou a rodada aparece no painel de outliers da área de membros e pode ser
marcado, o que a Parte 2 tinha deixado pendente.

**Painel e valor (`agreement-panel.tsx`)** — `AgreementPanel` trocou `agreement` por `pair` e ganhou
`outliers`; `responses` deixou de ser `number` e virou um par, porque o aviso de amostra pequena do
lado filtrado precisa da contagem do lado filtrado:

```ts
type ResponseCounts = { all: number; withoutOutliers: number }
AgreementPanel(props: { pair: AgreementPair; responses: ResponseCounts;
                        effort: EvaluatorEffort[]; outliers: OutlierMark[] })
AgreementValue(props: { pair: AgreementPair })
```

Sem par, o painel renderiza exatamente o que renderizava. Com par: dois `StatCard` em
`sm:grid-cols-2` (o com todos **primeiro**), o `OUTLIER_PAIR_HINT` embaixo, e um `Disclosure` "Quem
saiu do cálculo e por quê (N)" com nome, autor, data e a justificativa em caixa com rolagem. Os
avisos de amostra pequena viraram uma lista: quando há par, cada um vem prefixado pelo rótulo do seu
lado (`com todos — …`, `sem os marcados como outlier — …`). `EffortList` recebe o conjunto de
excluídos e marca cada linha com `Badge` "outlier" e/ou "desativado", com uma frase embaixo quando há
desativado na lista. `BAND_REFERENCE` aparece só no card com todos; o segundo card leva o N, a
contagem de respostas, quantos ficaram fora e — se for o caso — o motivo de não calculável.

**`agreement-labels.ts`** — as quatro constantes do § 3.2, sem desvio: `AGREEMENT_ALL_LABEL`
(`'com todos'`), `AGREEMENT_WITHOUT_OUTLIERS_LABEL` (`'sem os marcados como outlier'`),
`OUTLIER_PAIR_HINT` e `MATRIX_SCOPE_NOTE`. As duas frases são montadas a partir dos dois rótulos.

**Série (`agreement-series.ts` / `-chart.tsx`)** — `SeriesPoint` ganhou `hasOutlier: boolean` e
`agreementSeries` ganhou um **terceiro parâmetro com default**, para as chamadas e os testes antigos
continuarem válidos:

```ts
agreementSeries(rounds, observations, outliers: ReadonlyMap<string, ReadonlySet<string>> = new Map()): SeriesPoint[]
```

O ponto continua carregando **só** o valor com todos (`agreement: Agreement`), e por isso o chart
monta o par literal `{ all: point.agreement, withoutOutliers: null, excluded: 0 }` ao chamar
`AgreementValue` — é a forma de dizer, no código, que a série não desenha o filtrado. A marca é um
retângulo `fill-warning-fg` acima da coluna, com `<title>`, mais um `Badge` "com exclusão" no item da
lista e um parágrafo de legenda que só aparece quando alguma rodada tem exclusão.

**Lista de rodadas e matriz** — `RoundList` passou a receber `agreement: Map<string, AgreementPair>`
(era `Map<string, Agreement>`), e é aí que o par aparece por extenso, na mesma linha, com os rótulos
curtos. `AgreementMatrixTable` só ganhou o `MATRIX_SCOPE_NOTE` na legenda; o cálculo por célula não
mudou.

**Páginas** — `(tabs)/rounds/page.tsx` carrega `loadProjectOutliers` (par de toda rodada, para a
lista) e `loadRoundOutliers` da rodada em foco (para o painel) na transação que já existia, só quando
`isAdmin`; `(tabs)/page.tsx` carrega `loadProjectOutliers` junto de `loadProjectObservations` e passa
para a série. As duas usam uma constante `EMPTY_SET` para o caso sem marca.

**Testes:** `agreement-pair.unit.test.ts` (6 casos, os quatro do § 3.5 mais os dois helpers novos),
`agreement-outliers.int.test.ts` (5 casos: recorte por rodada, desmarcar restaura, desativar não mexe
no coeficiente, quem saiu do esforço, e marcado-e-desativado ao mesmo tempo), mais 2 casos novos em
`agreement-series.unit.test.ts` e 3 em `rounds/page.int.test.ts`. `npm test` verde, 805 testes.
Gotcha herdado da Parte 2: `agreement-outliers.int.test.ts` usa as actions, que commitam, então vai
de `ownerDb` + `cleanup()`.

**Testes existentes que mudaram de forma** (quem escrever teste novo precisa saber): `panelOf(tree).agreement`
virou `panelOf(tree).pair.all`, `props.responses` virou `{ all, withoutOutliers }`, `list.agreement.get(id)`
devolve um `AgreementPair`, e toda asserção sobre `listEvaluatorEffort` precisa do campo `status`.

**Conferido na tela** com Supabase local e `/dev/login`, numa cena de duas rodadas com Ana, Bruno
(desativado) e Carla (marcada na rodada 2): a rodada 2 mostra os dois cards (`-0,117` questionável com
todos, `1,000` boa sem os marcados), a justificativa de Carla no `Disclosure`, o aviso de amostra
pequena só do lado filtrado, a lista de esforço com "desativado" e "outlier", a nota de escopo da
matriz, e a rodada 1 — cuja marca foi removida — com um valor só. Na visão geral, a rodada 2 aparece
com a marca na coluna e o `Badge` "com exclusão". A cena foi apagada do banco depois (`scores`
vazia), como manda o histórico deste projeto.

---

# Parte 4 — A revisão identifica o outlier, e o glossário fecha

**Objetivo:** na revisão de discordâncias, a nota de quem está marcado aparece identificada — **para
o Administrador**. E a documentação de domínio para de descrever a exigência que a ADR 0008 já
retirou.

**Ler antes:** `AGENTS.md`, as seções 1 a 4 deste plano, os "o que herda" anteriores,
`(tabs)/rounds/[roundId]/page.tsx`, `review.ts`, `review-groups.ts`, `review-groups-list.tsx` e a
ADR 0011.

### 4.1 A nota sabe se é de um marcado

- `ReviewNote` ganha `isOutlier: boolean` e `outlierReason: string | null`.
- Quem preenche é a **página**, e só no ramo de Administrador: carrega `loadRoundOutliers(round.id)`
  apenas quando `access.isAdmin`, e mapeia as notas. No ramo do Avaliador o conjunto nasce vazio, e a
  marca simplesmente não existe naquele render — a invisibilidade é estrutural, como o coeficiente na
  #64.
- `reviewGroups` **não muda de lógica**: a marca viaja com a nota e não entra na classificação de
  divergência. A célula continua divergindo pelo que as pessoas escreveram, não por quem escreveu.
- `review-groups-list.tsx`: ao lado do nome, um `Badge` "outlier" com `title` dizendo que as notas
  dessa pessoa estão fora do cálculo desta rodada e por quê. A nota continua com o mesmo peso visual
  das outras: esconder ou apagar a nota de quem destoou removeria o material da conversa, que é
  exatamente o que a ADR 0011 recusa.

### 4.2 Por que o Avaliador não vê a marca

Registrar em comentário curto no ponto onde a página decide carregar (ou não) as marcas — em duas
linhas, porque é a decisão mais fácil de reverter por engano na próxima fatia: o AC diz que a
ferramenta **não notifica** o avaliador, e um `Badge` visível para todos na revisão é notificação com
outro nome.

### 4.3 O glossário

`docs/CONTEXT.md`, verbete **Administrador-avaliador**, ainda diz que "os painéis de concordância
precisam conseguir separá-lo dos demais avaliadores". Essa exigência saiu na emenda de 2026-09-02 da
ADR 0008 e foi substituída pela marca de outlier, que esta fatia acabou de construir. Reescrever a
última frase do verbete para apontar o mecanismo: o Administrador-avaliador continua sendo fonte
conhecida de viés, e o instrumento para tratá-lo é marcar a si mesmo como outlier na rodada, de forma
declarada e justificada.

O verbete **Outlier** já descreve o que foi construído e não precisa mudar. Conferir palavra por
palavra contra o que ficou no código — se divergir, o código é que está errado, ou a decisão mudou e
merece emenda escrita.

### 4.4 Testes da Parte 4

`(tabs)/rounds/[roundId]/page.int.test.ts`:

- [ ] **O Administrador vê a marca**: a nota de quem está marcado volta com `isOutlier` verdadeiro e
      com a justificativa.
- [ ] **O Avaliador não vê marca nenhuma** na mesma rodada, com o mesmo dado no banco.
- [ ] **A nota do marcado continua aparecendo** para os dois, com valor e justificativa — não some, não
      muda de lugar e não deixa de contar como divergência na célula.

### 4.5 Varredura dos ACs

Antes de fechar, passar a lista do issue item a item contra o que existe, e anotar no comentário de
fechamento da issue o número do commit de cada Parte. Os dois que costumam passar despercebidos:
**"a ferramenta não notifica o avaliador"** (conferir que nenhuma das duas actions escreve em
`notifications`) e **"o valor com todos nunca é escondido nem substituído"** (conferir nas quatro
telas: painel da rodada, lista de rodadas, série e matriz).

### Pronto quando

`npm run lint`, `npm run typecheck` e `npm test` verdes, e os doze ACs do issue conferidos um a um.

---

## 5. Fica para depois (registrar, não construir)

- **Par de valores na matriz por célula.** Barato depois que `agreementPair` existe, e hoje seria
  ruído numa tabela que já é densa.
- **Duas séries na visão geral.** Depende de decidir o que uma série filtrada significa quando cada
  rodada tem um conjunto diferente de excluídos — é decisão de método, não de tela, e merece ADR se
  alguém quiser.
- **Marca de outlier na exportação CSV**, que é da #67 e já tem a leitura pronta.
- **Anonimização dos nomes na revisão**, já registrada como funcionalidade futura no glossário.

## 6. Deploy

A migration da Parte 1 precisa de `db push` em prod junto do deploy desta fatia. Sem isso, a tela de
membros quebra em produção na primeira leitura de `round_outliers`, e o projeto já acumulou atraso de
schema em prod duas vezes por este mesmo caminho.
