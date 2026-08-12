# 02 — Criar projeto (com tipo de tarefa) e listar meus projetos (HU-012, HU-013)

## Pai

[`../prd/epico-0-fundacao.md`](../prd/epico-0-fundacao.md)

## O que construir

Fluxo de criar um projeto e vê-lo na lista. Na criação: nome (obrigatório), descrição (opcional) e
tipo de tarefa opcional (Classificação, Avaliação de qualidade, Geração, Não sei/Misto ou Outro, que
só personaliza tooltips depois, conforme a
[ADR 0005](../adr/0005-ferramenta-agnostica-de-tarefa.md)). Criar exige a permissão
`can_create_projects` (fatia [08](08-permissao-plataforma.md)). O criador vira Administrador ativo,
com a própria action materializando a linha. Depois de criar, redireciona para a página do projeto.

Na lista, no dashboard: os projetos em que o usuário é Administrador ou Avaliador, com nome, papel
agregado e status. Projeto em que o usuário é Avaliador mas ainda não concluiu o onboarding aparece
com o selo "onboarding pendente"; os concluídos têm indicação; os arquivados ficam ocultos por
padrão.

As perguntas de onboarding (fatia [06](06-perguntas-onboarding.md)) são opcionais para o
Administrador definir no projeto, mas quando existem são obrigatórias para o Avaliador concluir ao
entrar (fatia [04](04-aceitar-convite-listar-membros.md)).

No schema: adicionar campo de tipo de tarefa (nullable) em `projects`.

## Critérios de aceite

- [ ] Criar exige `can_create_projects` (predicado `canCreateProjects` de `lib/authz`), e o criador vira Administrador ativo
- [ ] Nome obrigatório, descrição e tipo de tarefa opcionais, com o tipo sendo salvo
- [ ] A lista mostra nome, papel agregado e status, com selo de "onboarding pendente" e arquivados ocultos
- [ ] Testes: criar materializa o Administrador; não-membro não vê o projeto; papéis agregados por usuário

## Bloqueada por

- 00

> Para demonstrar antes da fatia 08, setar `can_create_projects = true` via SQL no usuário de teste.

> Camada de dados ([ADR 0007](../adr/0007-migracao-para-drizzle-orm.md), Drizzle-only): a Server
> Action `createProject` checa `canCreateProjects(userId)` (`lib/authz`) e então, dentro de um
> `transaction`, insere o projeto e materializa o criador como Administrador ativo com
> `onConflictDoNothing` (o antigo trigger `auto_add_creator_as_admin` virou este INSERT explícito).
> O `redirect` e o `revalidatePath` ficam fora do `transaction`.
