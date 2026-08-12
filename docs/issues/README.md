# Issues — Épico 0 (Fundação) e a correção do item 7

Fatias verticais (*tracer bullets*) do Épico 0. O pai é
[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md). Elas não estão publicadas no GitHub:
este é o registro local, pronto para virar issues quando for o caso.

> Camada de dados, depois do flip Drizzle-only
> ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), issue #22): toda leitura e escrita destas
> fatias passa pelo Drizzle (`transaction` sobre `ownerDb`), e o `supabase-js` fica só para
> autenticação. Não há RLS, triggers de negócio nem RPCs `security definer` no banco: a autorização
> vive na camada de aplicação (`lib/authz` mais escopo explícito nas actions e páginas), o
> provisionamento no primeiro login é o `provisionUserOnFirstLogin` (`lib/auth/provision.ts`) e as
> notificações são emitidas em TypeScript (`lib/notifications/invitation.ts`). Onde uma fatia, como
> registro histórico, cita um trigger, uma RPC, uma policy ou o `withUser`, isso descreve a
> implementação SQL original, que o flip substituiu por lógica em TS. Os predicados que espelham as
> antigas policies estão em `lib/authz` (`isProjectAdmin`, `canCreateProjects`,
> `findInviteeByEmail`, `listMyPendingInvitations` e os demais).

| # | Fatia | Status | Bloqueada por |
|---|---|---|---|
| D01 | Fundação: scaffold Next 16, Supabase, Google OAuth, sessão e deploy na Vercel | feito | — |
| D02 | Schema do Épico 0: tabelas do domínio (hoje Drizzle-owned; RLS, triggers e RPCs originais removidos no flip) | feito | D01 |
| D03 | Login com Google (HU-002) | feito | D01, D02 |
| D04 | Logout global (HU-004) | feito | D03 |
| 00 | *(prefactor)* Harness de teste da camada de dados | feito | D02 |
| 01 | Editar nome no perfil (HU-005) | feito | 00 |
| 02 | Criar projeto (com tipo de tarefa) e listar projetos (HU-012, HU-013) | feito | 00 |
| 03 | Convidar avaliador cadastrado, notificação e listar/recusar (HU-018 parcial, HU-010, HU-019) | feito | 00, 02 |
| 04 | Aceitar convite com consentimento e listar membros (HU-020, HU-028, HU-025) | feito | 03 |
| 05 | Correção do item 7: travar `inactive → active` pelo próprio membro | feito | 04 |
| 06 | Perguntas de onboarding com múltipla escolha e "Outro" (HU-026/027/028/029) | feito | 04 |
| 07 | Convite por e-mail pendente até o primeiro login (ADR 0006) | feito, mas a ADR precisa ser ratificada antes do merge | 03 |
| 08 | Permissão de plataforma (HU-007/008/009/011) | a fazer | 00 |
| 09 | Gerenciar projeto: editar, concluir, arquivar e reativar (HU-014 a 017) | feito | 02 |
| 10 | Remover avaliador e sair voluntariamente (HU-021/022) | feito | 04 |

A espinha da Sprint 1 é a sequência 02, 03 e 04.
