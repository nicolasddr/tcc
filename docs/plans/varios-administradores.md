# Plano de implementação — Vários Administradores por projeto

Pedido: "Quero poder dar acesso de administrador a outros membros que estejam no projeto."
Sem issue aberta ainda. Se virar issue, a última Parte leva `Closes #N` no commit.

**A executar em 3 partes, uma por chat.** As seções 1 a 6 são o contexto comum: quem pegar qualquer
Parte lê `AGENTS.md`, estas seis seções e só então a sua Parte. Cada Parte termina com "o que a
seguinte herda", e é ali que se anota o que divergiu.

| Parte | Entrega | Estado |
|---|---|---|
| 1 | ADR 0014 e glossário; regras puras de promoção e remoção (`admin-role.ts`); `groupMembers` passa a listar só papéis ativos | |
| 2 | Actions `grantAdminRole` e `revokeAdminRole`, trava do último administrador, guarda do convite para administrador promovido, testes de integração | |
| 3 | A tela: botões e confirmações na lista de membros, textos que falam em "o administrador" no singular, navegador e varredura dos critérios | |

**Decisões confirmadas em 2026-10-19:** D1, D2, D4 e D6 ficaram com a recomendação (sem dono
protegido, sem notificação, promoção permitida com aviso de ICR). Nenhuma ⚠ pendente.

**Sem migration.** O schema já comporta vários administradores: o vínculo é uma linha por
(projeto, usuário, papel) (`pm_unique_role`), e nada no banco limita a uma linha de administrador por
projeto. A linha de administrador já é isenta de consentimento e onboarding (`pm_consent_required`,
`pm_onboarding_done`). A D4 ficou sem notificação, então a fatia toda segue sem migration.

---

## 1. Ponto de partida

| Peça existente | Onde | Papel nesta fatia |
|---|---|---|
| Predicado de administrador | `lib/authz.ts` (`isProjectAdmin`) | já checa "existe linha ativa de administrador", então funciona para N administradores sem mudar |
| Checagens espalhadas de admin | `pipeline/access.ts`, `(tabs)/layout.tsx`, `(tabs)/page.tsx`, `settings`, `questions`, `profile-answers`, `members/page.tsx` | todas usam `memberships.some(role === 'administrator' && status === 'active')`: funcionam para N sem mudar |
| Autor da ata | `rounds/review-access.ts` (`loadReviewMemberships`) e `consensus-actions.ts` | resolve o vínculo do próprio usuário, não "o" administrador do projeto; a ata já é lista por célula com assinatura (`minutesByline`), então duas atas de dois administradores aparecem lado a lado sem mudar |
| Modelo de regra pura + action | `evaluator-link.ts` (`assumeEvaluatorRefusal`, mensagens) e `actions.ts` (`assumeEvaluatorRole`, `revokeEvaluatorRole`) | **modelo** do módulo novo e das actions novas |
| Desativar avaliador | `actions.ts` (`deactivateMember`), `member-actions.tsx` (`DeactivateMemberButton`) | modelo do botão com `ConfirmDialog`; a regra "não desativa quem é administrador" continua |
| Lista de membros | `members.ts` (`groupMembers`), `member-list.tsx` (`MemberList`) | ganha os botões; `groupMembers` hoje junta papéis de linhas **inativas** também (ver D5) |
| Convite | `actions.ts` (`inviteEvaluator`), `lib/authz.ts` (`findInviteeByEmail`) | a guarda anti-enumeração exige `can_create_projects` de quem convida: administrador promovido sem essa permissão convida "às cegas" (ver D3) |
| Ajuda da equipe | `members/team-help.ts` (`TEAM_MORE`) | ganha um ponto sobre administradores |

`projects.created_by` só é usado para deixar o criador ver a página do projeto mesmo sem vínculo
(`(tabs)/layout.tsx:64`, `(tabs)/page.tsx:241`). Não é um papel de "dono" e esta fatia não cria um.

## 2. Domínio: o que muda no papel

Hoje o glossário diz que **todo usuário com permissão que cria um projeto vira seu Administrador**, e
o código sempre tratou isso como "o" Administrador, embora nada no banco o imponha. Esta fatia torna
explícito que um projeto pode ter vários Administradores, todos com os mesmos poderes, e que a única
porta para virar Administrador além de criar o projeto é ser promovido por outro Administrador.

Promover é **acrescentar** um vínculo, seguindo a ADR 0008: o avaliador promovido mantém a linha de
avaliador e ganha uma linha de administrador, virando Administrador-avaliador. As avaliações dele
continuam presas ao vínculo de avaliador (ADR 0009) e nada nelas muda.

Remover o acesso de administrador é **desativar** a linha de administrador (`status = 'inactive'`),
nunca apagá-la: a ata escrita por ele aponta para esse vínculo com `on delete restrict`
(`consensus_notes_project_member_id_fkey`). Promover de novo reativa a mesma linha, e a pessoa volta a
ser autora das atas que já tinha escrito.

## 3. Decisões

**D1 (confirmada) — Quem pode ser promovido.** Só quem tem vínculo de avaliador **ativo** no projeto. Fica de
fora quem está em onboarding (ainda não aceitou o consentimento, e promover pularia o fluxo), quem foi
desativado e quem só tem convite pendente. Convidar alguém já como administrador fica fora desta
fatia: o convite não tem papel (`project_invitations` não tem coluna `role`) e acrescentá-lo pede
migration e mexe no fluxo de aceite.
*Alternativa:* aceitar também quem está em onboarding. Rejeitada porque a pessoa ganharia acesso total
antes de concluir o próprio onboarding.

**D2 (confirmada) — Quem pode remover o acesso de quem.** Todos os Administradores são iguais: qualquer um remove
o acesso de qualquer outro, inclusive o próprio, inclusive o de quem criou o projeto. A única trava é
que o projeto nunca fica sem Administrador ativo.
*Alternativa:* proteger o criador (`created_by`), que ninguém pode remover. Mais segura para o caso
"orientador cria, aluno é promovido", mas cria um papel de dono que o domínio não tem e que teria de
entrar no glossário. Rejeitada na confirmação.

**D3 — Guarda do convite.** `findInviteeByEmail` passa a resolver o perfil quando quem convida é
administrador ativo **daquele** projeto, além de quem tem `can_create_projects`. Sem isso, um
administrador promovido que não tem a permissão de plataforma cria convites só por e-mail: o
convidado com perfil só vê o convite no próximo login (`provisionUserOnFirstLogin` roda a cada login)
e a checagem "já é membro ativo" é pulada. A guarda anti-enumeração continua valendo para quem não é
administrador do projeto. Muda a assinatura para receber `projectId`.

**D4 (confirmada) — Avisar o promovido.** Recomendação: não notificar nesta fatia. O papel aparece na lista de
membros, no painel e na aba que se abre. Notificar exige migration (o `notifications_type_check` só
aceita `project_invitation` e `permission_decision`), um tipo novo em `lib/notifications` e a
renderização dele na caixa de notificações. Confirmado: sem notificação.

**D5 — Lista mostra só papéis ativos.** `groupMembers` passa a juntar em `roles` só os papéis de
linhas `active` (mantendo o `status` agregado como está). Hoje isso já é um defeito latente (um
Administrador-avaliador que desfez o papel de avaliador some, mas um avaliador desativado com linha de
admin apareceria com os dois rótulos), e com a remoção de administrador vira visível: sem o filtro, o
ex-administrador continuaria rotulado "Administrador". Quem não tem papel ativo nenhum continua
aparecendo com o selo de status, como hoje.

**D6 (confirmada) — Promover um avaliador expõe o ICR a ele (ADR 0011).** O promovido passa a ver o coeficiente,
e pode ainda ter rodada aberta para avaliar. Recomendação: permitir, e dizer isso na confirmação, com
o mesmo remédio da ADR 0008: a marca de outlier. Registrar na ADR 0014.
*Alternativa:* recusar a promoção enquanto o avaliador tiver rodada aberta sem avaliação enviada.
Mais limpo metodologicamente, mas trava a equipe pequena exatamente quando ela precisa de um segundo
administrador, e a pessoa pode simplesmente ser promovida depois de enviar.

**D7 — Concorrência na remoção.** Dois administradores removendo um ao outro ao mesmo tempo podem
deixar o projeto sem ninguém. A action trava as linhas de administrador ativas do projeto
(`select … for update`) antes de contar. Em READ COMMITTED a segunda transação espera, relê, não vê
mais a linha desativada e recusa por "último administrador".

**D8 — Para onde vai quem remove o próprio acesso.** Se ainda tem vínculo de avaliador ativo, fica na
página de membros (agora na visão de avaliador, via `revalidatePath`). Se não tem mais vínculo ativo,
`redirect('/dashboard')`, como `leaveProject`.

## 4. Mensagens (pt-BR, ficam em `admin-role.ts`)

| Constante | Texto |
|---|---|
| `GRANT_DENIED` | Apenas um administrador do projeto pode dar acesso de administrador. |
| `GRANT_NOT_ACTIVE_EVALUATOR` | Só quem participa do projeto como avaliador ativo pode virar administrador. |
| `GRANT_ALREADY_ADMIN` | Essa pessoa já é administradora deste projeto. |
| `REVOKE_ADMIN_DENIED` | Apenas um administrador do projeto pode remover acesso de administrador. |
| `REVOKE_NOT_ADMIN` | Essa pessoa não é administradora deste projeto. |
| `REVOKE_LAST_ADMIN` | O projeto precisa de pelo menos um administrador. Dê acesso a outra pessoa antes de remover este. |

Linhas da confirmação de promover (`grantAdminConfirmationLines(name)`):
- `{name} passa a ter os mesmos poderes que você: editar o codebook e o prompt, abrir e encerrar rodadas, avançar fases, convidar e desativar membros e dar ou remover acesso de administrador.`
- `{name} passa a ver a concordância (ICR) de todas as rodadas. Se ainda for avaliar, considere marcá-la como outlier nas rodadas em que avaliar depois disso.`
- `As avaliações que {name} já enviou não mudam.`

Linhas da confirmação de remover (`revokeAdminConfirmationLines({ name, self, keepsEvaluator })`):
variam entre "Você deixa de…"/"{name} deixa de…" e entre "continua participando como avaliador(a)" e
"perde o acesso ao projeto". A ata já escrita continua visível, assinada.

Conferir cada frase contra o código antes de fechar a Parte 3 (memória "texto de ajuda: conferir no
código").

---

## 5. Testes que já existem e vão ser tocados

- `app/projects/members.unit.test.ts` (`groupMembers`): ganha o caso de papel inativo (D5). O caso
  "une papéis do mesmo usuário numa linha só" continua.
- `app/projects/actions.int.test.ts` (`describe('app/projects/actions — autorização explícita')`):
  ganha os dois blocos novos.
- `lib/authz.int.test.ts`: `findInviteeByEmail` com a assinatura nova (D3). Buscar todas as chamadas
  antes de mudar (`grep -rn findInviteeByEmail`).
- `app/projects/[id]/(tabs)/members/page.int.test.ts`: as props de `MemberList` e o texto de
  `TEAM_MORE` (buscar `toEqual` das props e a frase antiga — memória "grep do texto antigo").
- `test/helpers.ts` não tem `addAdmin`; criar `addActiveAdmin(tx, projectId, userId)` ao lado de
  `addActiveEvaluator`.

## 6. Fora desta fatia

- Convidar já como administrador (D1).
- Notificação de promoção (D4).
- Papel de dono / transferência de posse (D2).
- Registro de quem promoveu quem e quando. A linha tem `joinedAt` e `updatedAt`, o que basta para
  saber quando; se "quem" virar dado de pesquisa, pede coluna e ADR.

---

## Parte 1 — Domínio e regras puras

1. **ADR 0014** — `docs/adr/0014-varios-administradores-por-projeto.md` (status `accepted`). Contexto: o código e o glossário assumiam um só; equipe de TCC tem dois autores e um
   orientador. Decisão: promoção só de avaliador ativo, administradores iguais, trava do último,
   remoção por desativação. Viés: o promovido passa a ver o ICR (ADR 0011), remédio é a marca de
   outlier, como na ADR 0008. Alternativas rejeitadas: dono protegido, convite com papel, papel único com flags (já rejeitado na 0008).
2. **Glossário** (`docs/CONTEXT.md`, seção Papéis): **Administrador de Projeto** ganha "Um projeto pode
   ter vários, todos com os mesmos poderes; além de quem cria, vira Administrador o avaliador ativo
   promovido por outro Administrador. O projeto nunca fica sem nenhum." **Administrador-avaliador**
   ganha "ou Avaliador promovido a Administrador".
3. **(TDD)** `app/projects/admin-role.unit.test.ts` primeiro, vendo o vermelho e lendo cada ×:
   - `grantAdminRefusal({ callerIsAdmin, target })`, onde `target` são as linhas do alvo
     (`MembershipRow[]` de `evaluator-link.ts`): recusa sem admin, alvo sem avaliador ativo
     (inclui onboarding e inativo), alvo já admin ativo; aceita alvo com linha de admin **inativa** e
     avaliador ativo (re-promoção).
   - `revokeAdminRefusal({ callerIsAdmin, targetIsAdmin, activeAdminCount })`: recusa sem admin, alvo
     não admin, `activeAdminCount <= 1`; aceita a si mesmo com outro admin ativo.
   - `revokeAdminOutcome(targetRows)` → `'keeps_evaluator' | 'loses_access'` (D8 e linhas da
     confirmação).
   - As duas funções de linhas da confirmação (seção 4).
4. Implementar `app/projects/admin-role.ts` até ficar verde.
5. **(TDD)** `groupMembers` com papel inativo (D5): teste vermelho em `members.unit.test.ts`, depois o
   filtro.
6. `npm run lint`, `npx tsc --noEmit`, `npx vitest run admin-role members`.

**O que a Parte 2 herda:** nomes exatos das funções e das constantes; a forma de `target`.

Feito em 2026-10-19:
- `app/projects/admin-role.ts` exporta as seis constantes da seção 4, `grantAdminRefusal({ callerIsAdmin, target })`
  com `target: readonly MembershipRow[]` (as linhas do alvo no projeto, em qualquer status),
  `revokeAdminRefusal({ callerIsAdmin, targetIsAdmin, activeAdminCount })`,
  `revokeAdminOutcome(targetRows)` → `RevokeAdminOutcome` (`'keeps_evaluator' | 'loses_access'`),
  `grantAdminConfirmationLines(name)` e `revokeAdminConfirmationLines({ name, self, keepsEvaluator })`.
- Ordem das recusas da promoção: sem admin → `GRANT_DENIED`; alvo já admin ativo →
  `GRANT_ALREADY_ADMIN` (vale também para o criador sem vínculo de avaliador); sem avaliador ativo →
  `GRANT_NOT_ACTIVE_EVALUATOR`.
- `revokeAdminOutcome` só conta avaliador `active`: um Administrador-avaliador com o vínculo de
  avaliador ainda em onboarding cai em `'loses_access'` (redirect para `/dashboard` na D8).
- Linhas da remoção, fechadas: "{Você|name} deixa de editar o codebook e o prompt, …"; "{Você|name}
  continua participando como avaliador(a), sem ver a concordância (ICR)." ou "{Você|name} perde o
  acesso ao projeto."; "As atas que {você|name} já escreveu continuam visíveis, com a assinatura."
  (a ata é sempre `shared`, `consensus-actions.ts`).
- **Divergência na D5.** Filtrar `roles` só por linhas `active` quebra o caso "une papéis do mesmo
  usuário" (admin ativo + avaliador em onboarding), que o plano manda manter, e tiraria "Avaliador" e
  "Ver respostas" de quem foi desativado. Ficou: `roles` exclui as linhas `inactive`; se o usuário
  não tem nenhuma linha vigente, mantém todos os papéis, como hoje. Consequência para a Parte 3: um
  ex-administrador totalmente inativo ainda aparece com "Administrador", então os botões de
  promover/remover precisam checar `status === 'active'` além de `roles`.

## Parte 2 — Actions

1. `addActiveAdmin` em `test/helpers.ts`.
2. **(TDD)** blocos novos em `app/projects/actions.int.test.ts`, vermelhos antes do código:
   - `grantAdminRole`: avaliador ativo vira admin (linha nova `administrator`/`active`, linha de
     avaliador intacta); re-promoção reativa a **mesma** linha (mesmo `id`); recusas da Parte 1 chegam
     como `{ error }`; quem não é admin não muda nada no banco.
   - `revokeAdminRole`: desativa a linha (não apaga); admin com ata escrita pode ser removido e a ata
     continua lá; trava do último; remover a si mesmo com vínculo de avaliador revalida e devolve
     `{ ok }`; sem vínculo, `NEXT_REDIRECT:/dashboard`.
   - D7: duas remoções cruzadas com `Promise.all` em duas transações deixam exatamente um admin
     ativo. Se o teste ficar instável no runner, trocar por um teste que prova o `for update` (segunda
     transação bloqueada) e anotar aqui.
3. Em `actions.ts`, `GrantAdminState`/`RevokeAdminState` (`{ error } | { ok } | null`) e as duas
   actions, no molde de `assumeEvaluatorRole`: `requireUserId`, `project_id` e `member_user_id` do
   `FormData`, tudo dentro de `transaction`, regra pura decide, upsert com
   `onConflictDoUpdate({ target: [projectId, userId, role], set: { status: 'active' } })` na promoção,
   `for update` nas linhas de admin na remoção. `revalidatePath` de `/projects/${id}`,
   `/projects/${id}/members` e `/dashboard`.
4. **(TDD)** D3: caso novo em `lib/authz.int.test.ts` (admin promovido sem `can_create_projects`
   resolve o convidado do próprio projeto; não resolve para outro projeto), depois a mudança em
   `findInviteeByEmail` e na chamada em `inviteEvaluator`.
5. `npm test` com o Supabase local de pé (memória "cena no banco quebra int test": `scores` vazia,
   nenhum outro vitest rodando).

**O que a Parte 3 herda:** assinatura das actions e os campos do `FormData`.

## Parte 3 — Tela

1. `member-actions.tsx`: `GrantAdminButton` e `RevokeAdminButton`, no molde de
   `DeactivateMemberButton` (`ConfirmDialog` + `DialogLines`), com as linhas da Parte 1. Rótulos:
   "Tornar administrador" (secondary) e "Remover administrador" / "Deixar de ser administrador"
   quando é o próprio (danger). Erro da action aparece no diálogo.
2. `member-list.tsx`: `MemberList` recebe `adminCount` (ou calcula pelas `roles`); mostra
   "Tornar administrador" para avaliador ativo sem papel de admin; "Remover…" para quem é admin,
   escondido quando é o único. Ordem dos botões: Ver respostas · Tornar/Remover · Desativar.
   Conferir a 375 px que a linha não estoura (os botões já dividem espaço com o nome; memórias
   "tabela: w-full espreme colunas" e "flex-shrink fracionário").
3. `members/page.tsx`: passa o necessário; a seção "Avaliar neste projeto" continua igual (o promovido
   já tem vínculo de avaliador e cai no estado "você já avalia").
4. Textos no singular que passam a mentir com vários administradores:
   `LeaveProjectButton` ("só o administrador pode readmiti-lo" → "só um administrador"),
   `ASSUME_DENIED`/`REVOKE_DENIED` em `evaluator-link.ts`, `inviteEvaluator`
   ("Apenas o administrador do projeto…"). Rodar `grep -rn "o administrador" app` e decidir caso a
   caso; cada troca puxa o teste que afirma a frase antiga.
5. `TEAM_MORE`: ponto novo, por exemplo "Um projeto pode ter vários administradores, todos com os
   mesmos poderes. Só quem já avalia no projeto pode virar administrador."
6. Testes de página em `members/page.int.test.ts`: admin vê os botões certos por linha; avaliador não
   vê nenhum; único admin não tem "Remover".
7. Navegador (preview, `/dev/login`): promover um avaliador, entrar como ele e ver as abas de
   administrador; remover; remover a si mesmo; tentar remover o último. Conferir a ata de dois
   administradores na revisão de uma rodada encerrada.
8. Varredura: cada decisão da seção 3 tem teste ou verificação; `npm run lint`, `npx tsc --noEmit`,
   `npm test`.
