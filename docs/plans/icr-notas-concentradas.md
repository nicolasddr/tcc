# Ler o ICR quando as notas se concentram, e por critério

Escrito em 2026-10-19 contra o `main` em `893c505`. Sem issue no GitHub: os commits não levam
`Refs`/`Closes`.

**Objetivo:** o Administrador consegue entender um ICR baixo que vem de notas concentradas num nível
só, e consegue ler a concordância de um critério juntando todas as definições. O caso que motivou é
o PoC do LLMAuditor (ADR 0013). Lá as definições são posições ("Pergunta 1" a "Pergunta 5"), quase
toda nota de Relevância é Alto, e o α fica perto de zero mesmo com os avaliadores quase sempre de
acordo.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | `agreementProfile` em `lib/agreement.ts`; painel da rodada mostra as notas iguais e a distribuição ao lado do α, com aviso de notas concentradas; documentação | `feat(rodadas): mostrar notas iguais e distribuição ao lado do ICR` | |
| 2 | Linha "Todas as definições" na matriz de concordância: um α por coluna, juntando as notas de todas as definições; documentação | `feat(rodadas): linha de todas as definições na matriz de concordância` | |
| 3 | Notas iguais em cada célula da matriz (no `title`) e visíveis na linha nova | `feat(rodadas): notas iguais por célula na matriz de concordância` | |

As Partes 1 e 2 não dependem uma da outra e podem rodar em chats paralelos. Cada uma mexe em
arquivos diferentes, com uma exceção: as duas editam `docs/icr-como-calculamos.md` e
`docs/CONTEXT.md`, em seções diferentes. Quem commitar por último confere o arquivo antes. A
Parte 3 depende das duas.

**Decisões ⚠ D1, D4 e D6 confirmadas pelo usuário em 2026-10-19**, as três na opção recomendada.
Não perguntar de novo.

**A linha "Todas as definições" (D6, Partes 2 e 3) é substituída por `icr-por-criterio.md`**: no
pé da matriz, ela lia como total ou média.

---

## 1. Ponto de partida

| Peça | Onde | Nesta série |
|---|---|---|
| α ordinal | `lib/agreement.ts`: `groupByUnit`, `coincidences`, `marginals`, `ordinalAlpha` → `Agreement` | Parte 1 acrescenta `agreementProfile` |
| Observações | `(tabs)/rounds/agreement.ts`: unidade = `resposta:definição:critério` (~43) | não muda |
| Par com/sem outliers | `(tabs)/rounds/agreement-pair.ts`: `agreementPair`, `withoutExcluded`, `evaluatedResponses` | Parte 1 |
| Painel da rodada | `(tabs)/rounds/agreement-panel.tsx`: `AgreementPanel` (`StatCard` com `hint`, `Alert` de amostra pequena) | Parte 1 |
| Página | `(tabs)/rounds/page.tsx` ~164–200 monta `focusPair` e `responses`; ~351 desenha `AgreementPanel` e `AgreementMatrixTable` | Parte 1 |
| Matriz | `(tabs)/rounds/agreement-matrix.ts`: `matrixColumns`, `measuredMatrix`, `agreementMatrix`; `agreement-matrix-table.tsx` (`Cell`, tabela) | Partes 2 e 3 |
| Textos | `(tabs)/rounds/agreement-labels.ts`: `sampleSize`, `smallSampleWarning`, `AGREEMENT_BANDS`, `cellNotApplicableTitle`; `quality-labels.ts`: `formatShare` | as três |
| Escala | `(tabs)/evaluate/scale.ts`: `SCALE`, `scaleLabel`, `scaleRank` (Alto = 3) | não muda |
| Testes | `lib/agreement.unit.test.ts`, `agreement-pair.unit.test.ts`, `agreement-labels.unit.test.ts`, `agreement-matrix.unit.test.ts`, `rounds/page.int.test.ts` (`matrixOf`, `matrixTextOf`, `Object.keys(matrixOf(tree))` ~2005) | as três |
| Docs | `docs/icr-como-calculamos.md` (seções 3 e 5), `docs/CONTEXT.md` (*Concordância (ICR)* ~134) | Partes 1 e 2 |

Caminhos curtos são relativos a `app/projects/[id]/`.

---

## 2. O que a leitura do código achou

1. **O cálculo está certo, e a unidade também.** As notas da Pergunta 1 da resposta 1 só são
   comparadas entre si, nunca com as da Pergunta 1 da resposta 2. O α baixo vem do paradoxo da
   prevalência: com quase toda nota em Alto, a discordância esperada ao acaso é quase zero, e uma
   divergência só já derruba o coeficiente. Rodando o `ordinalAlpha` atual, com 2 avaliadores:

   | Notas | Iguais | α |
   |---|---|---|
   | 50 unidades: 48 × (Alto, Alto) + 2 × (Alto, Médio) | 96% | −0,01 |
   | 50 unidades: 45 × (Alto, Alto) + 5 × (Alto, Médio) | 90% | −0,04 |
   | 50 unidades: 40 × (Alto, Alto) + 5 × (Médio, Médio) + 5 × (Alto, Médio) | 90% | 0,61 |
   | célula de 10 unidades: 9 × (Alto, Alto) + 1 × (Alto, Médio) | 90% | 0,00 |

2. **A documentação descarta a concordância percentual de propósito.** `icr-como-calculamos.md`
   (seção 3) diz que o teste de 80% → α = −1/18 "mostra por que a concordância percentual não é
   usada". Esta série não troca a métrica: o número novo aparece **ao lado** do α, nunca no lugar
   dele, e a frase da documentação muda para dizer isso.
3. **As linhas da matriz por definição não servem de diagnóstico quando a definição é uma
   posição.** "Pergunta 3" não é um texto do codebook a refinar. O número que interessa é o de
   Relevância juntando as cinco posições, e ele não aparece em lugar nenhum hoje. O α da rodada
   inteira junta também os outros critérios (Diversidade, no PoC).
4. **"Não existe média, soma nem ICR do projeto"** (`CONTEXT.md`, `icr-como-calculamos.md` seção 5).
   A linha nova da Parte 2 não fere essa regra: é um α calculado sobre as notas da coluna naquela
   rodada, não a média dos α das células. Isso precisa estar escrito na tela e na documentação.
5. **O Avaliador não vê nada disto** (ADR 0011). O painel e a matriz já só existem para o
   Administrador (`page.tsx`, ramo `!access.isAdmin`). A ADR vale também para as notas iguais e a
   distribuição, pelo mesmo motivo: o efeito de conformidade.
6. **A matriz é sempre "com todos"** (`icr-como-calculamos.md` seção 5). A linha nova também.

---

## 3. Decisões

**D1 ⚠. O que aparece ao lado do α.** Duas coisas, calculadas sobre os mesmos valores que o α usa:
- **notas iguais**: a parte dos pares de notas, dentro de cada unidade, em que os avaliadores deram
  o mesmo nível;
- **distribuição**: a parte das notas em Alto, Médio e Baixo.

As duas juntas explicam o número: "96% de notas iguais, 94% das notas em Alto". Rejeitadas: só a
distribuição, que não diz se os avaliadores concordam; e trocar o α por outra métrica (AC2 de
Gwet), que muda a série, as faixas de referência (ADR 0004) e pediria ADR nova.

**D2. Definição exata.** Pela matriz de coincidências que o α já monta:
- notas iguais = `Σ_c o[c][c] / n`;
- distribuição = `n_c / n` para cada nível.

Com dois avaliadores, notas iguais é a parte das unidades em que os dois deram o mesmo nível. Com
mais avaliadores, cada par pesa `1/(mᵤ − 1)`, como no α. Unidades com uma nota só ficam fora, como no
α, e os números batem com o N mostrado. A distribuição traz sempre os três níveis, inclusive 0%.

**D3. Forma no código.** A função é `agreementProfile(observations): AgreementProfile | null`, em
`lib/agreement.ts`, reaproveitando `groupByUnit`, `coincidences` e `marginals`. Ela devolve
`{ equal: number; shares: ReadonlyMap<number, number> }` (chave = posto), e `null` quando não há
unidade pareável. Fica **fora** do tipo `Agreement`, por dois motivos: há dezenas de literais
`calculable: true/false` nos testes, e o não calculável deve continuar sem número. A camada de
textos converte o posto em nível com `SCALE`/`scaleRank`.

**D4 ⚠. Aviso de notas concentradas.** O painel mostra um `Alert tone="notice"` quando as três
condições valem juntas: o α é calculável, o α está na faixa questionável (`< AGREEMENT_BANDS.acceptable`)
e as notas iguais são `≥ 0,8`. Texto proposto:

> "As notas se concentram em Alto (94%), e os avaliadores deram a mesma nota em 96% dos pares. Com
> pouca variação na escala, poucas divergências bastam para derrubar o α. Leia o número junto com a
> matriz."

O nível citado é o de maior parte. O corte de 0,8 é convenção da ferramenta, como o de amostra
pequena, e a ajuda (ⓘ) diz isso. Alternativa: só mostrar os números, sem aviso.

**D5. Nome na tela.** O nome na tela é **"notas iguais"**, e não "concordância bruta" nem
"percentual". Assim não aparecem dois números chamados de concordância lado a lado. O formato é
"96% de notas iguais", usando `formatShare` de `quality-labels.ts` (uma casa decimal, vírgula).

**D6 ⚠. A linha "Todas as definições" na matriz.**
- É uma linha depois das definições e antes da linha "Por resposta", com o rótulo
  "Todas as definições".
- Em cada coluna, um α sobre **todas** as notas daquela coluna na rodada. Para coluna de critério
  geral, são as notas de todas as definições. Para coluna de critérios específicos de mesmo nome (que
  já dividem a coluna), as notas de todas as definições que têm aquele critério.
- A coluna do critério por resposta mostra "—", com o título "o critério por resposta já tem um
  valor só, na linha Por resposta".
- A linha só aparece com **duas ou mais definições**. Com uma só, ela repetiria a linha de cima.
- Legenda abaixo da tabela (`HowToRead`): "A linha “Todas as definições” junta, em cada coluna, as
  notas de todas as definições numa conta só. É um α sobre essas notas, e não a média das células.
  É a leitura do critério quando as definições são posições (Pergunta 1, Pergunta 2…) e não textos
  diferentes."

Rejeitadas: uma marca no projeto do tipo "as definições são posições", que esconderia as linhas
(conceito novo, schema novo, e as linhas por posição continuam úteis para achar uma posição
problemática); e uma tabela separada por critério, fora da matriz, que duplicaria cabeçalhos.

**D7. Com e sem outliers.** O painel mostra notas iguais e distribuição nos dois valores ("com
todos" e "sem os marcados"), cada um com o seu recorte. O aviso de D4 segue o padrão do aviso de
amostra pequena: com outliers, um aviso por valor, prefixado pelo rótulo do valor.

---

## 4. Parte 1: notas iguais e distribuição no painel da rodada

**Commit:** `feat(rodadas): mostrar notas iguais e distribuição ao lado do ICR`

Antes de codar: confirmar D1 e D4.

1. **(TDD, unitário)** `lib/agreement.unit.test.ts`, `describe('agreementProfile')`. Ver cada caso
   falhar antes do código, pela mensagem de asserção (não pelo import: criar a função primeiro
   devolvendo `null` e ver os vermelhos de valor):
   - o caso degenerado que já existe (8 × (3,3), (3,2), (2,3)) → `equal` 0,8; Alto 0,9, Médio 0,1,
     Baixo 0;
   - 48 × (3,3) + 2 × (3,2) → `equal` 0,96; Alto 0,98, Médio 0,02;
   - a matriz de Krippendorff (2011) que já está no arquivo → `equal` 0,8 (32 de 40 valores
     pareáveis); partes 9/40, 13/40, 10/40, 5/40, 3/40 nos postos 1 a 5;
   - unidade com uma nota só fica fora (o `equal` não muda ao acrescentá-la);
   - sem unidade pareável → `null`; um avaliador só → `null`.
2. `lib/agreement.ts`: `AgreementProfile` e `agreementProfile` (D2, D3), sem mexer em
   `ordinalAlpha`.
3. **(TDD, unitário)** `agreement-labels.unit.test.ts`:
   - `profileLine(profile)` → `"96% de notas iguais · Alto 94% · Médio 6% · Baixo 0%"`, nessa ordem
     (`SCALE`). Conferir o separador e o formato de `formatShare` (a vírgula aparece em 94,5%);
   - `concentrationWarning(agreement, profile)`: `null` quando o α não é calculável, quando está em
     aceitável/boa, quando as notas iguais ficam abaixo de 0,8, ou quando o perfil é `null`; texto
     de D4 com o nível de maior parte e as duas porcentagens quando as três condições valem. Testar
     a fronteira exatamente em 0,8 e em `AGREEMENT_BANDS.acceptable`.
4. `agreement-labels.ts`: `profileLine`, `concentrationWarning`, `CONCENTRATION_HELP` (ⓘ: o que é o
   paradoxo, em duas frases, e que o corte é convenção da ferramenta). Conferir o texto contra o
   código (memória "texto de ajuda: conferir no código").
5. `agreement-pair.ts`: `profilePair(observations, excluded)` →
   `{ all: AgreementProfile | null; withoutOutliers: AgreementProfile | null }`, espelhando
   `agreementPair` (com `withoutOutliers` nulo quando não há excluídos). Teste em
   `agreement-pair.unit.test.ts`.
6. `agreement-panel.tsx`:
   - `AgreementPanel` ganha a prop `profiles` (formato do passo 5);
   - o `hint` de cada `AgreementStat` ganha uma linha (`<br />`) com `profileLine`, quando o perfil
     não é nulo, inclusive no não calculável por falta de variação ("100% de notas iguais · Alto
     100%…" explica o "sem variação");
   - os avisos de D4 entram na mesma lista `warnings` do aviso de amostra pequena (D7), com
     `<InfoTooltip text={CONCENTRATION_HELP} />`.
7. `page.tsx`: calcular `profilePair(focusObservations, focusExcluded)` e passar ao painel.
8. **(TDD, integração)** `rounds/page.int.test.ts`: numa cena com notas concentradas, o painel
   recebe `profiles` com os valores esperados, e o markup do painel contém a linha e o aviso. Antes:
   `grep` por `Object.keys(` e `toEqual(` sobre as props do `AgreementPanel` (memória "grep do texto
   antigo nos testes"). Afirmar o aviso pelo texto do `Alert`, e não pelo balão do ⓘ (memória do
   `markupTextOf`).
9. Docs:
   - `docs/icr-como-calculamos.md`, seção 3, *Validação*: trocar "o que mostra por que a
     concordância percentual não é usada" por "o que mostra por que as notas iguais aparecem ao lado
     do alpha, e nunca no lugar dele";
   - nova seção 4.1 *Notas iguais e distribuição*, com D2 e a regra do aviso (D4);
   - `docs/CONTEXT.md`, *Concordância (ICR)*: uma frase dizendo que a tela mostra, ao lado do α, as
     *notas iguais* e a distribuição, para ler α baixo com notas concentradas, e que elas não
     substituem o α.
10. Verificar no preview (`/dev/login`): uma rodada com notas concentradas mostra a linha e o aviso;
    uma rodada com α bom não mostra aviso; 375 px sem estouro do `hint`. Para montar a cena, usar o
    vitest como runner de seed (memória).
11. `npm run lint`, `npx tsc --noEmit`, `npm test` (banco limpo antes; memória "cena no banco quebra
    int test").

Fora: série entre rodadas, `AgreementValue` (lista de rodadas, visão geral, gráfico), matriz. A
matriz é da Parte 3.

---

## 5. Parte 2: linha "Todas as definições" na matriz de concordância

**Commit:** `feat(rodadas): linha de todas as definições na matriz de concordância`

Antes de codar: confirmar D6.

1. **(TDD, unitário)** `agreement-matrix.unit.test.ts`, `describe('… — todas as definições')`:
   - com um critério geral em três definições, o α da linha é o `ordinalAlpha` de todas as notas da
     coluna juntas, e **não** a média dos três α das células (montar um caso em que os dois
     diferem e afirmar o valor exato);
   - coluna de específicos de mesmo nome junta só as definições que têm o critério;
   - coluna do critério por resposta → `not_applicable`;
   - coluna sem nota em definição nenhuma → `unrated`;
   - com uma definição só, a função não devolve linha (D6);
   - notas da linha "Por resposta" não entram em coluna nenhuma da linha nova.
2. `agreement-matrix.ts`: `allDefinitionsRow(definitions, criteria, observations)` →
   `{ column, cell: MatrixCell }[] | null`. Ela reaproveita `matrixColumns` e, por coluna, filtra as
   observações cujo `(definitionId, criterionId)` está em `column.criteria` com chave não nula.
   Sem mexer em `measuredMatrix`: a Qualidade usa o mesmo módulo e fica igual.
3. `agreement-labels.ts`: `ALL_DEFINITIONS_LABEL = 'Todas as definições'`,
   `CELL_ALL_DEFINITIONS_PER_RESPONSE_TITLE`, `ALL_DEFINITIONS_LEGEND` (texto de D6).
4. `agreement-matrix-table.tsx`:
   - a linha nova entre as definições e a linha "Por resposta", com `border-t-2` (ou outra
     separação visual leve) e o rótulo em `th scope="row"`;
   - `HowToRead` abaixo da tabela com `ALL_DEFINITIONS_LEGEND`, só quando a linha aparece;
   - **sem prop nova** no componente: tudo sai de `definitions`, `criteria` e `observations` (o
     teste em `page.int.test.ts` ~2005 confere as chaves das props).
5. **(TDD, integração)** `rounds/page.int.test.ts`: numa cena com duas definições e um critério
   geral, `matrixTextOf` contém "Todas as definições" e o α da linha; com uma definição, não contém.
6. Docs:
   - `docs/icr-como-calculamos.md`, seção 5, *Matriz por célula*: um item sobre a linha, dizendo que
     é um α sobre as notas da coluna e não média, e que é "com todos";
   - `docs/CONTEXT.md`, *Concordância (ICR)*: depois da frase de "não existe média", acrescentar
     que a linha "Todas as definições" da matriz é um α sobre as notas da coluna naquela rodada, e
     não uma média.
7. Verificar no preview: a matriz de uma rodada com 5 definições e Relevância geral mostra a linha;
   375 px com rolagem horizontal da tabela (já existe `overflow-x-auto`), sem estouro da página.
8. `npm run lint`, `npx tsc --noEmit`, `npm test`.

Fora: a mesma linha na matriz da Qualidade (`quality-matrix-table.tsx`). O problema de leitura é o
mesmo, mas a Qualidade é uma distribuição, e juntar definições lá pede decisão própria. Fica como
próximo passo, se o PoC mostrar que faz falta.

---

## 6. Parte 3: notas iguais por célula

**Commit:** `feat(rodadas): notas iguais por célula na matriz de concordância`

Depende das Partes 1 (`agreementProfile`, `formatShare`, D5) e 2 (linha nova).

1. **(TDD, unitário)** `agreement-matrix.unit.test.ts`: a célula `calculated` e a não calculável
   passam a trazer `profile: AgreementProfile | null`, nas linhas das definições e na linha nova.
   Antes: `grep` por `toEqual(` sobre `MatrixCell` nos testes, porque o campo novo quebra igualdade
   exata.
2. `agreement-matrix.ts`: `agreementCell` e `allDefinitionsRow` anexam `agreementProfile(group)`.
3. **(TDD, unitário)** `agreement-labels.unit.test.ts`: `cellTitle(agreement, profile)` →
   `"10 notas · 2 avaliadores · 90% de notas iguais"` (com perfil nulo, só o `sampleSize` de hoje).
4. `agreement-matrix-table.tsx`:
   - `Cell` usa `cellTitle` no `title` (hoje é `sampleSize`), nos estados calculado e não
     calculável;
   - na linha "Todas as definições", a porcentagem de notas iguais fica **visível** abaixo do badge
     (`text-[11.5px] text-muted`, "90% iguais"). Nas células comuns fica só no `title`, para a matriz
     não dobrar de altura.
5. **(TDD, integração)** `rounds/page.int.test.ts`: o markup da matriz contém "% iguais" na linha
   nova e o `title` com notas iguais numa célula comum.
6. Verificar no preview, com o mouse sobre uma célula; 375 px.
7. `npm run lint`, `npx tsc --noEmit`, `npm test`.

Fora: aviso de notas concentradas por célula (D4 vale só para o painel).
