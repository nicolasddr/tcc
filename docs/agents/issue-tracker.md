# Issue tracker: GitHub

Issues e specs deste repositório vivem como GitHub issues. Use a CLI `gh` para todas as operações.

## Convenções

- **Criar uma issue**: `gh issue create --title "..." --body "..."`. Use heredoc para bodies multi-linha.
- **Ler uma issue**: `gh issue view <number> --comments`, filtrando comments com `jq` e também buscando labels.
- **Listar issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` com filtros `--label` e `--state` apropriados.
- **Comentar em uma issue**: `gh issue comment <number> --body "..."`
- **Aplicar / remover labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Fechar**: `gh issue close <number> --comment "..."`

O repositório é inferido de `git remote -v` — o `gh` faz isso automaticamente quando executado dentro de um clone.

## Pull requests como superfície de triagem

**PRs como superfície de solicitação: não.** _(Ajuste para `sim` se este repo tratar PRs externos como pedidos de feature; `/triage` lê essa flag.)_

Quando definido como `sim`, PRs passam pelas mesmas labels e estados das issues, usando os equivalentes `gh pr`:

- **Ler um PR**: `gh pr view <number> --comments` e `gh pr diff <number>` para o diff.
- **Listar PRs externos para triagem**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` mantendo apenas `authorAssociation` de `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, ou `NONE` (descartar `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comentar / etiquetar / fechar**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

O GitHub compartilha um único espaço de números entre issues e PRs, então um `#42` isolado pode ser qualquer um dos dois — resolva com `gh pr view 42` e caia para `gh issue view 42` se falhar.

## Quando um skill disser "publish to the issue tracker"

Criar uma GitHub issue.

## Quando um skill disser "fetch the relevant ticket"

Rodar `gh issue view <number> --comments`.

## Operações de wayfinding

Usadas pelo `/wayfinder`. O **map** é uma issue única com issues **filhas** como tickets.

- **Map**: uma issue única com label `wayfinder:map`, contendo o corpo de Notes / Decisions-so-far / Fog. `gh issue create --label wayfinder:map`.
- **Child ticket**: uma issue linkada ao map como GitHub sub-issue (`gh api` no endpoint de sub-issues). Onde sub-issues não estiverem habilitadas, adicione o filho a uma task list no body do map e coloque `Part of #<map>` no topo do body do filho. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Uma vez reivindicado, o ticket é atribuído ao dev responsável.
- **Blocking**: **native issue dependencies** do GitHub — a representação canônica, visível na UI. Adicione uma edge com `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, onde `<blocker-db-id>` é o **database id** numérico do bloqueador (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _não_ o `#number` nem o `node_id`). O GitHub reporta `issue_dependencies_summary.blocked_by` (apenas bloqueadores abertos — o gate ao vivo). Onde dependencies não estiverem disponíveis, use como fallback uma linha `Blocked by: #<n>, #<n>` no topo do body do filho. Um ticket é desbloqueado quando todos os bloqueadores estão fechados.
- **Frontier query**: liste os filhos abertos do map (`gh issue list --state open`, restrito às sub-issues / task list do map), descarte qualquer um com bloqueador aberto (`issue_dependencies_summary.blocked_by > 0`, ou uma issue aberta na linha `Blocked by`) ou com assignee; o primeiro na ordem do map vence.
- **Claim**: `gh issue edit <n> --add-assignee @me` — a primeira escrita da sessão.
- **Resolve**: `gh issue comment <n> --body "<resposta>"`, depois `gh issue close <n>`, depois anexe um ponteiro de contexto (gist + link) ao Decisions-so-far do map.
