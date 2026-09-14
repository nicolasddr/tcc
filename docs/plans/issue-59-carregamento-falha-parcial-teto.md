# Plano de implementação — Issue #59: "23b — Geração: carregamento, falha parcial e teto de custo"

Link: https://github.com/nicolasddr/tcc/issues/59
Pai: Épico 2 (#54) · Spec: `docs/prd/epico-2-validacao-do-codebook.md` (histórias 20, 21, 22)
Blocked by: #58 (fechada) — "Geração de respostas com proveniência"

## Achado principal: a maior parte já está implementada

A #58, ao entregar a geração com proveniência, já implementou quase todo o comportamento que a #59
pede. Antes de escrever qualquer código, vale registrar o que **já está pronto** em
[`app/projects/[id]/(tabs)/rounds/actions.ts`](../../app/projects/%5Bid%5D/(tabs)/rounds/actions.ts)
e [`generate-responses.tsx`](../../app/projects/%5Bid%5D/(tabs)/rounds/generate-responses.tsx):

| AC da issue | Estado | Onde |
|---|---|---|
| Botão desabilitado/loading durante a chamada, sem duplo clique | ✅ pronto | `generate-responses.tsx:39,116,167` (`useActionState` + `pending`) |
| Tela continua utilizável enquanto a resposta não chega | ✅ pronto | é Server Action com `useActionState`, não bloqueia a página |
| Cada resposta persistida assim que chega, sem esperar o lote | ✅ pronto | `actions.ts:333-401` — `insert` dentro do `for` a cada item |
| Item que falhou não deixa linha gravada e continua disponível | ✅ pronto | `try/catch` por item, sem insert em caso de falha; item não entra em `usedHere` |
| Mensagens distinguíveis (auth, tamanho, indisponibilidade), sem expor chave | ✅ pronto | `lib/ai/failure.ts` (`classifyResponseFailure`/`classifyThrownFailure`) + `GENERATION_FAILURE_MESSAGES` em `preconditions.ts:171-204` |
| Resposta sem texto não vira dado | ✅ pronto | `actions.ts:358-361` (`'blank'`) — nem entra na contagem do teto |
| Action confere o teto antes de chamar a LLM, recusa nomeando o limite | ✅ pronto | `actions.ts:325-327` (recusa total) e `:334-337` (recusa por item, dentro do lote) |
| Falha na LLM não consome o teto | ✅ pronto | `countProjectResponse` só é chamado após o insert com sucesso (`actions.ts:399`) |
| Itens que falharam são listados na tela | ✅ pronto | `generate-responses.tsx:188-204` |

Isso muda o escopo da issue: não é "construir do zero", é **fechar duas lacunas concretas** mais
cobrir com teste o que falta.

## Lacuna 1 — Seletor de quantidade não nasce limitado pelas vagas restantes

A ADR 0003 e a história 22 pedem que o seletor nasça limitado pelas vagas restantes do projeto, e
que a tela mostre quantas restam. Hoje:

- `SELECTION_MAX` em [`preconditions.ts:87`](../../app/projects/%5Bid%5D/(tabs)/rounds/preconditions.ts#L87)
  é uma constante fixa (`5`), sem relação com `projectResponsesLeft`.
- `lib/ai/quota.ts` expõe `projectResponsesLeft`, mas **nenhuma tela usa essa função** — ela só é
  chamada dentro do próprio módulo (`grep` confirma: só `hasProjectResponsesLeft` e
  `projectResponsesMax` são importadas em `actions.ts`).
- A checagem de servidor por item (`actions.ts:334`) já impede estourar o teto mesmo que a UI deixe
  selecionar mais do que as vagas restantes — ou seja, não há risco de fatura indevida, é uma lacuna
  de UX/clareza, não de integridade.

### Mudanças

1. **`app/projects/[id]/(tabs)/rounds/preconditions.ts`**
   - `SelectionInputs.max` já existe como parâmetro opcional (`max = SELECTION_MAX`) — nada a mudar
     aqui na assinatura, só passar o valor certo a partir de quem chama.
   - Adicionar uma mensagem para quando a seleção exceder as vagas restantes (hoje `too_many` só
     fala do teto de 5; decidir se reaproveita `too_many` com `max` dinâmico ou se cria um blocker
     novo `key: 'ceiling'` com mensagem que nomeia as vagas restantes, para não confundir "máximo
     por geração" com "vagas restantes do projeto"). Recomendo um blocker novo, porque a causa e a
     ação corretiva são diferentes (uma é limite de lote, a outra é orçamento).

2. **`app/projects/[id]/(tabs)/rounds/page.tsx`**
   - Importar `projectResponsesLeft` (e talvez `projectResponsesMax`) de `@/lib/ai/quota`.
   - Calcular `responsesLeft = projectResponsesLeft(project.id)` junto da carga de dados da página.
   - Passar `responsesLeft` para `<GenerateResponses>`.

3. **`app/projects/[id]/(tabs)/rounds/generate-responses.tsx`**
   - Receber `responsesLeft: number` como prop.
   - Calcular `max = Math.min(SELECTION_MAX, responsesLeft)` e usar esse `max` em vez de
     `SELECTION_MAX` no `atMax` e ao passar para `selectionBlockers(selected, { available, usedInRound, max })`.
   - Mostrar o texto "restam N de M vagas de LLM neste projeto" perto do contador de seleção
     (reaproveitar `projectResponsesMax()` — pode vir como prop também, para não importar `lib/ai/quota`
     num componente cliente).
   - Quando `responsesLeft === 0`: desabilitar toda a seleção com uma mensagem clara (reaproveitando
     a mensagem `ceilingReached` já existente em `actions.ts:253-258`, movida ou duplicada para
     `preconditions.ts` para ser importável pelo componente cliente sem puxar `lib/ai/quota` — hoje
     `ceilingReached` mora em `actions.ts`, que é `'use server'`; ela precisa ficar em `preconditions.ts`
     junto das outras mensagens de blocker para ser reaproveitada dos dois lados).

4. **`app/projects/[id]/(tabs)/rounds/actions.ts`**
   - Em `setUpGeneration`, passar `max: projectResponsesLeft(projectId)` combinado com
     `SELECTION_MAX` para `selectionBlockers`, para que a recusa do servidor também nomeie a causa
     certa (vagas restantes vs. limite de lote) — hoje a recusa de teto só acontece via
     `hasProjectResponsesLeft` antes/durante o loop, não via `selectionBlockers`. Decidir se a
     recusa "vagas restantes < selecionados" deve barrar **antes** de começar o loop (mais claro
     para o Administrador) — recomendo isso, porque hoje um pedido de 5 itens com 2 vagas gera 2
     sucessos e 3 falhas com `failure: 'ceiling'`, o que tecnicamente atende "falha na LLM não
     consome o teto" mas não é a melhor experiência quando dava para avisar antes de gastar nada.
     **Decisão de produto a confirmar com quem definiu a AC**: recusar tudo de saída (nomeando o
     limite) ou permitir o comportamento atual de "gera o que cabe, marca o resto como `ceiling`".
     A redação do AC ("a tela mostra quantas restam" + "a action confere o teto antes de chamar a
     LLM") é compatível com as duas leituras; a mais simples e menos arriscada é **manter o
     comportamento atual de gerar o que cabe** (já implementado e testado) e só adicionar a
     UX de mostrar/limitar vagas restantes no seletor — evita reescrever um fluxo que já tem
     cobertura de teste verde.

## Lacuna 2 — "Tentar de novo só para eles" não é uma ação dedicada

Hoje, um item que falhou simplesmente **não** entra em `usedHere` (`generate-responses.tsx:49-51`),
então ele continua na lista principal, ainda marcável. Isso já satisfaz "continua disponível para
nova tentativa" (AC concluído), mas não entrega literalmente "**opção de tentar de novo só para
eles**" — hoje o Administrador teria que desmarcar manualmente os itens que deram certo (que aliás
já saem da lista de seleção, porque viram "usadas" — não, espera: itens com sucesso somem da seleção
disponível só depois do próximo render, porque entram em `generated`/`usedHere`; e o `useState`
`selected` é limpo a cada submissão via o efeito `settled` em `generate-responses.tsx:41-47`). Ou
seja: **depois de uma geração parcial, a seleção volta a zero, e os itens que falharam ficam
disponíveis de novo na lista — mas sem nenhum destaque ou atalho para reselecioná-los junto**.

### Mudança proposta

Em `generate-responses.tsx`, quando `outcome.failed.length > 0`:

- Adicionar um botão "Tentar de novo só estes N itens" no card de falhas
  (`generate-responses.tsx:188-204`), que chama `setSelected(outcome.failed.map(f => f.itemId))`
  (client-side, sem round-trip ao servidor) e rola a tela até o formulário/checkbox list.
- Opcional, mas recomendado para casos com poucas falhas: pré-marcar automaticamente os itens
  falhados assim que o resultado chega (`setSelected` dentro do mesmo efeito que já reage a
  `done !== settled`), em vez de depender de um clique — mais fiel a "opção de tentar de novo",
  mas decidir com o usuário se prefere o clique explícito (mais previsível, não geram nova chamada
  sem ação do Administrador) ou o pré-preenchimento (mais rápido, menos cliques). **Recomendo o
  botão explícito**: pré-selecionar sozinho pode surpreender quem só queria ver o que falhou antes
  de decidir se tenta de novo.
- Garantir que o botão respeite o novo `max` (Lacuna 1): se `outcome.failed.length` excede as vagas
  restantes atuais, desabilitar o botão ou truncar a seleção com um aviso — situação rara mas
  possível se o teto mudou entre chamadas.

Nenhuma mudança de servidor é necessária aqui: a re-submissão desses itens passa pelo mesmo `action`
e pelas mesmas validações já existentes.

## Testes a adicionar/ajustar

Arquivo principal: [`generate-responses.int.test.ts`](../../app/projects/%5Bid%5D/(tabs)/rounds/generate-responses.int.test.ts)
(já cobre bastante — confirmar antes de duplicar):

- [ ] Seletor: com `responsesLeft` menor que 5, o `max` efetivo cai para `responsesLeft` (teste de
      unidade em `preconditions.unit.test.ts`, similar ao já existente para `SELECTION_MAX`).
- [ ] Servidor: `selected.length` maior que `responsesLeft` é recusado nomeando o número de vagas
      restantes (se a decisão da Lacuna 1 for "recusar antes" — caso contrário, este teste não é
      necessário e o comportamento atual de "gera o que cabe" já está coberto, ver
      `generate-responses.int.test.ts:505` para o caso `ceiling` parcial existente).
- [ ] UI (RTL/component, se o projeto testa componentes client — confirmar convenção do repo antes
      de escrever) ou E2E: clicar em "Tentar de novo só estes N itens" preenche a seleção
      exatamente com os itens falhados, e apenas eles.
- [ ] Confirmar que os testes já verdes de `actions.int.test.ts` e `generate-responses.int.test.ts`
      continuam passando sem alteração de comportamento nos casos que já existem (falha parcial,
      teto atingido no meio do lote, resposta em branco, resposta longa demais, duplicidade).

## Ordem de execução sugerida

1. Mover `ceilingReached` (e qualquer outra mensagem hoje presa em `actions.ts`) para
   `preconditions.ts`, para poder ser importada por um componente cliente sem trazer `'use server'`.
2. `lib/ai/quota.ts`: nenhuma mudança de código, só passar a **usar** `projectResponsesLeft` fora do
   módulo.
3. `page.tsx` → `generate-responses.tsx`: encanar `responsesLeft`/`responsesMax` como props, ajustar
   o `max` efetivo do seletor e exibir o texto de vagas restantes.
4. `preconditions.ts`: blocker novo (ou reaproveitado) para seleção acima das vagas restantes, com
   mensagem própria.
5. `actions.ts`: decidir e implementar o comportamento de recusa antecipada (ou confirmar que o
   atual já basta) — **conversar com quem definiu a AC antes desse passo**, é a única decisão de
   produto em aberto deste plano.
6. `generate-responses.tsx`: botão "tentar de novo só estes N itens".
7. Testes: unidade (`preconditions.unit.test.ts`) e integração (`generate-responses.int.test.ts`,
   `actions.int.test.ts`), cobrindo os pontos da seção anterior.
8. Rodar a suíte completa (`npm test`) e o typecheck/lint (`AGENTS.md`/CI já usam esses gates).
9. Atualizar os checkboxes de AC na issue #59 e fechar via commit/PR referenciando `Closes #59`.

## Observações

- Como quase tudo já está implementado, o risco maior deste trabalho é **regressão**: qualquer
  mudança em `selectionBlockers`/`setUpGeneration` precisa manter verdes os testes existentes de
  falha parcial e teto (já robustos). Prefira estender assinaturas com parâmetros opcionais em vez
  de mudar comportamento por trás dos testes atuais.
- Este documento é um plano de trabalho, não um ADR — se a decisão da Lacuna 1 (recusar de saída vs.
  gerar o que cabe) mudar uma regra de domínio já registrada em ADR, isso deve virar uma ADR nova em
  `docs/adr/`, não só um comentário aqui (ver `docs/agents/domain.md`).
