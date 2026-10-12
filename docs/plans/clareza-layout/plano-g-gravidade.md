# Plano G: cores e confirmações que dizem a gravidade

Sugestão 7 da análise de 12/10 (`referencia-visual.html#s7`), retomada de 08/10 em parte. Faça
depois do Plano F.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | `ConfirmDialog` no lugar de todo `window.confirm`, com o verbo da ação no botão | `feat(confirmacao): um diálogo só para confirmar ações` | |
| 2 | `danger` com contorno vermelho só no que não tem volta; "Concluir projeto" e "Arquivar" em `secondary`; sai o `warning` | `refactor(botoes): vermelho só no que não tem volta` | |
| 3 | Tom `neutral` no `Alert` para estados, e o congelamento em uma frase com link | `refactor(avisos): tom neutro para estados e congelamento em uma frase` | |

## Contexto comum

- Arquivos:
  - `app/components/ui/button.tsx` (variantes ~6–45), `ui/alert.tsx`, `ui/row-actions.tsx`
    (`RowMenuItem`, que já é vermelho);
  - `app/projects/[id]/pipeline/advance-phase.tsx` (`dialogClass` e o diálogo de "Avançar fase",
    que é o modelo) e `(tabs)/rounds/close-round.tsx` (o outro diálogo que já existe);
  - os sete `confirm(`: `manage-project.tsx` ~160, `member-actions.tsx` ~22 e ~46,
    `evaluator-role.tsx` ~60, `pipeline/items-editor.tsx` (~294, ou onde a Parte 3 do Plano F o
    deixou), `(tabs)/questions/question-manager.tsx` ~139, `(tabs)/members/outlier-forms.tsx` ~83;
  - `pipeline/freeze.ts` (`frozenMessage`, com `freeze.unit.test.ts`), `pipeline/codebook-editor.tsx`
    e `pipeline/prompt-editor.tsx` (os `Alert tone="notice"`), `(tabs)/rounds/new-round.tsx`.
- Só apresentação: as actions não mudam. A confirmação continua acontecendo **antes** do envio, como
  hoje; nenhuma ação passa a ter confirmação que não tinha.
- Memórias que pesam:
  - "Menu três pontos e foco no Safari": o "Remover" do item está dentro de um `<details>` com
    `onBlur`. O `<dialog>` **não pode** ficar dentro do `<details>` (fechado, o conteúdo dele não é
    renderizado), e o foco que vai para o diálogo fecha o menu. Renderize o diálogo fora do menu;
  - "InfoTooltip não cabe em `<dialog>`": não ponha ⓘ dentro dos diálogos;
  - "Preview pane": `showModal()` logo depois do `navigate` dá *hydration mismatch*; clique no botão
    real.

## Parte 1: `ConfirmDialog`

**Hoje**: sete ações usam o `window.confirm` do navegador ("localhost:3000 diz…", com "OK"). Só
"Avançar fase" e "Fechar rodada" usam o `<dialog>` do app, e os botões deles dizem "Confirmar
avanço" e "Confirmar fechamento".

**Proposta**
- Novo `app/components/ui/confirm-dialog.tsx` (client), extraído do diálogo de `advance-phase.tsx`:
  - `ConfirmDialog({ trigger, title, children, confirmLabel, tone = 'default', action,
    fields, pending })`, ou uma forma equivalente que caiba nos sete usos. `trigger` é o botão que
    abre; `action` e `fields` (os `<input type="hidden">`) vão no `<form>` do botão de confirmar;
  - usa o `dialogClass` (mova-o para o componente novo e importe em `advance-phase.tsx` e
    `close-round.tsx`);
  - "Cancelar" (`secondary`) fecha; o botão de confirmar leva **o verbo da ação**;
  - `tone="danger"` dá o `dangerSolid` ao botão de confirmar; o padrão é `primary`;
  - foco no "Cancelar" ao abrir, Esc fecha (nativo do `<dialog>`), `aria-labelledby` no título.
- Os sete usos, com o texto de hoje dividido em título (a pergunta) e corpo (o resto):

| Onde | Título | Botão de confirmar | Tom |
|---|---|---|---|
| Ajustes › Concluir projeto | Concluir o projeto? | Concluir projeto | primary |
| Ajustes › Arquivar (ativo e concluído) | Arquivar o projeto? | Arquivar projeto | primary |
| Membros › Desativar | Desativar {nome}? | Desativar | danger |
| Membros › Sair do projeto | Sair deste projeto? | Sair do projeto | danger |
| Membros › Desfazer papel de avaliador | Desfazer o papel de avaliador? | Desfazer papel | danger |
| Itens › Remover | Remover o item “{nome}”? | Remover item | danger |
| Perguntas › Remover | Remover esta pergunta? | Remover pergunta | danger |
| Outliers › Remover a marca | Remover a marca de outlier de {nome}? | Remover a marca | primary |

- Os diálogos que já existem passam a usar o verbo: "Confirmar avanço" → "Avançar para a Fase N";
  "Confirmar fechamento" → "Fechar rodada N".
- Os textos de confirmação longos (o de "Desativar" tem ~60 palavras) ficam inteiros no corpo,
  quebrados em parágrafos curtos. Dentro do diálogo não há ⓘ.

**Passos**
1. **(TDD)** Teste unitário do `ConfirmDialog` (markup: `<dialog>` com `aria-labelledby`, o botão de
   confirmar com o rótulo pedido e, com `tone="danger"`, a classe do `dangerSolid`). E um teste que
   garante que não sobrou `confirm(` em `app` fora de testes (pode ser um `grep` no próprio teste,
   ou só o critério de "Pronto quando").
2. O componente e os sete usos; `advance-phase.tsx` e `close-round.tsx` com o verbo.
3. Navegador: abrir, cancelar, Esc e confirmar em cada um. No item, conferir que o menu ⋯ fecha e o
   diálogo abre (inclusive emulando o foco do Safari, como na memória).

**Pronto quando**
- `grep -rn "confirm(" app` não acha nada fora de testes.
- Os nove diálogos do app têm o verbo da ação no botão de confirmar.
- Cada ação confirmada funciona de verdade na cena (concluir e reativar, arquivar, remover item,
  remover pergunta, desativar, sair, desfazer papel, remover marca).
- Lint, typecheck e testes passam.

## Parte 2: as cores dos botões

**Hoje**
- `danger` é um botão **cinza** que só fica vermelho no hover. `dangerSolid` é vermelho cheio e
  `warning` é amarelo cheio. `dangerGhost` é texto vermelho sem padding (só o "Desativar").
- Em Ajustes, "Concluir projeto" é `dangerSolid` e "Arquivar" é `warning`, embora os dois tenham
  volta ("Reativar"). Já "Fechar rodada N", que não tem volta, é `secondary`.

**Proposta**
- `danger` passa a ter **contorno vermelho em repouso**: `border-danger-border text-danger-fg
  bg-surface`, com `bg-danger-tint` no hover. Confira o contraste do `text-danger-fg` sobre branco
  (mínimo 4,5:1).
- Sai a variante `warning` do tipo `ButtonVariant` e do mapa. Sai o `dangerGhost` se ficar sem uso.
- O `dangerSolid` só aparece no botão de confirmar dos diálogos com `tone="danger"`.

**⚠ G1. A tabela de gravidade.** O `danger` muda para todos que o usam, então cada uso precisa de
uma decisão. Recomendado:

| Ação | Hoje | Proposta | Por quê |
|---|---|---|---|
| Fechar rodada N (`close-round.tsx`) | secondary | danger | irreversível |
| Remover item (menu ⋯) | `RowMenuItem` vermelho | sem mudança | já é vermelho |
| Desativar avaliador (`member-actions.tsx`) | dangerGhost | danger `sm` | tira o acesso; só o Administrador readmite |
| Recusar convite (Visão geral e dashboard) | danger | danger | o convite não volta |
| Remover pergunta (`question-manager.tsx`) | danger | danger | apaga as respostas dadas |
| Desfazer papel de avaliador (`evaluator-role.tsx`) | danger | danger | apaga consentimento e respostas |
| Sair do projeto (`member-actions.tsx`) | danger | danger | só o Administrador readmite |
| Concluir projeto, Arquivar (`manage-project.tsx`) | dangerSolid, warning | secondary | têm volta |
| Remover a marca de outlier (`outlier-forms.tsx`) | danger | secondary | a marca pode ser refeita, e o histórico fica |
| Abandonar o onboarding (`consent-form.tsx`) | danger | secondary | o convite volta a pendente |
| Recusar solicitação de permissão (`admin/permissions`) | danger | danger | decisão do super-admin, sem desfazer na tela |

Confirmar a tabela antes de implementar.

**Pronto quando**
- `grep -rn "'warning'\|\"warning\"" app/components/ui/button.tsx` não acha nada, e não há
  `variant="warning"` no app.
- Os botões da tabela estão como decidido no G1, conferidos no navegador.
- Lint, typecheck e testes passam.

## Parte 3: avisos de estado em tom neutro

**Hoje**
- `Alert` tem `error`, `success` e `notice` (amarelo). O amarelo marca pendências que pedem ação e
  também estados só informativos, como o codebook congelado.
- `frozenMessage` (`freeze.ts`) tem duas frases longas por assunto; a do prompt, três.

**Proposta**
- `Alert` ganha o tom `neutral`: `bg-surface-subtle border-line text-label`, sem `role` padrão, com
  um ícone opcional à esquerda (`icon?: React.ReactNode`; o `LockIcon` para congelado e travado).
- Classificação dos `tone="notice"` de hoje (estado → `neutral`; pendência que pede ação →
  `notice`):

| Onde | Texto | Tom |
|---|---|---|
| `codebook-editor.tsx` ~748, `prompt-editor.tsx` ~203 | congelado (Fase 4) ou travado por rodada aberta | neutral, com cadeado |
| `manage-project.tsx` ~183 | "Projeto concluído/arquivado: somente leitura…" | neutral |
| `new-round.tsx` ~55 | "Esta rodada vai congelar o codebook vN e o prompt vN." (hoje um `Card` cinza) | neutral |
| `projects/new/page.tsx` ~46 | "Sua solicitação está em análise…" | neutral |
| `codebook-editor.tsx` ~668 | definições sem critério próprio | notice |
| `new-round.tsx` ~45 | o que impede abrir a rodada | notice |
| `generate-responses.tsx` ~208 e ~212 | teto atingido, seleção inválida | notice |
| `agreement-panel.tsx` ~207 | amostra pequena | notice |
| `round-changes-note.tsx` ~44 | leia o `noticeOf` e classifique pela mesma regra | ? |

- **Congelamento em uma frase**: troque `frozenMessage(subject)` por um componente
  `FrozenNotice({ subject, projectId })` (ou mantenha a função para o texto e acrescente o link no
  componente) que diz:
  - codebook: "Codebook congelado na Fase 4, para o teste de replicação. Para refinar, [volte à
    Fase 3]."
  - prompt: "Texto do prompt congelado na Fase 4, para o teste de replicação. Nome, descrição e
    registro de mudanças continuam editáveis. Para refinar o texto, [volte à Fase 3]."
  - o link leva a `/projects/{id}#voltar`, onde fica o painel de voltar da Fase 4 (Visão geral).
  - nenhum texto some: o "para que o teste de replicação meça exatamente o que a Fase 3 avaliou" já
    está no `FROZEN_BADGE_HELP`; confira e, se não estiver, leve a ideia para lá.
- Atualize `freeze.unit.test.ts` e os testes de Codebook e Prompt na Fase 4
  (`pipeline/phase-4-freeze.int.test.ts`).

**Pronto quando**
- Estados (congelado, travado, somente leitura, "vai congelar", solicitação em análise) aparecem em
  cinza com cadeado onde couber; o amarelo só aparece em pendência que pede ação.
- Codebook e Prompt na Fase 4 mostram uma frase com o link, e o link leva ao painel de voltar.
- Lint, typecheck e testes passam.
