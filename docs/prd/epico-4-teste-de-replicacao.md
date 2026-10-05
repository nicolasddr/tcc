# Épico 4: Teste de replicação (Fase 4)


## Resumo

O Épico 3 levou o projeto até a porta da Fase 4 e parou ali. O Administrador avança, a barra de fases
mostra o número 4, e a partir daí nada funciona: abrir rodada é recusado com uma mensagem dizendo que a
Fase 4 ainda não está disponível, e não existe caminho de volta para a Fase 3. Um projeto que avança
fica parado, sem poder testar nada e sem poder voltar a refinar.

Enquanto isso, o que a Fase 4 promete ainda não está garantido em lugar nenhum. A fase existe para
responder se o codebook generaliza, e para isso ela precisa testar exatamente o codebook e o prompt
que a Fase 3 validou. Hoje nada impede o Administrador de editar o codebook depois da última rodada da
Fase 3 e avançar mesmo assim, e nada impede que ele edite o codebook já dentro da Fase 4. Nos dois
casos a primeira rodada da Fase 4 congelaria uma versão que nenhum avaliador aplicou.

Falta também a leitura que dá sentido à fase. O resultado de uma rodada da Fase 4 só diz alguma coisa
quando comparado à rodada da Fase 3 que validou aquelas versões, e a ferramenta não faz essa ponte.
E a fase pede avaliadores novos e itens novos, mas a ferramenta só mostra em quais rodadas cada item foi
usado, sem dizer de que fase eram, e não mostra nada sobre os avaliadores.


## Solução

A Fase 4 reaproveita toda a mecânica de rodada das Fases 2 e 3 e acrescenta o que é dela: o
congelamento, a garantia de que testa o que foi validado, a comparação com a Fase 3 e o retorno.

1. **Abrir rodada na Fase 4 passa a ser possível.** A rodada grava a fase 4, envia à LLM o codebook
   completo, como na Fase 3, e segue o mesmo ciclo: geração, avaliação, ICR, Qualidade, revisão de
   discordâncias, anotações de consenso e marca de outlier. A fase pode ter várias rodadas.
2. **Codebook e prompt ficam congelados enquanto o projeto está na Fase 4.** O servidor recusa salvar
   o codebook e o texto do prompt. Os metadados do prompt, que não vão à LLM, continuam editáveis. O
   pool de itens continua crescendo, porque é dele que saem os itens novos. O teste de prompt continua
   disponível.
3. **A Fase 4 só testa o que a Fase 3 avaliou.** A última rodada fechada da Fase 3 é a *rodada de
   referência*, e as versões vigentes de codebook e prompt precisam ser as dela. A regra vale no avanço
   da Fase 3 para a 4 e de novo ao abrir cada rodada da Fase 4.
4. **A novidade de itens e de avaliadores é responsabilidade do Administrador.** A ferramenta mostra
   em quais rodadas, e de quais fases, cada item foi usado e cada avaliador já avaliou. Não recusa
   ninguém. Quem já avaliou antes e avaliou uma rodada da Fase 4 sai do cálculo pela marca de Outlier,
   que já existe.
5. **Cada rodada da Fase 4 é lida ao lado da sua rodada de referência**, com ICR e Qualidade das duas
   lado a lado e sem veredito. As séries de ICR e de Qualidade passam a incluir a Fase 4. A orientação
   pelo ICR ganha um texto próprio, que interpreta o número e nunca diz que é hora de voltar.
6. **O Administrador pode voltar da Fase 4 para a Fase 3.** O retorno só exige que não haja rodada
   aberta. Ele descongela codebook e prompt e preserva as rodadas da Fase 4 como estão.
7. **A Fase 4 não tem encerramento.** A ferramenta não declara a replicação aprovada nem muda o
   estado do projeto. Quem julga é o Administrador.

Para o Avaliador nada muda. Ele aplica o codebook a uma resposta na mesma tela de sempre, não sabe em
que fase o projeto está e não vê ICR, Qualidade nem a comparação.


## Histórias de Usuário


### Rodada na Fase 4

**1.** Como Administrador de Projeto, quero abrir rodada num projeto na Fase 4, para que eu consiga
de fato testar se o codebook generaliza.

- A recusa que o Épico 3 deixou ("a Fase 4 ainda não está disponível") deixa de existir
- A rodada grava a fase 4 na criação, como as outras gravam a sua
- A geração envia à LLM o prompt com o codebook completo, montado como na Fase 3, a partir da versão
  congelada pela rodada
- Fila do avaliador, rótulo da resposta, avaliação imutável, fechamento, revisão de discordâncias,
  anotações de consenso e marca de outlier funcionam como nas outras fases

**2.** Como Administrador de Projeto, quero poder abrir mais de uma rodada na Fase 4, para que um
fechamento precipitado ou uma segunda leva de avaliadores não me obrigue a voltar à Fase 3.

- Depois de fechar uma rodada da Fase 4, abrir a seguinte segue as mesmas regras da primeira
- Todas as rodadas da mesma passagem pela Fase 4 usam as mesmas versões de codebook e prompt

**3.** Como Administrador de Projeto, quero que abrir rodada na Fase 4 seja recusado quando as versões
vigentes não forem as da rodada de referência, para que nenhuma rodada da Fase 4 teste algo que a
Fase 3 não avaliou.

- A recusa acontece no servidor, na mesma transação que hoje cria a rodada
- A mensagem diz qual versão está diferente (codebook, prompt ou os dois, com os números) e que o
  caminho é voltar à Fase 3, abrir e fechar uma rodada com essas versões e avançar de novo
- Num projeto que avançou depois desta regra existir, a situação não acontece, porque o avanço e o
  congelamento já a impedem; a regra existe para os projetos que avançaram antes dela


### Congelamento

**4.** Como Administrador de Projeto, quero que o codebook não possa ser alterado enquanto o projeto
está na Fase 4, para que o teste de replicação meça o codebook validado e não outro.

- Salvar definição, descrição, critério ou ordem é recusado no servidor com o projeto na Fase 4
- A mensagem diz que a Fase 4 congela o codebook enquanto dura e que, para refinar, é preciso voltar
  à Fase 3
- A tela do codebook mostra o codebook em modo de leitura, com a mesma explicação, em vez de um
  formulário que falha ao salvar

**5.** Como Administrador de Projeto, quero que o texto do prompt não possa ser alterado na Fase 4, mas
que os metadados continuem editáveis, para que eu ainda consiga documentar o prompt sem mudar o que vai
à LLM.

- Salvar o texto do prompt é recusado no servidor com o projeto na Fase 4, com mensagem no mesmo
  formato da do codebook
- Nome, descrição e registro de mudanças continuam salvando normalmente

**6.** Como Administrador de Projeto, quero continuar cadastrando itens de entrada na Fase 4, para que
eu tenha itens novos para testar.

- Cadastrar item funciona em qualquer fase, como hoje
- Item já usado em rodada continua sem poder ser editado nem removido, como hoje

**7.** Como Administrador de Projeto, quero continuar usando o teste de prompt na Fase 4, para que eu
confira um item novo antes de gastar uma rodada com ele.

- Na Fase 4 o teste monta a entrada como na Fase 3, com o codebook completo da versão vigente
- O teste continua sem gravar nada


### Avanço da Fase 3 para a Fase 4

**8.** Como Administrador de Projeto, quero que o avanço para a Fase 4 exija que as versões vigentes
sejam as da última rodada fechada da Fase 3, para que eu não leve à Fase 4 uma edição que ninguém
avaliou.

- A pré-condição se soma às que já existem (nenhuma rodada aberta, ao menos uma rodada fechada na
  Fase 3)
- Se o codebook, o prompt ou os dois mudaram depois dessa rodada, o avanço é recusado no servidor
- A mensagem nomeia o que mudou, com os números das versões, e diz que o caminho é abrir e fechar mais
  uma rodada da Fase 3 com as versões novas
- O painel de avanço mostra essa pré-condição como item próprio, com o link para resolver
- Continua valendo que nenhum valor de ICR ou de Qualidade trava o avanço

**9.** Como Administrador de Projeto, quero que a confirmação do avanço diga com que rodada a Fase 4 será
comparada, para que eu saiba desde o início qual é o ponto de comparação.

- A confirmação nomeia a rodada de referência e mostra o ICR e a Qualidade dela, como já faz com a
  última rodada da Fase 3
- A frase "a Fase 4 ainda não está disponível na ferramenta" sai
- A confirmação diz que a Fase 4 pede itens novos e avaliadores novos e que essa escolha é do
  Administrador
- A confirmação diz que, se o resultado não for o esperado, é possível voltar à Fase 3


### Novidade de itens e de avaliadores

**10.** Como Administrador de Projeto, quero ver de que fase eram as rodadas em que cada item foi usado,
para que eu escolha itens novos na Fase 4 sem precisar lembrar qual rodada era de qual fase.

- A marca de uso passa a agrupar as rodadas por fase, por exemplo "usado nas rodadas 2 e 3 (Fase 2) e 5
  (Fase 3)"
- A marca aparece onde aparece hoje: na lista de itens e na escolha de itens ao gerar respostas
- Nenhum item é recusado por já ter sido usado

**11.** Como Administrador de Projeto, quero ver em quais rodadas cada avaliador já avaliou, para que eu
saiba quem é novo antes e durante a Fase 4.

- Cada Avaliador ganha a marca "avaliou nas rodadas ...", agrupada por fase como a dos itens
- A marca aparece na página de membros, para qualquer fase
- Numa rodada da Fase 4, a marca aparece ao lado do nome de cada avaliador no painel de concordância e
  considera só as rodadas anteriores a ela
- Nas rodadas das Fases 2 e 3 a marca não aparece no painel, porque lá repetir avaliador é o normal
- Avaliador que nunca avaliou não tem marca
- Só o Administrador vê a marca

**12.** Como Administrador de Projeto, quero que a ferramenta não recuse avaliação de quem já avaliou
antes, para que a decisão sobre quem compõe a Fase 4 continue sendo minha.

- Qualquer Avaliador ativo continua vendo e avaliando a rodada aberta, em qualquer fase
- Para tirar do cálculo um avaliador que já tinha avaliado antes, o caminho é a marca de Outlier
  naquela rodada, com justificativa, e o valor com todos continua ao lado do valor sem os marcados
- Desativar o membro continua sendo sobre acesso, e não sobre cálculo


### Leitura da Fase 4

**13.** Como Administrador de Projeto, quero ver cada rodada da Fase 4 ao lado da sua rodada de
referência, para que eu julgue se o codebook generalizou.

- A tela da rodada da Fase 4 mostra ICR e Qualidade da própria rodada, como numa rodada da Fase 3
- Logo abaixo, um bloco compara com a rodada de referência: nomeia a rodada, diz que ela validou estas
  versões e mostra o ICR e a Qualidade das duas lado a lado
- A comparação respeita a marca de Outlier dos dois lados: onde há marca, aparecem os valores com todos
  e sem os marcados
- Nenhuma palavra, cor ou seta diz se a Fase 4 foi melhor, pior ou suficiente
- Uma rodada da Fase 4 de uma passagem anterior continua comparada com a sua própria referência, e não
  com a última rodada da Fase 3 do projeto

**14.** Como Administrador de Projeto, quero ver a Fase 4 nas séries de ICR e de Qualidade, para que a
leitura entre rodadas atravesse todo o processo.

- A série de ICR ganha os pontos da Fase 4, com a fase ao lado de cada ponto e agrupados visualmente,
  como já acontece com as Fases 2 e 3
- A série de Qualidade passa a cobrir as Fases 3 e 4
- Nada é somado nem tirado a média entre rodadas

**15.** Como Administrador de Projeto, quero uma orientação de leitura própria para a Fase 4, para que o
texto não me mande refinar algo que está congelado.

- Com o ICR abaixo da faixa de referência, a orientação diz que os avaliadores novos não estão
  aplicando o codebook da mesma forma, o que indica que ele não generalizou para essas pessoas ou
  esses itens
- Com o ICR não calculável, a orientação diz por que não há número e que a comparação ainda não é
  possível
- Com o ICR dentro da faixa, a orientação diz que os avaliadores novos concordam entre si e que é hora
  de olhar a Qualidade ao lado da rodada de referência
- Em nenhum caso a orientação diz que é hora de voltar à Fase 3, nem que a replicação foi aprovada

**16.** Como Administrador de Projeto, quero que a primeira rodada da Fase 4 diga o que mudou em relação
à anterior, para que eu lembre o que a fase espera de mim.

- A frase diz que codebook e prompt são os mesmos da rodada de referência, com o número dela, e que o
  que deve mudar são os itens de entrada e os avaliadores
- A frase é informação. Ela não verifica se os itens ou os avaliadores são de fato novos


### Retorno da Fase 4 para a Fase 3

**17.** Como Administrador de Projeto, quero voltar da Fase 4 para a Fase 3, para que eu possa refinar
de novo quando o teste de replicação não confirmar o que a Fase 3 mostrou.

- O retorno exige só que não haja rodada aberta
- Não exige rodada fechada da Fase 4: o Administrador pode voltar mesmo sem ter rodado nada
- Nenhum valor de ICR ou de Qualidade trava o retorno nem o sugere
- A checagem acontece no servidor, travando a linha do projeto como os avanços

**18.** Como Administrador de Projeto, quero que a ferramenta diga o que falta quando o retorno está
bloqueado, para que eu não fique olhando um botão desabilitado.

- A visão geral mostra um painel "Para voltar à Fase 3" com o único bloqueio possível, a rodada aberta,
  com o número dela e o link para resolver
- A mensagem segue o formato das mensagens de avanço

**19.** Como Administrador de Projeto, quero uma confirmação antes de voltar, para que eu saiba o que o
retorno muda.

- A confirmação diz que as rodadas da Fase 4 ficam como estão, com notas, ICR, Qualidade, marcas e
  anotações
- Diz que codebook e prompt voltam a ser editáveis e que a próxima edição cria uma versão nova
- Diz que, para voltar à Fase 4, valem de novo as regras do avanço, inclusive a da rodada de referência
- Se houver rodada fechada da Fase 4, mostra a última delas ao lado da sua referência, com ICR e
  Qualidade, sem veredito
- Cancelar não muda nada

**20.** Como Administrador de Projeto, quero que o histórico da Fase 4 continue visível depois do
retorno, para que a tentativa que não confirmou também seja dado de pesquisa.

- Rodadas, notas, ICR, Qualidade, marcas de outlier e anotações da Fase 4 continuam onde estão
- A série de ICR mostra a sequência como ela aconteceu, por exemplo Fase 3, Fase 4, Fase 3
- A primeira rodada da Fase 3 depois do retorno diz o que mudou em relação à última rodada da Fase 4,
  como qualquer outra


### Fim da Fase 4

**21.** Como Administrador de Projeto, quero que a ferramenta não declare a replicação aprovada, para
que o julgamento continue sendo meu.

- Não existe botão de concluir, estado de concluído nem marca de replicação aprovada
- O projeto continua na Fase 4 enquanto o Administrador não voltar
- O painel da Fase 4 na visão geral mostra o retorno e nada que soe como próxima etapa


### Acesso e autorização

**22.** Como Administrador de Projeto, quero que só eu possa voltar de fase e ver a marca de quem já
avaliou e a comparação com a rodada de referência, para que nada disso chegue ao Avaliador.

- A ação de retorno recusa quem tem só o vínculo de avaliador
- Nenhuma tela do Avaliador recebe a marca de participação nem os números da rodada de referência

**23.** Como Avaliador, quero avaliar na Fase 4 exatamente como avaliei antes, para que a tarefa continue
sendo aplicar o codebook a uma resposta.

- A tela de avaliação não diz em que fase o projeto está
- O Avaliador continua alcançando só a revisão de discordâncias das rodadas em que avaliou. Quem é
  novo na Fase 4 não vê as discussões nem as atas das Fases 2 e 3


## Requisitos Não Funcionais


### Integridade e rastreabilidade

- O congelamento é regra do servidor. Esconder o formulário é conveniência; a recusa está na ação.
- Abrir rodada, avançar e voltar travam a mesma linha do projeto e leem a fase dentro da própria
  transação. Uma edição de codebook que chegue junto com o avanço para a Fase 4 ou é salva antes, e
  então o avanço vê a versão nova e recusa, ou chega depois, e então é recusada pelo congelamento.
- O retorno não toca em nenhuma rodada, resposta, avaliação, nota, marca ou anotação.
- Nada da comparação com a rodada de referência é gravado. Ela é derivada na leitura, como o ICR e a
  Qualidade.
- Não há migration. A fase da rodada já aceita 4, e a fase do projeto já aceita de 1 a 4.

### Desempenho

- A comparação acrescenta à tela da rodada da Fase 4 o cálculo de ICR e Qualidade de uma segunda
  rodada. Com o tamanho típico de rodada, é desprezível.
- A marca de participação dos avaliadores é uma consulta agregada por projeto, carregada só para o
  Administrador.

### Usabilidade e interface

- Nenhuma tela usa palavra de juízo sobre a Fase 4: nada de "replicou", "generalizou", "aprovada",
  "reprovada" ou cor que signifique isso. A orientação pode dizer o que um ICR baixo indica, como já
  faz na Fase 3.
- Bloqueio sempre diz o que falta e onde resolver, em vez de só desabilitar o botão.
- O codebook e o prompt na Fase 4 aparecem como leitura, não como formulário que falha.

### Segurança

- Toda ação nova, e toda recusa nova em ação existente, checa o papel na camada de aplicação, com o
  ator vindo da sessão.
- A página só busca a marca de participação e os números da rodada de referência quando quem está
  vendo é o Administrador, como já acontece com o ICR e a Qualidade.


## Decisões de Implementação


### Rodada

- A pré-condição de abrir rodada perde o bloqueio "fase indisponível" e ganha um bloqueio para versões
  diferentes das da rodada de referência, que só se aplica na Fase 4. Ela recebe as versões vigentes e
  as da referência, e não recebe métrica nenhuma.
- A rodada de referência de uma rodada da Fase 4 é a última rodada fechada da Fase 3 com número menor
  que o dela. Para abrir uma rodada nova, é a última rodada fechada da Fase 3 do projeto. Fica numa
  função pura, usada pela abertura de rodada, pelo avanço, pela tela da rodada e pela confirmação do
  retorno.
- Composição da entrada, entrada enviada e geração não mudam: a composição já trata fase 3 ou maior
  como codebook completo.

### Congelamento

- As ações que salvam o codebook e o texto do prompt já recusam quando há rodada aberta. Elas ganham,
  no mesmo ponto e na mesma transação, a recusa com o projeto na Fase 4, com mensagem própria.
- A ação de metadados do prompt, as ações de itens e o teste de prompt não mudam.

### Avanço e retorno

- A pré-condição do avanço da Fase 3 passa a receber também as versões vigentes e as da última rodada
  fechada da Fase 3. Continua sem receber ICR nem Qualidade, e é isso que mantém estrutural a garantia
  de que número não trava.
- O retorno é uma ação própria, separada do avanço, porque a direção e as regras são outras. As
  pré-condições ficam numa função pura que recebe só o número da rodada aberta, se houver.
- O retorno muda a fase do projeto para 3 e nada mais. Não precisa descongelar versão nenhuma: as
  versões usadas por rodada já estão congeladas, e salvar sobre elas já cria a versão seguinte.
- Nem o avanço nem o retorno notificam ninguém.

### Participação e uso

- A marca de uso dos itens passa a receber as rodadas com a fase de cada uma. A de participação dos
  avaliadores sai das avaliações enviadas, agrupadas por vínculo de membro e por rodada, e usa a mesma
  função de rótulo. Na tela da rodada da Fase 4, só entram as rodadas de número menor.

### Leitura

- A comparação reaproveita as funções do par de ICR e do par de Qualidade, aplicadas à rodada de
  referência. Não existe segundo cálculo.
- A série de Qualidade já inclui qualquer rodada da Fase 3 em diante, então passa a cobrir a Fase 4
  sem mudança de regra; o que muda são os rótulos que falam em "rodadas da Fase 3".
- A orientação de leitura passa a receber a fase da rodada e ganha os três textos da Fase 4. Continua
  sem receber Qualidade.
- As mudanças entre rodadas ganham o caso de entrada na Fase 4, ao lado do caso de entrada na Fase 3
  que já existe.

### Telas

- A visão geral ganha, na Fase 4, o painel de retorno, no mesmo desenho dos painéis de avanço. O
  painel de avanço da Fase 3 ganha o item das versões e a confirmação nova.
- O codebook e o prompt mostram modo de leitura na Fase 4, com a explicação.
- A página de membros ganha a marca de participação. A tela da rodada da Fase 4 ganha a marca no
  painel de concordância e o bloco de comparação.
- Sem `InfoTooltip` dentro de `<dialog>`: o texto de ajuda das confirmações vai inline.


## Testing Decisions

Um bom teste aqui prova comportamento observável pela borda do sistema: dado um estado de banco e um
ator, chamar a ação produz o efeito certo ou o erro certo, e o que fica gravado é o que a metodologia
exige. Ele não olha nome de função interna, ordem de query nem estrutura de componente.

### Costuras

Não nasce costura nova. O épico usa as que já existem:

- **Server Actions**, onde está a regra e a autorização: criar rodada, gerar respostas, salvar codebook,
  salvar prompt, salvar metadados do prompt, cadastrar item, teste de prompt, avanço e retorno.
- **O módulo de LLM falso**, para provar o que uma rodada da Fase 4 envia.
- **Funções puras**, no padrão das que já existem: rodada de referência, pré-condições de abrir rodada,
  do avanço da Fase 3 e do retorno, rótulo de uso e de participação, orientação e mudanças entre
  rodadas.
- **Testes de página**, para provar o que cada papel vê.

### O que será testado

- **Rodada de referência, em teste unitário**: a última rodada fechada da Fase 3 antes de uma rodada da
  Fase 4; rodada aberta da Fase 3 não conta; depois de um retorno e de um novo avanço, as rodadas da
  passagem anterior continuam com a referência antiga.
- **Criar rodada**: na Fase 4, com versões iguais às da referência, cria e grava a fase 4; com codebook
  ou prompt diferentes, recusa com a mensagem que nomeia as versões; o avaliador é barrado.
- **Gerar respostas**: numa rodada da Fase 4 a LLM falsa recebe o codebook completo da versão congelada.
- **Congelamento**: na Fase 4, salvar codebook e salvar texto do prompt são recusados e nada muda no
  banco; salvar metadados do prompt e cadastrar item funcionam; o teste de prompt funciona e envia o
  codebook completo.
- **Avanço da Fase 3**: recusa quando o codebook mudou depois da última rodada fechada da Fase 3,
  quando o prompt mudou e quando os dois mudaram; avança com versões iguais, mesmo com ICR baixo e
  Qualidade concentrada em Baixo.
- **Retorno**: recusa com rodada aberta; volta sem nenhuma rodada da Fase 4; volta depois de rodadas
  fechadas da Fase 4 e elas continuam intactas; depois do retorno, salvar o codebook cria versão nova;
  segunda chamada devolve fase errada; avaliador barrado; nenhuma notificação criada.
- **Participação e uso, em teste unitário e de página**: rótulos agrupados por fase; na rodada da Fase
  4, só rodadas anteriores entram; avaliador sem avaliação não tem marca; o Avaliador não vê marca
  nenhuma.
- **Orientação, em teste unitário**: os três textos da Fase 4; nenhum texto diz que é hora de voltar
  nem fala em aprovação; os textos da Fase 3 não mudam.
- **Mudanças entre rodadas, em teste unitário**: entrada na Fase 4 com a frase sobre itens e
  avaliadores; retorno da Fase 4 para a Fase 3 tratado como troca de fase comum.
- **Páginas**: o Administrador vê a comparação com a referência numa rodada da Fase 4, com os valores
  com e sem outliers quando há marca; nenhuma tela do Avaliador mostra comparação, marca ou fase;
  codebook e prompt aparecem em modo de leitura na Fase 4.

### Prior art

Os testes de ação seguem os do avanço das Fases 2 e 3, que já provam que número não trava e que a
segunda chamada devolve fase errada, e os de criar rodada, que já provam a recusa com rodada aberta. O
congelamento segue os testes que provam a trava do codebook com rodada aberta. Os unitários seguem os
de pré-condições, de orientação e de mudanças entre rodadas. Os testes de página seguem os da tela de
rodadas, que já provam que o Avaliador não vê coeficiente nem Qualidade.


## Out of Scope

Fora deste épico, com motivo:

- **Recusar avaliação de quem já avaliou antes**, ou escolher a coorte de cada rodada. A decisão é do
  Administrador, como a dos itens, e a marca de Outlier já cobre a exclusão (emenda de 2026-10-02 da
  ADR 0004).
- **Partição de itens** entre conjuntos reservados. Continua valendo a ADR 0004.
- **Veredito sobre a replicação**, meta, estado de projeto concluído ou marca de replicação aprovada. É
  o mesmo motivo de a Qualidade não ter veredito.
- **Notificar os avaliadores** sobre avanço ou retorno. Os avanços não notificam, e o Avaliador não
  precisa saber em que fase o projeto está.
- **Usar a coluna `evaluations_enabled`** de `project_members`, que existe e nunca foi usada. Ela seria
  a coorte explícita que ficou de fora. Removê-la é limpeza à parte.
- **Comparar rodadas da Fase 4 entre si** além do que a série já mostra.
- **Retorno da Fase 3 para a Fase 2**, reabrir rodada fechada, escala configurável, escolha de modelo,
  LLM como avaliadora, anonimização dos avaliadores e colar resposta manualmente. Continuam fora pelas
  decisões anteriores.


## Further Notes

**Por que a ferramenta não recusa avaliadores repetidos.** Era a escolha menos óbvia do épico, porque
há uma assimetria com os itens. O Administrador escolhe cada item no momento de gerar, com o uso à
vista. Os avaliadores ele não escolhe: todo Avaliador ativo vê a rodada aberta. Sem regra, quem
avaliou nas Fases 2 e 3 cai na Fase 4 por padrão. Mesmo assim, a decisão de quem compõe a coorte de
replicação é de desenho de pesquisa e pertence ao Administrador. A ferramenta deixa isso visível em
dois lugares (membros e painel da rodada) e oferece uma porta única para tirar alguém do cálculo, a
marca de Outlier, que registra o motivo e mantém o valor com todos à vista. O risco assumido é um
veterano avaliar sem que ninguém perceba.

**Por que a regra das versões vale em dois lugares.** No avanço ela impede o caso comum: o
Administrador refina depois da última rodada da Fase 3 e avança achando que está tudo validado. Na
abertura de rodada ela protege o ponto em que a versão de fato congela, e cobre os projetos que
avançaram para a Fase 4 antes desta regra existir. Com o congelamento, um projeto novo nunca chega à
segunda recusa.

**Por que o retorno não descongela nada explicitamente.** O congelamento da Fase 4 é uma regra de fase,
não uma marca nas versões. As versões usadas por rodadas já estavam congeladas pelo uso. Voltar à Fase
3 só tira a regra de fase, e o comportamento de sempre volta a valer: salvar sobre uma versão usada cria
a seguinte.

**A ordem das fatias.** A primeira fatia deveria ser o congelamento junto com a regra das versões no
avanço, porque hoje um projeto que avança ainda consegue editar o codebook. Abrir rodada na Fase 4 vem
depois, já com a regra das versões na abertura. Leitura, participação e retorno podem vir em
seguida, em qualquer ordem.

**Documentos de domínio atualizados junto com este spec.** O glossário recebeu o termo Rodada de
referência e a descrição completa da Fase 4 (o que ela testa, o que congela, várias rodadas, novidade
de itens e avaliadores a cargo do Administrador, sem encerramento), a condição do retorno no verbete
Fase, a leitura da Fase 4 em Refinar, a série de ICR cobrindo as Fases 2, 3 e 4, a Qualidade cobrindo
as Fases 3 e 4 e o uso da marca de Outlier para quem já avaliou antes. A ADR 0004 recebeu a emenda de
2026-10-02 (novidade dos avaliadores, versões da Fase 4 verificadas no avanço e na abertura de rodada, e
o fim da Fase 4). A pasta de ADRs continua fora do versionamento, então a emenda existe só localmente.
