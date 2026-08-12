# 06 — Perguntas de onboarding com múltipla escolha e "Outro" (HU-026/027/028/029)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

O Administrador define perguntas de onboarding do projeto, abertas ou de múltipla escolha com opção
"Outro", no modelo do Google Forms, em que se escolhe uma opção ou se marca "Outro" e escreve. Ele
pode editar, o que mantém as respostas (exibidas com o texto novo), e remover, o que cascateia as
respostas daquela pergunta. O onboarding do avaliador (fatia 04) passa a ter consentimento mais as
perguntas obrigatórias. O Administrador vê as respostas de cada avaliador, em modo somente leitura.

## Critérios de aceite

- [ ] Perguntas abertas e de múltipla escolha (com "Outro") vinculadas ao projeto
- [ ] Todas as perguntas são obrigatórias para concluir o onboarding
- [ ] Editar mantém as respostas; remover cascateia (FK `ON DELETE CASCADE`)
- [ ] As respostas são imutáveis, e o Administrador as visualiza em somente leitura
- [ ] Testes: obrigatoriedade; cascade na remoção; autorização (`isProjectAdmin` define e vê via `canViewResponse`; só o respondente responde, por `canAnswerOnboarding`)

## Bloqueada por

- 04
