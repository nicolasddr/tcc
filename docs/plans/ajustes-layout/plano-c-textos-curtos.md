# Plano C: Textos curtos em Rodadas e no Codebook

Ajustes **06 e 09** da referência visual `docs/plans/ajustes-layout/referencia-visual.html`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Contadores e aviso de amostra pequena em Rodadas (ajuste 06) | `refactor(rodadas): contadores e aviso de amostra curtos` | ⬜ |
| 2 | Card "Notas por resposta" sem parágrafo (ajuste 09) | `refactor(codebook): notas por resposta em uma linha` | ⬜ |

## Contexto comum

- Regra das telas (memória `redesenho-telas-plano-partes`): **nenhum texto some**. O que sai da linha
  visível vai para o `InfoTooltip` (`app/components/ui/tooltip.tsx`).
- Os textos ficam em módulos testados por unidade. Antes de mudar, buscar a frase antiga nos testes
  (`grep-texto-antigo-nos-testes`) e lembrar que texto movido para o tooltip continua no markup
  (`markuptextof-le-o-balao`): afirmar pela prop `text`/`aria-label`, não pela ausência.
- Sem comentários novos, sem `npx prettier`.

## Parte 1: Rodadas (ajuste 06)

1. **Contador de seleção** (`(tabs)/rounds/generate-responses.tsx`, ~124). Hoje: "0 de 5 itens
   selecionados", com 4 itens no pool; o 5 é o máximo por geração e parece o total.
   Proposta: "0 selecionados · até 5 por geração" (singular: "1 selecionado").
2. **Cota de respostas** (`(tabs)/rounds/preconditions.ts`, ~305). Hoje: "Restam 200 vagas de resposta
   de LLM neste projeto, de 200." Proposta: "200 de 200 respostas disponíveis", com `InfoTooltip`
   explicando que é o teto de respostas de LLM do projeto. O texto de bloqueio da linha ~231 continua
   como está. Teste afetado: `preconditions.unit.test.ts` (~341).
3. **Aviso de amostra pequena** (`(tabs)/rounds/agreement-labels.ts`, ~135, mostrado no
   `agreement-panel.tsx`). Hoje: um alerta amarelo de quatro linhas. Proposta: linha curta
   "Amostra pequena (2 avaliadores, 2 respostas): leia com cautela." + `InfoTooltip` com o resto
   (o corte de 3 avaliadores / 10 respostas, que é convenção da ferramenta e não da literatura, e que o
   valor continua valendo). Testes: `agreement-labels.unit.test.ts` e `rounds/page.int.test.ts` (~1233).

## Parte 2: Codebook (ajuste 09)

`app/projects/[id]/pipeline/criteria-summary.tsx`, card "Notas por resposta". Hoje o `hint` tem a conta
e mais duas frases de explicação, e o card fica com o dobro da altura dos vizinhos.
Proposta:
- `hint` vira só a conta: "2 definições × 2 critérios gerais". Quando houver critérios específicos,
  incluir também (ex.: "2 definições × 2 critérios gerais + 1 específico"); escolher a forma mais
  clara e manter a concordância com `plural()` (`lib/plural.ts`).
- A explicação ("Cada critério geral vira uma nota em cada definição… É esse o esforço que o avaliador
  terá a cada resposta.") vai para um `InfoTooltip` ao lado do rótulo. Conferir se o `StatCard`
  (`app/components/ui/stat.tsx`) já aceita `help`; se não, acrescentar.
