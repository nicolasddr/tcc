# 04 — Aceitar convite com consentimento e listar membros (HU-020, HU-028 consent, HU-025)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Aceitar um convite materializa a linha em `project_members` com `status = 'pending_onboarding'`
(Opção A, ADR-003 da wiki). O avaliador passa por um onboarding mínimo, que nesta fatia é só o
consentimento: declaração de finalidade e checkbox explícito, registrando `consent_accepted_at` e
`consent_text_snapshot`. Ao concluir, a linha vira `active`. Abandonar o onboarding deleta a linha e
reverte o convite para `pending`. Entra também a listagem de membros do projeto, com nome, e-mail,
papel agregado e status, e os inativos sinalizados. As perguntas de onboarding ficam para a fatia 06.

## Critérios de aceite

- [ ] Aceitar cria membro em `pending_onboarding`, oculto a outros membros e visível ao próprio e ao admin
- [ ] O consentimento registra timestamp e snapshot e promove a `active`
- [ ] Abandonar reverte: deleta a linha e volta o convite a `pending`
- [ ] A lista de membros agrega papéis por usuário, com inativos sinalizados
- [ ] Testes: ciclo de vida da Opção A; CHECK rejeita avaliador `active` sem consentimento; visibilidade do `pending_onboarding`

## Bloqueada por

- 03
