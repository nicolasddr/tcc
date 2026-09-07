# Reorganizar a navegação do projeto: uma tela por artefato (Layout A)

## Contexto

Hoje a navegação do projeto tem dois problemas que vão piorar quando o Épico 2 entrar:

1. **A palavra "configuração" nomeia três coisas.** O chip `Configurações` no cabeçalho leva a
   `/projects/[id]/settings` (nome, descrição, status, perguntas de onboarding). A aba
   `Configuração`, poucos pixels abaixo, leva a `/projects/[id]/pipeline` ("Configuração do
   pipeline": definições, prompt, itens, teste). E a Fase 1 chama-se "Configuração inicial".
2. **`/pipeline` é um rolo único** com seis blocos pesados: checklist de avanço, editor de
   definições, editor de prompt, dados da versão do prompt, editor de itens e teste do prompt. O
   Épico 2 despeja na mesma tela a descrição das definições, os critérios por definição, os
   critérios gerais e o contador de notas por resposta.

Em paralelo, a Visão geral está vazia — dois dos três `StatCard` são "em breve" e o painel de
Codebook não tem conteúdo — enquanto todo o trabalho real está escondido atrás de uma aba.

Foram desenhados três layouts alternativos e o escolhido foi o **Layout A: uma aba por artefato**.

## Escopo

Só reorganização de navegação e layout, **com as funcionalidades que já existem**. Nada de
funcionalidade nova do Épico 2 (critérios, rodadas, ICR, avaliação) entra aqui — este trabalho é o
que abre espaço para elas.

## Resultado esperado

### Abas do projeto (`app/projects/[id]/project-tabs.tsx`)

`Visão geral · Codebook · Prompt · Itens · Rodadas (em breve) · Membros`

As abas desabilitadas de hoje (`Iterações`, `Codebook`, `Avaliações`, `Histórico`) saem: o
vocabulário passa a ser o do Épico 2. `Rodadas` fica desabilitada com o `hint` de "ainda não
implementado", ocupando o lugar do que vem a seguir.

### Rotas

| Rota | Conteúdo | Origem |
|---|---|---|
| `/projects/[id]` | Visão geral: painel de estado | já existe, ganha o checklist |
| `/projects/[id]/codebook` | Editor de definições + histórico de versões | bloco "Definições" de `/pipeline` + `/pipeline/codebook` |
| `/projects/[id]/prompt` | Editor + dados da versão + testar o prompt + histórico | blocos "Prompt", "Dados desta versão", "Testar o prompt" de `/pipeline` + `/pipeline/prompt` |
| `/projects/[id]/items` | Itens de entrada | bloco "Itens de entrada" de `/pipeline` |
| `/projects/[id]/settings` | Ajustes do projeto | já existe, absorve o link de Membros |
| `/projects/[id]/members` | Membros | já existe, sem mudança |
| `/projects/[id]/pipeline` | **deixa de existir** | redireciona para `/projects/[id]` |

As rotas ficam em inglês, como as que já existem (`settings`, `members`, `questions`,
`profile-answers`). As páginas de versão (`/pipeline/codebook/[versionId]` e
`/pipeline/prompt/[versionId]`) acompanham o artefato: `/codebook/[versionId]` e
`/prompt/[versionId]`.

Cada página nova reusa `loadPipelineAccess` / `requirePipelineAdmin` de
`app/projects/[id]/pipeline/access.ts` — o gate de administrador não muda.

### Nomenclatura

- O chip `Configurações` no cabeçalho vira **`Ajustes`**.
- O título de `/settings` vira **"Ajustes do projeto"**.
- A palavra "configuração" some da navegação e volta a significar só a Fase 1.
- `missingInputsMessage` em `pipeline/preconditions.ts` diz "Cadastre o que falta na configuração da
  Fase 1" — reescrever para apontar a tela certa agora que são três.

### Visão geral (`app/projects/[id]/page.tsx`)

- `PhaseBar` continua no topo, com o botão de avançar fase.
- **O checklist de avanço vem para cá** (`PipelineChecklist`, hoje no topo de `/pipeline`). É estado
  do projeto, não um campo a preencher. Os links "Resolver" deixam de ser âncoras `#definicoes` e
  passam a apontar para a tela do artefato (`/codebook`, `/prompt`, `/items`) — o campo `anchor` de
  `PipelineRequirement` vira algo como `href`.
- Os `StatCard` "em breve" (Concordância, Avaliações) saem. Fica o de Avaliadores; entram resumos com
  dado real que já existe: versão vigente do codebook com a contagem de definições, versão vigente
  do prompt, total de itens.
- O `Panel` "Codebook" vazio some — vira o resumo acima, com link para `/codebook`.
- O link de Membros continua acessível pelo cabeçalho e passa a existir também como aba.

### Ajustes (`/settings`)

Recebe o que é administração do projeto: nome/descrição/status (`ManageProject`), perguntas de
onboarding e um ponteiro para Membros. Nada de artefato.

## Como fatiar

Um commit por passo, cada um verde:

1. **Nomenclatura, sem mover arquivo**: chip `Configurações` → `Ajustes`, título de `/settings` →
   "Ajustes do projeto".
2. **`ProjectTabs`**: novo conjunto de abas, apontando para as rotas novas (que ainda não existem —
   fazer junto do passo que criar cada uma, ou criar as páginas primeiro e ligar as abas por último).
3. **`/codebook`**: mover o bloco "Definições" e o histórico. `/pipeline/codebook` e
   `/pipeline/codebook/[versionId]` acompanham.
4. **`/prompt`**: mover "Prompt", "Dados desta versão do prompt" e "Testar o prompt". O histórico
   acompanha.
5. **`/items`**: mover "Itens de entrada".
6. **Checklist para a Visão geral**, trocando âncora por rota, e `/pipeline` vira redirect.
7. **Limpeza**: `ProjectTab` type, `PHASE_1` importado em `page.tsx`, o link
   `/pipeline#avancar` do botão "Avançar fase", e a mensagem de `missingInputsMessage`.

## Testes

- `app/projects/[id]/pipeline/page.int.test.ts`, `pipeline/prompt/page.int.test.ts`,
  `pipeline/codebook/page.int.test.ts` e `pipeline/actions.int.test.ts` acompanham as páginas que
  cobrem. O gate de administrador precisa continuar coberto **em cada rota nova**.
- `app/projects/[id]/page.int.test.ts` ganha a cobertura do checklist que chegou.
- Conferir a suíte Playwright em `e2e/` por seletores ou URLs que citem `/pipeline`.
- `npm test` e o lint/typecheck do CI verdes no fim de cada passo.

## Fora de escopo

- Qualquer funcionalidade do Épico 2 (descrição de definição, critérios, critérios gerais, contador
  de notas, rodadas, geração de respostas, tela do avaliador, ICR, outliers, discordâncias).
- Barra lateral (Layout C) e painel de passos por fase (Layout B) — foram avaliados e descartados
  para este momento; a migração de A para C depois é trocar a barra de abas pela lateral, com as
  mesmas rotas.
