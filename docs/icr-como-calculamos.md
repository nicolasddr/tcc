# Concordância (ICR): como a ferramenta calcula

Descrição do cálculo da concordância entre avaliadores (ICR) como está implementado no código da
ferramenta. Os caminhos entre crases são os arquivos do repositório onde cada parte vive.

## 1. Métrica

A concordância é medida pelo **Alpha de Krippendorff no nível ordinal**, implementado na própria
ferramenta, sem biblioteca externa (`lib/agreement.ts`).

O Kappa de Cohen não é usado. O Alpha cobre também o caso de dois avaliadores, não exige
comparação par a par, aceita qualquer número de avaliadores e trata avaliações ausentes como dado
faltante.

## 2. Montagem das observações

Feita em `app/projects/[id]/(tabs)/rounds/agreement.ts`:

- **Escala → posto:** Alto = 3, Médio = 2, Baixo = 1 (`app/projects/[id]/(tabs)/evaluate/scale.ts`).
  A escala é fixa de três pontos (ADR 0010).
- **Unidade de análise:** resposta × definição × critério. A mesma resposta avaliada em duas
  células (definição × critério) rende duas unidades, e não uma.
- **Avaliador:** o membro do projeto que enviou a avaliação.
- **Recorte:** uma rodada por vez, só com as notas daquela rodada. Cada rodada fixa uma versão do
  codebook, e o coeficiente nunca é agregado entre versões diferentes.

## 3. O cálculo

1. As notas são agrupadas por unidade. **Unidades com menos de duas notas saem do cálculo, e o
   avaliador continua nele.** Avaliação que não existe é dado faltante, nunca exclusão de avaliador.
2. **Matriz de coincidências.** Em cada unidade *u* com *mᵤ* notas, cada par ordenado de notas
   (i ≠ j) soma `1 / (mᵤ − 1)` na posição `o[c][k]`, em que *c* e *k* são os valores do par.
3. **Marginais.** `n_c = Σ_k o[c][k]` e `n = Σ_c n_c` (total de valores pareáveis).
4. **Distância ordinal ao quadrado**, entre os valores *c* e *k*:

   ```
   δ²(c, k) = ( Σ_{g=c}^{k} n_g  −  (n_c + n_k) / 2 )²
   ```

5. **Coeficiente:**

   ```
   α = 1 − (n − 1) · Σ_{c,k} o_ck · δ²(c,k)  /  Σ_{c,k} n_c · n_k · δ²(c,k)
   ```

   o que equivale a `α = 1 − D_o / D_e`, com
   `D_o = (1/n) Σ o_ck δ²` (discordância observada) e
   `D_e = 1 / (n(n − 1)) Σ n_c n_k δ²` (discordância esperada).

**Validação.** Os testes do módulo (`lib/agreement.unit.test.ts`) reproduzem o valor publicado em
Krippendorff (2011), *Computing Krippendorff's Alpha-Reliability*: matriz de 4 observadores por 12
unidades, alpha ordinal = 0,815. Os testes também cobrem uma distribuição degenerada em que 80% de
concordância percentual resulta em α = −1/18, o que mostra por que as notas iguais aparecem ao lado
do alpha, e nunca no lugar dele.

## 4. Quando o coeficiente não é calculável

O resultado é **não calculável**, e nunca vira 0 nem 1, em três casos:

| Caso | Condição |
|---|---|
| Poucos avaliadores | menos de dois avaliadores na rodada |
| Sem unidades em comum | nenhuma unidade avaliada por pelo menos dois avaliadores |
| Sem variação | todas as notas no mesmo ponto da escala (D_e = 0) |

### 4.1 Notas iguais e distribuição

Quando quase toda nota cai num nível só, a discordância esperada ao acaso (D_e) fica perto de zero,
e uma divergência só já derruba o alpha, mesmo com os avaliadores quase sempre de acordo (paradoxo
da prevalência). Para ler esse caso, o painel da rodada mostra dois números **ao lado** do alpha,
calculados sobre os mesmos valores pareáveis que ele usa (`agreementProfile` em
`lib/agreement.ts`), pela matriz de coincidências da seção 3:

- **notas iguais** = `Σ_c o[c][c] / n`. Com dois avaliadores, é a parte das unidades em que os dois
  deram o mesmo nível; com mais, cada par pesa `1 / (mᵤ − 1)`, como no alpha;
- **distribuição** = `n_c / n` para cada nível, sempre com Alto, Médio e Baixo, inclusive 0%.

Da mesma matriz saem as **divergências adjacentes** (`Σ o[c][k] / n` com `|c − k| = 1`, Alto com
Médio ou Médio com Baixo) e as **divergências extremas** (`|c − k| ≥ 2`, Alto com Baixo). As três
partes somam 100%. Como as notas iguais, contam por par: com dois avaliadores, batem com a
classificação de cada unidade na revisão de discordâncias; com mais, uma unidade com Alto, Alto e
Baixo pesa um terço como igual e dois terços como extrema, enquanto a revisão a chama de extrema
inteira. Elas aparecem só na tabela por critério.

Unidades com uma nota só ficam fora, como no alpha, e os números batem com o N mostrado. Sem unidade
pareável não há números. Com a rodada sem variação (seção 4), eles aparecem mesmo assim e explicam o
"não calculável". Com avaliador marcado como outlier, cada valor ("com todos" e "sem os marcados")
traz os seus.

Os dois números não substituem o alpha, não entram na série nem na faixa de referência, e o
Avaliador não os vê (ADR 0011).

**Aviso de notas concentradas** (`rounds/agreement-labels.ts`): o painel avisa quando o alpha é
calculável, está na faixa questionável (abaixo de 0,667) e as notas iguais são 80% ou mais. O aviso
cita o nível de maior parte e as duas porcentagens. O corte de 80% é convenção da ferramenta, e não
da literatura.

## 5. Onde o número aparece

- **Coeficiente da rodada** (`rounds/agreement-pair.ts`). Se há avaliadores marcados como outlier
  naquela rodada, a ferramenta mostra dois valores lado a lado: **com todos**, que é o resultado
  da rodada, e **sem os marcados**, que refaz a conta retirando as notas de quem foi marcado. A
  marca é por rodada, exige justificativa escrita, é reversível e nenhuma nota é apagada (ADR 0011).
- **Matriz por célula** (`rounds/agreement-matrix.ts`). Um alpha por par definição × critério,
  sempre calculado **com todos**. A matriz distingue três estados sem coeficiente:
  - *não aplicável*: o par não existe naquela versão do codebook (critério específico de outra
    definição);
  - *sem nota*: a célula existe e ninguém a avaliou ainda;
  - *não calculável*: a célula tem nota e não tem coeficiente (um dos casos da seção 4).

  Na tela, a matriz fica recolhida em *Ver por definição*, abaixo da tabela por critério.
- **Por critério** (`rounds/agreement-matrix.ts`, `criterionCells`). A seção de Concordância abre
  com uma tabela de uma linha por critério, na ordem das colunas da matriz. Cada linha traz um
  alpha calculado sobre todas as notas daquele critério na rodada: as de todas as definições, no
  critério geral; as das definições que têm o critério, nos critérios específicos de mesmo nome; e
  as da resposta inteira, no critério por resposta. As unidades continuam as mesmas: cada nota só
  se compara com as da mesma resposta e da mesma definição. É um alpha sobre essas notas, e **não
  a média** dos alphas das células, e também é calculado **com todos**. A tabela aparece mesmo com
  uma definição só, e traz ao lado do alpha as notas iguais, a distribuição pelos níveis, as
  divergências adjacentes e extremas e o N. É a leitura do critério quando as definições são
  posições (Query 1, Query 2…) e não textos diferentes.
- **Série entre rodadas** (`rounds/agreement-series.ts`). Um ponto por rodada, com a versão do
  codebook e a fase ao lado, também **com todos**. A série é uma só para as Fases 2, 3 e 4. **Não
  existe média, soma nem "ICR do projeto"** em tela nenhuma.
- **O Avaliador não vê o coeficiente** em tela nenhuma, nem durante a rodada nem depois do
  fechamento. A métrica, exposta a quem produz o dado dela, deixa de medir o dado (ADR 0011).

## 6. Faixas de referência e avisos

- **Faixa de referência de Krippendorff (2004):** abaixo de 0,667 é questionável, de 0,667 a 0,8
  é aceitável, e 0,8 ou mais é boa (`rounds/agreement-labels.ts`). É referência de leitura e **não
  trava nenhuma transição de fase**: o avanço é decisão do Administrador (ADR 0004).
- **Orientação de leitura nas Fases 3 e 4** (`rounds/reading-guidance.ts`):
  - na Fase 3, com alpha na faixa questionável, a ferramenta sugere refinar o codebook; da faixa
    aceitável para cima, sugere olhar a Qualidade;
  - na Fase 4 não se refina: alpha baixo indica que o codebook não generalizou para os
    avaliadores novos; alpha alto leva à Qualidade ao lado da rodada de referência.
- **Aviso de amostra pequena:** com menos de 3 avaliadores ou menos de 10 respostas avaliadas, a
  tela avisa que o coeficiente oscila muito e deve ser lido com cautela. O corte é convenção da
  ferramenta, e não da literatura, e o valor calculado continua valendo.
