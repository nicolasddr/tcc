# Plano D: Tela Avaliar mais direta

Ajustes **07 e 08** da referência visual `docs/plans/ajustes-layout/referencia-visual.html`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | "O envio é definitivo" uma vez, junto do botão (ajuste 07) | `refactor(avaliar): aviso de envio definitivo junto do botão` | ✅ |
| 2 | Descrições de definição e critério visíveis (ajuste 08) | `feat(avaliar): descrições visíveis no formulário` | ⬜ |

## Contexto comum

- Arquivos: `app/projects/[id]/(tabs)/evaluate/page.tsx`, `evaluation-form.tsx`, `progress.ts`.
- Sem comentários novos, sem `npx prettier`, buscar nos testes as frases antigas
  (`grep-texto-antigo-nos-testes`, `markuptextof-le-o-balao`).
- Verificação: cena com rodada aberta e o usuário dev como avaliador ativo, `/dev/login` na `:3100`,
  conferir também em 375 px (`preview-pane-faixa-preta`: medir em iframe). Limpar a cena no fim.

## Parte 1: "o envio é definitivo" uma vez (ajuste 07)

**Hoje** a advertência aparece três vezes antes do formulário:
1. `help` da `Section` em `page.tsx` (~159);
2. `hint` da mesma `Section` (~158): "Cada resposta é avaliada uma vez, e o envio é definitivo.";
3. parágrafo acima das definições em `evaluation-form.tsx` (~172).

E o progresso (`progress.ts`, ~9) mostra visível "O total pode crescer se o administrador gerar mais
respostas."

**Proposta**:
- O `hint` da `Section` sai (ou vira o progresso, se fizer sentido no layout).
- O parágrafo acima das definições fica só com a instrução: "Dê uma nota em cada critério.
  Justificativa é opcional."
- Ao lado do botão "Enviar avaliação", **sempre visível**, a linha "O envio é definitivo." Hoje já
  existe uma mensagem perto do botão (~332, "Tudo preenchido. O envio é definitivo…"); unificar com ela
  em vez de criar uma segunda.
- O `help` da `Section` continua (é o ⓘ, não conta como repetição visível).
- "O total pode crescer…" sai da linha de progresso e vai para um `InfoTooltip` ao lado dela.
- Não mexer na mensagem de erro de `actions.ts` (~41): ela aparece só depois de um envio repetido.

## Parte 2: descrições visíveis (ajuste 08)

**Hoje** a descrição da definição e a de cada critério só aparecem no `InfoTooltip`
(`evaluation-form.tsx`, ~77, ~95, ~185). É a régua que o avaliador aplica em cada nota, e no celular o
tooltip quase não funciona.

**Proposta**:
- Mostrar a descrição como uma linha de texto pequeno e cinza (`text-xs text-muted`) logo abaixo do
  nome da definição e do nome do critério, no lugar do `InfoTooltip`. Respeitar quebras de linha com
  `preWrapClass` (`app/components/ui/prose.ts`), porque a descrição pode ter até 2.000 caracteres.
- Tirar o selo "geral" do critério (~78) nesta tela: a distinção geral/específico só importa para quem
  monta o codebook. Os outros usos do selo (Codebook, matrizes) continuam.
