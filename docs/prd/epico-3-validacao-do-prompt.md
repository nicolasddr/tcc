# Épico 3: Validação do prompt (Fase 3)


## Resumo

O Épico 2 entregou a Fase 2 inteira. O Administrador escreve descrições e critérios, abre rodadas,
gera respostas, os avaliadores avaliam, a ferramenta calcula o ICR, a equipe discute as divergências
e o codebook é refinado até a concordância subir. No fim, o Administrador avança o projeto para a
Fase 3. Chegando lá, nada muda. A Fase 3 é, hoje, só um número na barra de fases.

Pior do que não ter nada é o que acontece se o Administrador tentar trabalhar. Um projeto na Fase 3
consegue abrir rodada e gerar respostas, porque a abertura de rodada só recusa as fases anteriores à
2. Só que a geração continua mandando à LLM o prompt com os títulos das definições, exatamente como
na Fase 2. As respostas saem, os avaliadores avaliam, o ICR é calculado, e nada daquilo é a Fase 3:
o codebook completo nunca chegou à LLM. O dado parece certo e mede outra coisa.

Falta também a outra metade da pergunta da fase. Na Fase 2 o que interessa é se os avaliadores
aplicam o codebook da mesma forma. Na Fase 3, quando eles concordam, a pergunta seguinte é se a LLM
está produzindo o que o codebook pede, e isso aparece nas notas: muita nota em Alto indica que a LLM
segue o codebook, muita nota em Médio e Baixo indica que não segue. A ferramenta calcula a
concordância, mas não mostra essa distribuição em lugar nenhum.

E a ferramenta não guarda o texto que de fato foi à LLM. Cada Resposta grava as versões de prompt e
de codebook, mas a forma de montar a entrada vive no código. Na Fase 2 isso era tolerável, porque a
montagem era trivial. Na Fase 3 ela passa a carregar o codebook inteiro, e se o formato mudar depois,
uma resposta antiga deixa de ser reproduzível só pelas versões.

## Solução

A Fase 3 ganha o seu ciclo próprio, que reaproveita toda a mecânica de rodada da Fase 2 e muda três
coisas: o que vai à LLM, o que o Administrador consegue ler depois da rodada e o que fica gravado em
cada Resposta.

1. A **rodada passa a pertencer à fase em que foi criada**. É essa fase, e não a fase atual do
   projeto, que decide como a entrada é montada. A forma de montar congela com a rodada, junto com
   as versões de codebook e de prompt que ela já congelava.
2. Uma rodada da Fase 3 envia à LLM o **prompt com o codebook completo**: o título e a descrição de
   cada definição, os critérios específicos dela logo abaixo, e os critérios gerais num bloco único.
   O tipo da definição não vai, e a escala também não.
3. Cada Resposta nova grava a **entrada enviada**, o texto exato que foi à LLM, já montado.
4. O **teste de prompt** passa a montar a entrada pela fase atual do projeto e mostra essa entrada
   junto com a saída. Na Fase 3 ele é o jeito de ver "o codebook é o prompt" antes de gastar uma
   rodada.
5. A ferramenta mostra a **Qualidade** das rodadas da Fase 3: a porcentagem de notas em Alto, Médio e
   Baixo, na rodada inteira, por célula e numa série entre as rodadas da fase. Ela não diz se a
   qualidade está boa. Não há regra de "resposta que atinge os critérios", não há meta e não há cor
   de aprovado. Quem julga é o Administrador.
6. A ferramenta **orienta a leitura pelo ICR**, que é o único número com régua. Com o ICR abaixo da
   faixa de referência, os avaliadores não estão aplicando o codebook da mesma forma, e a indicação é
   refinar o codebook. Com o ICR dentro da faixa, eles concordam, e a indicação é olhar a Qualidade:
   notas concentradas em Médio e Baixo querem dizer que a LLM não está seguindo o codebook. A
   ferramenta nunca diz que é hora de avançar.
7. Cada rodada mostra **o que mudou em relação à anterior**: versão do codebook, versão do prompt e
   fase. Quando codebook e prompt mudaram juntos, um aviso escrito lembra que não dá para atribuir a
   diferença a um nem ao outro.
8. Quando o Administrador julgar que a qualidade basta, ele **avança para a Fase 4**, com as mesmas
   regras do avanço anterior: nenhuma rodada aberta, ao menos uma rodada fechada na Fase 3, e nenhum
   número trava nada.

Para o Avaliador nada muda. Ele continua aplicando o codebook a uma resposta, na mesma tela, e não vê
nem o ICR nem a Qualidade.

## Histórias de Usuário


### Composição da entrada

**1.** Como Administrador de Projeto, quero que as respostas geradas numa rodada da Fase 3 recebam o
codebook completo, para que a Fase 3 meça de fato o codebook como prompt.

- A entrada de uma rodada da Fase 3 é o prompt seguido do codebook completo e do item de entrada
- O codebook completo traz, para cada definição, o título, a descrição e os critérios específicos
  (nome e descrição), na ordem em que aparecem no codebook
- Os critérios gerais aparecem uma vez só, num bloco próprio, e não repetidos em cada definição
- Definição sem descrição aparece só com o título, sem linha vazia no lugar da descrição
- O tipo da definição não vai à LLM
- A escala não vai à LLM, em nenhuma fase

**2.** Como Administrador de Projeto, quero que as rodadas da Fase 2 continuem enviando só os
títulos, para que a série de rodadas continue comparável e o passado não mude.

- Uma rodada da Fase 2 monta a entrada com o prompt, os títulos e o item, como sempre montou
- Nenhuma rodada existente muda de forma de montagem por causa deste épico

**3.** Como Administrador de Projeto, quero que a forma de montar a entrada seja decidida pela fase
em que a rodada foi criada, para que uma rodada nunca mude de natureza no meio do caminho.

- A rodada grava a fase do projeto no momento em que é criada
- A geração consulta a fase da rodada, e não a fase atual do projeto
- As rodadas criadas antes deste épico ficam registradas como Fase 2, porque é o que elas enviaram
- Como o avanço de fase exige que não haja rodada aberta, uma rodada nunca atravessa uma troca de fase

**4.** Como Administrador de Projeto, quero ver na lista de rodadas a qual fase cada uma pertence, para
que eu leia o histórico sabendo o que cada rodada enviou à LLM.

- Cada rodada aparece com a sua fase ao lado do número
- A tela da rodada diz, em uma frase, o que foi enviado à LLM naquela fase


### Entrada enviada

**5.** Como Administrador de Projeto, quero que cada Resposta grave o texto exato enviado à LLM, para
que qualquer resposta possa ser reproduzida mesmo que a forma de montar a entrada mude um dia.

- A entrada enviada é gravada junto com o texto da resposta, na mesma escrita
- Vale para toda resposta gerada a partir deste épico, em qualquer fase
- As respostas geradas antes deste épico ficam sem entrada enviada, e a tela diz isso em vez de
  mostrar um campo vazio
- Uma falha de geração não grava nada, nem a entrada enviada

**6.** Como Administrador de Projeto, quero ler a entrada enviada de uma resposta, para que eu
confira o que a LLM de fato recebeu quando uma resposta me surpreender.

- A entrada aparece na leitura da resposta, recolhida por padrão, porque é longa
- Só o Administrador vê a entrada enviada
- O texto aparece como foi enviado, sem formatação adicional


### Teste de prompt

**7.** Como Administrador de Projeto, quero que o teste de prompt monte a entrada pela fase atual do
projeto, para que na Fase 3 eu veja o codebook completo funcionando antes de abrir uma rodada.

- Nas Fases 1 e 2 o teste envia o prompt com os títulos
- Na Fase 3 o teste envia o prompt com o codebook completo
- O teste continua sem gravar nada: sem Resposta, sem Rodada, sem congelar versão

**8.** Como Administrador de Projeto, quero ver no teste de prompt a entrada que foi enviada, junto com
a saída, para que eu entenda exatamente o que a LLM recebeu.

- A entrada aparece acima da saída, recolhida por padrão
- A entrada mostrada é a mesma que uma rodada daquela fase enviaria para aquele item
- O teste continua sujeito ao teto de respostas do projeto, como hoje


### Qualidade

**9.** Como Administrador de Projeto, quero ver a distribuição de Alto, Médio e Baixo das notas de uma
rodada da Fase 3, para que eu julgue se a LLM está produzindo o que o codebook pede.

- A distribuição aparece como porcentagem de cada ponto da escala sobre todas as notas da rodada
- Cada porcentagem vem com a contagem ao lado, para que o denominador fique à vista
- A Qualidade aparece onde o ICR já aparece para o Administrador, ao lado dele e separada dele
- A ferramenta não escreve nenhum juízo sobre o valor: nada de "boa", "ruim", "aprovada" ou cor que
  signifique isso

**10.** Como Administrador de Projeto, quero ver a Qualidade por célula, para que eu descubra em que
definição e em que critério a LLM não está seguindo o codebook.

- A matriz tem a mesma forma da matriz de ICR: definições nas linhas, critérios nas colunas, critério
  geral valendo para todas as definições
- Cada célula mostra a distribuição das notas dela
- O par definição e critério que não existe naquela versão aparece como não aplicável
- A célula que existe e ainda não recebeu nota aparece como sem nota

**11.** Como Administrador de Projeto, quero ver a Qualidade ao longo das rodadas da Fase 3, para que eu
saiba se o que refinei entre uma rodada e outra ajudou.

- A série tem um ponto por rodada da Fase 3, com as três porcentagens
- Cada ponto mostra a versão de codebook e a versão de prompt daquela rodada
- Nada é somado nem tirado a média entre rodadas

**12.** Como Administrador de Projeto, quero que a Qualidade respeite a marca de Outlier, para que a
exclusão de um avaliador seja tratada do mesmo jeito nos dois números.

- Com algum avaliador marcado na rodada, a Qualidade aparece com todos e sem os marcados, juntas
- O valor com todos nunca é escondido nem substituído
- Sem marca, aparece um valor só

**13.** Como Administrador de Projeto, quero que a Qualidade não apareça nas rodadas da Fase 2, para
que o número não me distraia numa fase em que a pergunta é outra.

- Rodadas da Fase 2 continuam mostrando só o ICR
- A comparação entre a última rodada da Fase 2 e as da Fase 3 fica possível pela exportação

**14.** Como Avaliador, quero não ver a Qualidade, para que minha nota não seja puxada pelo que eu
imagino que o grupo está dando.

- Nenhuma tela do Avaliador mostra a Qualidade, nem durante a rodada nem depois do fechamento
- A revisão de discordâncias continua mostrando as notas uma a uma, como hoje, sem porcentagem


### Série de ICR entre fases

**15.** Como Administrador de Projeto, quero ver o ICR das Fases 2 e 3 numa série só, para que eu veja o
efeito de mandar o codebook à LLM sobre a concordância.

- A série continua com um ponto por rodada, agora com a fase ao lado da versão de codebook
- As rodadas de cada fase aparecem agrupadas visualmente
- A regra de nunca agregar versões diferentes de codebook continua valendo ponto a ponto


### Orientação e mudanças entre rodadas

**16.** Como Administrador de Projeto, quero que a ferramenta me diga para onde olhar depois de uma
rodada da Fase 3, com base no ICR, para que eu siga a ordem de leitura da fase sem decorar o método.

- Com o ICR abaixo da faixa de referência, a orientação diz que os avaliadores não estão aplicando o
  codebook da mesma forma e que o caminho é refinar o codebook antes de olhar a Qualidade
- Com o ICR não calculável, a orientação diz por que não há número e que a Qualidade ainda não é uma
  leitura confiável
- Com o ICR dentro da faixa, a orientação diz que os avaliadores concordam e que é hora de olhar a
  Qualidade: notas concentradas em Médio e Baixo indicam que a LLM não está seguindo o codebook, e o
  refinamento pode ser no prompt, no codebook ou nos dois
- A orientação lembra que mexer no codebook para ajudar a LLM também muda o que os avaliadores leem
- Em nenhum caso a orientação menciona a Fase 4 ou diz que é possível avançar
- A Qualidade continua visível nos três casos; a orientação não esconde nada

**17.** Como Administrador de Projeto, quero ver o que mudou de uma rodada para a seguinte, para que eu
saiba a que atribuir uma diferença no ICR ou na Qualidade.

- Cada rodada, a partir da segunda do projeto, diz se a versão do codebook mudou, se a versão do
  prompt mudou e se a fase mudou em relação à rodada anterior
- Na primeira rodada da Fase 3 a tela diz que a mudança principal foi a forma de montar a entrada, que
  passou a levar o codebook completo
- Quando codebook e prompt mudaram juntos, um aviso escrito diz que não dá para atribuir a diferença a
  um nem ao outro
- O aviso é informação e não impede abrir a rodada

**18.** Como Administrador de Projeto, quero refinar o prompt e o codebook na Fase 3 do mesmo jeito que
refinava o codebook na Fase 2, para que o ciclo seja um só.

- Com rodada aberta, codebook e prompt continuam travados
- Depois do fechamento, salvar sobre uma versão congelada cria a versão seguinte, como hoje
- Nenhuma trava nova depende do valor do ICR ou da Qualidade


### Exportação

**19.** Como Administrador de Projeto, quero que o CSV da rodada traga a fase da rodada e a entrada
enviada, para que a análise por fora da ferramenta consiga separar as fases e reproduzir cada
resposta.

- Cada linha ganha a fase da rodada
- Cada linha ganha a entrada enviada da resposta, vazia nas respostas anteriores a este épico
- Entrada com quebra de linha, vírgula ou aspas não quebra o arquivo
- É no CSV que fica a comparação de Qualidade entre a Fase 2 e a Fase 3, já que a tela não mostra
  Qualidade na Fase 2


### Avanço para a Fase 4

**20.** Como Administrador de Projeto, quero avançar para a Fase 4 quando eu julgar que o prompt está
validado, para que a decisão continue sendo minha.

- O avanço exige nenhuma rodada aberta e ao menos uma rodada fechada na Fase 3
- Rodadas fechadas da Fase 2 não contam para essa pré-condição
- Nenhum valor de ICR ou de Qualidade impede o avanço
- A checagem acontece no servidor

**21.** Como Administrador de Projeto, quero que a ferramenta diga o que falta quando o avanço para a
Fase 4 está bloqueado, para que eu não fique olhando um botão desabilitado.

- A mensagem nomeia a pré-condição que falta: a rodada aberta, com o número dela, ou a falta de rodada
  fechada na Fase 3
- A mensagem segue o mesmo formato das mensagens do avanço da Fase 2

**22.** Como Administrador de Projeto, quero uma confirmação antes de avançar, com o ICR e a Qualidade da
última rodada da Fase 3 à vista, para que eu decida olhando os números sem que eles decidam por mim.

- A confirmação mostra o ICR com a faixa de referência e a distribuição da Qualidade, como informação
- A confirmação diz o que a Fase 4 é no processo e que ela congela codebook e prompt enquanto durar
- A confirmação não fala em voltar da Fase 4 para a Fase 3, porque essa ação ainda não existe
- Cancelar não muda nada

**23.** Como Administrador de Projeto, quero que as rodadas da Fase 3 continuem visíveis depois do
avanço, para que o histórico da fase fique disponível.

- Rodadas, notas, ICR, Qualidade, marcas de outlier e anotações da Fase 3 continuam onde estão
- O painel de avanço da Fase 3 mostra que a fase foi concluída e não oferece avanço de novo

**24.** Como Administrador de Projeto, quero que a ferramenta não me deixe abrir rodada na Fase 4 enquanto
a Fase 4 não existir, para que eu não produza dado que parece da Fase 4 e não é.

- Abrir rodada num projeto na Fase 4 é recusado com uma mensagem que diz que a Fase 4 ainda não está
  disponível
- A recusa acontece no servidor


### Acesso e autorização

**25.** Como Administrador de Projeto, quero que só eu possa ver a entrada enviada, a Qualidade e a
orientação, e avançar de fase, para que nada disso chegue ao Avaliador por engano.

- As ações de avanço e de leitura da entrada enviada recusam quem tem só o vínculo de avaliador
- Quem não é membro do projeto não alcança nenhuma dessas telas

**26.** Como Avaliador, quero avaliar na Fase 3 exatamente como avaliei na Fase 2, para que a tarefa
continue sendo aplicar o codebook a uma resposta.

- A tela de avaliação não diz em que fase o projeto está
- A tela não diz que a LLM recebeu o codebook
- Fila, rótulo da resposta, escala, justificativa e envio imutável continuam iguais


## Requisitos Não Funcionais


### Integridade e rastreabilidade

- A fase da rodada é gravada na criação e nunca muda depois.
- A entrada enviada é gravada na mesma escrita que o texto da resposta. Não existe resposta nova sem
  entrada enviada.
- A entrada enviada guardada é exatamente a que foi passada à LLM, sem nenhuma normalização entre uma
  coisa e outra.
- Nenhum cálculo de Qualidade é gravado. Ela é derivada das notas na leitura, como o ICR.

### Desempenho e custo

- Uma resposta da Fase 3 é mais cara do que uma da Fase 2, porque leva o codebook inteiro em cada
  chamada. O teto continua contando respostas, e não tokens nem dinheiro. É um risco conhecido e
  aceito, menor do que a dívida que o teto já tem de guardar a contagem em memória por processo.
- A entrada enviada acrescenta alguns KB por resposta. Com o tamanho típico de rodada, isso é
  desprezível.

### Usabilidade e interface

- A Qualidade usa as mesmas palavras da escala (Alto, Médio, Baixo) e nunca palavras de juízo.
- A orientação é texto, não bloqueio. Nenhum botão fica desabilitado por causa dela.
- A entrada enviada aparece recolhida, porque é longa e é consultada só quando algo surpreende.

### Segurança

- Toda ação nova checa o papel na camada de aplicação, com o ator vindo da sessão.
- Nenhuma tela do Avaliador recebe dados de Qualidade, nem escondidos. A garantia é o fluxo de
  controle da página não buscar esses dados para ele, como já acontece com o ICR.


## Decisões de Implementação


### Rodada

- A tabela de rodadas ganha a coluna de fase, obrigatória, com CHECK para as fases em que rodada
  existe. A migration preenche as rodadas existentes com 2, que é a verdade sobre o que elas
  enviaram: só os títulos. Isso vale inclusive para uma rodada que tenha sido aberta com o projeto já
  na Fase 3 antes deste épico.
- A criação da rodada grava a fase lida na mesma transação que já trava a linha do projeto e congela
  as versões. Como o avanço de fase trava a mesma linha e exige que não haja rodada aberta, não existe
  corrida entre abrir rodada e avançar.
- A pré-condição de abrir rodada passa a recusar também a Fase 4, com mensagem própria, até o épico da
  Fase 4 existir.

### Composição da entrada

- A função pura que monta a entrada passa a receber a fase e o codebook, e não só os títulos. Com
  fase 2 ela produz exatamente o texto de hoje, byte a byte. Com fase 3 ou maior, produz o prompt, o
  bloco do codebook completo e o item.
- No bloco do codebook completo, cada definição aparece com título, descrição quando existe e os
  critérios específicos dela, na ordem do codebook. Os critérios gerais vêm depois, num bloco com
  cabeçalho próprio, uma vez só. O tipo e a escala não entram.
- A geração lê a fase da rodada e a versão de codebook congelada por ela, carrega descrições e
  critérios dessa versão e monta a entrada. O teste de prompt faz o mesmo com a fase atual do projeto
  e a versão vigente.
- O módulo de LLM não muda. Ele continua recebendo um texto e devolvendo texto, modelo e versão.

### Resposta

- A tabela de respostas ganha a coluna de entrada enviada, anulável, porque as respostas anteriores a
  este épico não a têm. Toda resposta gerada a partir daqui a preenche.
- Não há CHECK de tamanho na entrada enviada. Ela é composta de partes que já têm limite próprio
  (prompt, descrições, critérios, item), e o texto não vem do usuário.

### Qualidade

- Função pura nova, ao lado das de concordância, que recebe as notas de uma rodada e devolve a
  contagem e a porcentagem de cada ponto da escala. Uma segunda função devolve o par com todos e sem
  os marcados, no mesmo desenho do par de ICR. A matriz por célula e a série reaproveitam a estrutura
  que já existe para o ICR, trocando o coeficiente pela distribuição.
- A Qualidade é calculada na leitura, a partir das mesmas notas que o ICR já carrega. Não há tabela,
  coluna nem cache.
- A página só busca e calcula a Qualidade quando a rodada é da Fase 3 e quem está vendo é o
  Administrador.

### Orientação

- Função pura que recebe o ICR da rodada (calculável ou não, e o valor) e devolve qual texto de
  orientação mostrar, usando a faixa de referência que já é constante da aplicação. Ela não recebe
  Qualidade. Assim como no avanço da Fase 2, a impossibilidade de a Qualidade virar veredito é
  estrutural: não existe caminho por onde ela chegaria à decisão do texto.

### Mudanças entre rodadas

- Função pura que recebe a rodada e a anterior (por número, dentro do projeto, atravessando fases) e
  devolve se mudou o codebook, se mudou o prompt, se mudou a fase, e se codebook e prompt mudaram
  juntos. A comparação é pela versão congelada de cada rodada.

### Avanço de fase

- A ação de avanço ganha o ramo da Fase 3 para a 4. As pré-condições são uma função pura no mesmo
  desenho da Fase 2, recebendo o número da rodada aberta, se houver, e a contagem de rodadas fechadas
  na Fase 3. Ela não recebe ICR nem Qualidade.
- A contagem de rodadas fechadas passa a filtrar pela fase da rodada, o que resolve o recorte que o
  avanço da Fase 2 deixou registrado como pendência.
- O avanço não congela nada, não fecha rodada, não notifica ninguém e não apaga nada.

### Exportação

- O CSV por rodada ganha duas colunas: fase da rodada e entrada enviada. A entrada se repete em cada
  nota da mesma resposta, porque o formato longo exige linha autossuficiente.

### Telas

- A Qualidade entra no painel onde o ICR já aparece para o Administrador, na tela de rodadas e na
  visão geral do projeto, como bloco separado.
- A lista de rodadas e a tela da rodada ganham a fase. A tela da rodada ganha as mudanças em relação à
  anterior e a orientação, esta só nas rodadas da Fase 3.
- A leitura da resposta ganha a entrada enviada, recolhida. O teste de prompt ganha a entrada, também
  recolhida.
- O painel de avanço da Fase 3 segue o desenho do painel da Fase 2.


## Testing Decisions

Um bom teste aqui prova comportamento observável pela borda do sistema: dado um estado de banco e um
ator, chamar a ação produz o efeito certo ou o erro certo, e o dado que ficou gravado é o que a
metodologia exige. Ele não olha nome de função interna, ordem de query nem estrutura de componente.

### Costuras

Não nasce costura nova. O épico usa as que já existem:

- **Server Actions**, onde está a regra e a autorização: criar rodada, gerar respostas, teste de
  prompt, avanço de fase e exportação.
- **O módulo de LLM falso** dos testes de geração e de teste de prompt, que agora também serve para
  capturar o texto recebido e provar o que foi enviado.
- **Funções puras**, no padrão das de concordância, par de outliers e série: composição da entrada,
  distribuição de Qualidade e o par com e sem outliers, mudanças entre rodadas, pré-condições da Fase
  3 e escolha da orientação.
- **Testes de página**, para provar o que cada papel vê.

### O que será testado

- **Composição, em teste unitário**: com fase 2, a saída é idêntica à de hoje; com fase 3, traz
  títulos, descrições e critérios específicos na ordem do codebook e os gerais uma vez só; definição
  sem descrição não deixa linha vazia; tipo e rótulos da escala nunca aparecem.
- **Criar rodada**: grava a fase do projeto; na Fase 4 é recusado com a mensagem própria; o avaliador
  é barrado.
- **Gerar respostas**: numa rodada da Fase 2 a LLM falsa recebe só os títulos; numa rodada da Fase 3
  recebe o codebook completo da versão congelada pela rodada, e não da versão vigente; a entrada
  gravada na resposta é igual à que a LLM falsa recebeu; falha não grava entrada nenhuma.
- **Teste de prompt**: na Fase 2 envia os títulos, na Fase 3 envia o codebook completo; devolve a
  entrada junto com a saída; continua sem gravar nada.
- **Qualidade, em teste unitário**: porcentagens e contagens corretas; rodada sem nota; par com e sem
  outliers; matriz com não aplicável e sem nota; série só com rodadas da Fase 3.
- **Orientação, em teste unitário**: abaixo da faixa, não calculável e dentro da faixa escolhem os
  três textos; nenhum texto menciona a Fase 4.
- **Mudanças entre rodadas, em teste unitário**: só codebook, só prompt, os dois, nenhum, e a troca
  de fase entre a última rodada da Fase 2 e a primeira da Fase 3.
- **Avanço da Fase 3**: recusa com rodada aberta; recusa sem rodada fechada na Fase 3, mesmo havendo
  rodadas fechadas da Fase 2; avança com ICR baixo e com Qualidade concentrada em Baixo, provando que
  número não trava; segunda chamada devolve fase errada; avaliador barrado.
- **Exportação**: as colunas de fase e de entrada enviada batem com o banco; entrada com vírgula,
  aspas e quebra de linha sai escapada; resposta antiga sai com a entrada vazia.
- **Páginas**: o Administrador vê a Qualidade numa rodada da Fase 3 e não a vê numa da Fase 2; nenhuma
  tela do Avaliador mostra Qualidade nem entrada enviada; a tela de avaliação é igual nas duas fases.
- **Migration**: rodadas existentes aparecem como Fase 2 depois dela.

### Prior art

Os testes de integração de ação seguem o desenho que o projeto já usa: sessão simulada pelos helpers
de teste, fixtures pelo executor de dono e limpeza no final. Os mais próximos são os de geração de
respostas e de teste de prompt, que já trocam o módulo de LLM por um falso, e os de avanço da Fase 2,
que já provam que o coeficiente não trava. Os unitários seguem os de par de outliers, de série, de
matriz de concordância e de pré-condições de rodada. Os testes de página seguem os da tela de rodadas
e os da tela de avaliação, que já provam que o Avaliador não vê coeficiente.


## Out of Scope

Fora deste épico, com motivo:

- **A Fase 4 em si**: coorte nova de avaliadores, congelamento de codebook e prompt durante a fase,
  rodada da Fase 4 e retorno da Fase 4 para a Fase 3. É épico próprio. Este épico só leva o projeto
  até a porta e impede rodada lá dentro enquanto ela não existir.
- **Meta de qualidade**, inclusive a declarada pelo próprio Administrador antes de ver os dados. Uma
  linha desenhada ao lado do número vira veredito na prática.
- **Qualquer regra de "resposta que atinge os critérios"**, como mediana por célula ou nenhuma célula
  em Baixo. Esse julgamento é do Administrador.
- **Qualidade nas rodadas da Fase 2**. A comparação fica pelo CSV.
- **LLM como avaliadora**. A recomendação em registro é tratá-la como lente separada, e isso pede
  épico próprio.
- **Saída estruturada da Resposta**, por definição.
- **Colar resposta manualmente**, prevista na ADR 0003. Na Fase 3 ela é ainda menos desejável, porque
  a integridade entre prompt e resposta é justamente o que a geração ao vivo garante.
- **Anonimização dos avaliadores** na revisão de discordâncias.
- **Teto por token ou por custo**. O teto continua contando respostas.
- **Reconstruir a entrada enviada das respostas antigas**. Elas ficam sem, e a tela diz isso.

Fora do projeto por decisões anteriores que continuam valendo: chave de API trazida pelo usuário,
escolha de modelo ou de outra LLM, retorno da Fase 3 para a Fase 2, reabrir rodada fechada, escala
configurável e partição de itens entre conjuntos reservados.


## Further Notes

**A ordem de leitura da Fase 3.** É a decisão que dá forma ao épico e vale escrever por extenso. ICR
baixo quer dizer que os avaliadores não estão entendendo as definições da mesma forma: um marca Alto,
outro Médio, outro Baixo na mesma célula. Aí o problema é o codebook, e refina-se o codebook. ICR alto
quer dizer que eles entendem da mesma forma, e só então a Qualidade vira uma leitura confiável. Se as
notas estão concentradas em Médio e Baixo, os avaliadores concordam entre si, mas a LLM não está
seguindo o codebook. Se estão em Alto, está tudo certo e o Administrador pode seguir para a Fase 4. A
ferramenta orienta essa ordem e nunca a impõe.

**Por que a ferramenta não julga a Qualidade.** Para o ICR existe uma faixa de referência da
literatura. Para a Qualidade não existe convenção: o 75% do Shah é do caso dele. Qualquer regra
embutida seria a ferramenta decidindo o que é bom o bastante numa tarefa que ela não conhece, e ela é
agnóstica de tarefa por decisão (ADR 0005). Mostrar a distribuição, com os denominadores, e deixar o
juízo com quem conhece a tarefa é o que a ferramenta pode fazer com honestidade.

**Por que a rodada grava a fase.** A rodada já congelava duas coisas, a versão de codebook e a de
prompt, para que o que os avaliadores estão aplicando não mude debaixo deles. A forma de montar a
entrada é o terceiro ingrediente do mesmo congelamento. Se a geração consultasse a fase atual do
projeto, uma mesma rodada poderia ter respostas de naturezas diferentes. Hoje o avanço de fase já
impede isso, porque exige rodada fechada, mas depender dessa coincidência seria frágil. A mesma coluna
resolve o recorte de rodadas por fase que o avanço da Fase 3 para a 4 precisa.

**O problema de hoje.** Enquanto este épico não sai, um projeto na Fase 3 consegue abrir rodada e gera
respostas só com os títulos. A primeira fatia do épico deveria ser a que grava a fase na rodada e
muda a composição, justamente para fechar isso antes de qualquer tela nova.

**Documentos de domínio atualizados junto com este spec.** O glossário recebeu a nova definição de
Qualidade (distribuição, sem veredito, invisível ao Avaliador, respeitando outliers, só na Fase 3), a
correção de Refinar (que falava em "itens", palavra que é do item de entrada), o termo Entrada enviada,
a Rodada pertencendo à fase em que nasceu, o teste de prompt montando pela fase atual, a escala nunca
indo à LLM e a série de ICR única entre as Fases 2 e 3. Três ADRs receberam emenda: a 0002 (forma do
codebook completo, fase da rodada e entrada enviada), a 0004 (Qualidade só como distribuição, sem meta
e sem "atinge") e a 0011 (a Qualidade segue as mesmas regras de visibilidade e de outlier do ICR). A
pasta de ADRs continua fora do versionamento, então as emendas existem só localmente.
