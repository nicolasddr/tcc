# Épico 2: Validação do codebook (Fase 2)


## Resumo

O Épico 1 entregou o pipeline configurado: o Administrador de Projeto escreve o prompt, cadastra os
itens de entrada, cria as definições com título e tipo, testa a chamada à LLM na tela e avança o
projeto para a Fase 2. Chegando lá, não existe nada. A Fase 2 é a fase em que o codebook é
validado, e hoje ela é só um número na barra de fases.

Falta tudo o que a metodologia exige a partir desse ponto. Não há onde escrever a descrição das
definições nem os critérios que o avaliador vai usar, então o codebook está pela metade. Não há
como gerar o lote de respostas que os avaliadores analisariam, porque Resposta ainda não é uma
entidade do sistema. Não há tela de avaliação, então o avaliador convidado entra no projeto,
responde o questionário de perfil e depois não tem o que fazer. E não há cálculo de concordância,
que é o instrumento central da fase: sem ICR, a pergunta "o meu codebook está ambíguo?" não tem
resposta e o processo inteiro vira opinião.

O documento de requisitos original do projeto não mencionava ICR em nenhum momento. Ele descrevia
um painel de discordâncias sem nenhuma medida por trás, o que transforma a Fase 2 numa tela de
anotação. Este épico corrige isso.

## Solução

A Fase 2 ganha o ciclo completo de validação do codebook, que se repete quantas vezes for preciso:

1. O Administrador termina o codebook, escrevendo as **descrições** das definições e criando os
   **critérios**, específicos por definição ou gerais para todas elas. Uma definição sem nenhum
   critério não deixa a fase andar, porque não haveria o que avaliar nela.
2. O Administrador cria uma **rodada**. Esse é o momento em que a versão do codebook e a versão do
   prompt congelam, e a partir dali elas nunca mais mudam. Só existe uma rodada aberta por vez.
3. Dentro da rodada, o Administrador **gera respostas**, de 1 a 5 itens por vez. A LLM continua
   recebendo só o prompt e os títulos das definições, exatamente como na Fase 1: nenhum critério vai
   para a LLM antes da Fase 3. Cada Resposta grava a proveniência completa.
4. Os **avaliadores** avaliam todas as respostas da rodada, atribuindo Alto, Médio ou Baixo a cada
   critério de cada definição, com justificativa opcional. Enviou, travou: avaliação enviada é
   imutável.
5. O Administrador **fecha a rodada**, o que libera a revisão de discordâncias e destrava a edição
   do codebook.
6. A ferramenta calcula o **ICR** daquela rodada, com Krippendorff's Alpha, e mostra onde o grupo
   divergiu. A equipe discute, o Administrador registra o que foi decidido, refina o codebook (o que
   agora cria uma versão nova, porque a anterior está congelada) e abre a rodada seguinte.

A série de ICR por rodada é o que responde se o refinamento está funcionando. Quando o Administrador
julgar que a concordância está boa, ele avança para a Fase 3. A ferramenta informa, mostra a faixa
de referência da literatura e nunca trava o avanço por causa do valor da métrica.

## Histórias de Usuário


### Autoria do codebook na Fase 2

**1.** Como Administrador de Projeto, quero escrever a descrição de cada definição, para que o
avaliador entenda o que eu quis dizer com aquele título em vez de adivinhar.

- O campo de descrição aparece na tela do codebook quando o projeto está na Fase 2 ou adiante
- A descrição é opcional, e salvar sem ela é permitido
- O texto respeita o limite de tamanho e o excesso é recusado com mensagem no próprio campo
- Editar a descrição segue a mesma regra de versão do Épico 1: altera no lugar se a versão está em
  aberto, cria a versão seguinte se está congelada

**2.** Como Administrador de Projeto, quero criar critérios dentro de uma definição, para que o
avaliador tenha uma régua explícita para julgar aquela definição.

- O nome do critério é obrigatório e a descrição é opcional
- O critério pertence à versão do codebook, não ao projeto, e é copiado inteiro quando nasce uma
  versão nova
- A ordem dos critérios dentro da definição é preservada e é a ordem exibida ao avaliador
- Um critério criado aparece na lista imediatamente após o salvamento

**3.** Como Administrador de Projeto, quero criar critérios gerais, que valem para todas as
definições, para não repetir a mesma regra em cada uma delas.

- Existe um bloco separado de Critérios Gerais, fora das definições
- Um critério geral aparece automaticamente dentro de cada definição na tela de avaliação
- Editar um critério geral muda o texto em todas as definições de uma vez
- Remover um critério geral remove de todas as definições de uma vez

**4.** Como Administrador de Projeto, quero ver quantas notas estou pedindo por resposta, para que
eu perceba o esforço que estou impondo ao avaliador antes de abrir a rodada.

- A tela do codebook mostra a conta explícita: número de definições vezes a soma dos critérios
  próprios com os gerais
- A conta atualiza conforme critérios são criados ou removidos
- O texto deixa claro que um critério geral vira uma nota por definição, e não uma nota por resposta

**5.** Como Administrador de Projeto, quero reordenar e remover critérios enquanto a versão está em
aberto, para que eu possa organizar o codebook antes de qualquer rodada usá-lo.

- Reordenar e remover só é possível na versão em aberto
- Numa versão congelada, qualquer alteração cria a versão seguinte com o conteúdo copiado
- A versão congelada nunca é apagada nem sobrescrita

**6.** Como Administrador de Projeto, quero ser impedido de abrir uma rodada com o codebook
incompleto, para que ninguém receba uma definição sem régua nenhuma para julgá-la.

- A pré-condição é: ao menos uma definição, e cada definição com ao menos um critério, próprio ou
  herdado dos gerais
- A tela diz qual definição está sem critério, em vez de só desabilitar o botão
- A checagem acontece no servidor, e não apenas na interface

**7.** Como Administrador de Projeto, quero ver o histórico de versões do codebook com o número de
definições e de critérios de cada uma, para que eu saiba o que mudou entre uma rodada e outra.

- Cada linha do histórico mostra o número da versão, a contagem de definições, a contagem de
  critérios, o autor, a data e a observação da versão
- A linha diz se a versão está em aberto ou congelada, e o que a congelou
- Versões antigas são abertas em modo leitura


### Rodada

**8.** Como Administrador de Projeto, quero criar uma rodada por ação explícita, para que fique claro
o momento em que o projeto passa a produzir dado de pesquisa.

- Existe um botão de nova rodada na tela de rodadas do projeto
- A rodada nasce no estado aberta, sem nenhuma resposta
- A criação registra autor e data

**9.** Como Administrador de Projeto, quero que a criação da rodada congele o par de versões, para
que eu sempre consiga dizer qual codebook e qual prompt produziram aquele resultado.

- A rodada aponta para a versão vigente do codebook e para a versão vigente do prompt
- As duas versões recebem a marca de uso na mesma transação que cria a rodada
- Depois disso, qualquer alteração de conteúdo naquelas versões cria uma versão nova em vez de
  alterar a existente

**10.** Como Administrador de Projeto, quero que só exista uma rodada aberta por projeto, para que
não haja dúvida sobre qual conjunto o avaliador está avaliando.

- Tentar criar uma segunda rodada com uma aberta é recusado com mensagem clara
- A tela de rodadas mostra qual é a aberta e quais estão fechadas
- A recusa acontece no servidor

**11.** Como Administrador de Projeto, quero ser impedido de mexer no codebook enquanto a rodada
está aberta, para que a versão que os avaliadores estão usando não mude debaixo deles.

- Com rodada aberta, as ações de salvar codebook são recusadas com mensagem explicando o motivo
- A tela do codebook fica em modo leitura e diz que é preciso fechar a rodada para editar
- Fechar a rodada destrava a edição, e a primeira alteração cria a versão seguinte

**12.** Como Administrador de Projeto, quero fechar a rodada quando eu decidir, para que um avaliador
que sumiu não pare o projeto inteiro.

- O fechamento é ação do Administrador e não depende de todos terem terminado
- A confirmação mostra quem ainda não terminou e quantas avaliações faltam
- O fechamento é irreversível, e a confirmação diz isso em texto

**13.** Como Administrador de Projeto, quero que fechar a rodada encerre também a geração, para que o
conjunto avaliado seja o conjunto medido.

- Depois de fechada, a rodada não aceita resposta nova nem avaliação nova
- O painel de revisão de discordâncias fica disponível
- A rodada fechada continua visível, com tudo o que ela produziu

**14.** Como Administrador de Projeto, quero ver a lista de rodadas do projeto com o estado de cada
uma, para que eu acompanhe a evolução do trabalho.

- Cada linha mostra o número da rodada, o estado, as versões de codebook e prompt que ela usou, a
  quantidade de respostas e o ICR quando calculável
- A lista fica em ordem cronológica
- Clicar numa rodada abre a tela dela


### Geração de respostas

**15.** Como Administrador de Projeto, quero gerar respostas escolhendo de 1 a 5 itens por vez, para
que o lote fique no tamanho que a minha equipe consegue avaliar.

- O seletor aceita de 1 a 5 itens
- Cada item selecionado produz exatamente uma resposta
- A geração pode ser repetida várias vezes dentro da mesma rodada, com itens diferentes

**16.** Como Administrador de Projeto, quero ver em quais rodadas cada item já foi usado na hora de
escolher, para que eu decida com essa informação à vista.

- A lista de itens mostra, ao lado de cada um, as rodadas em que ele já produziu resposta
- A informação não filtra nem trava a escolha
- Item já usado numa rodada anterior pode ser escolhido de novo

**17.** Como Administrador de Projeto, quero que o mesmo item não gere duas respostas na mesma
rodada, para que a variação do modelo não se misture com a discordância entre pessoas.

- Itens já usados na rodada atual aparecem indisponíveis para nova geração
- A recusa também acontece no servidor, e não só na interface

**18.** Como Administrador de Projeto, quero que o envio à LLM na Fase 2 seja o mesmo da Fase 1, para
que a validação do codebook aconteça sobre o pipeline simples.

- O envio é composto pelo texto do prompt da versão fixada, pelos títulos das definições da versão
  fixada e pelo conteúdo do item
- Nenhuma descrição de definição e nenhum critério entra no envio
- A ordem das definições no envio é a ordem salva na versão

**19.** Como Administrador de Projeto, quero que cada Resposta grave a proveniência completa, para
que o resultado seja reproduzível e comparável.

- Cada resposta registra a origem, o modelo, a versão do modelo, a versão do prompt e a versão do
  codebook, além da rodada e do item
- O modelo em uso aparece na interface antes da geração
- A proveniência é gravada na mesma operação que grava o texto

**20.** Como Administrador de Projeto, quero ver um estado de carregamento durante a geração, para
que eu não clique duas vezes nem ache que travou.

- O botão fica desabilitado e em estado de carregamento durante a chamada
- Um segundo clique não dispara uma segunda geração
- A tela continua utilizável enquanto a resposta não chega

**21.** Como Administrador de Projeto, quero que uma falha parcial não jogue fora o que já deu certo,
para que eu não pague duas vezes pela mesma geração.

- Cada resposta é gravada assim que chega, sem esperar o lote inteiro
- Os itens que falharam são listados na tela com a opção de tentar de novo só para eles
- Item que falhou não deixa nenhuma linha gravada e continua disponível para nova tentativa
- A mensagem distingue falha de autenticação, item grande demais e indisponibilidade do provedor

**22.** Como Administrador de Projeto, quero que o teto de respostas do projeto seja respeitado, para
que um erro meu não vire uma fatura.

- O seletor de quantidade é limitado pelo número de vagas restantes no projeto
- A ação confere o teto de novo antes de chamar a LLM e recusa com mensagem que nomeia o limite
- A tela mostra quantas vagas restam


### Avaliação

**23.** Como Avaliador, quero abrir a minha tela de avaliação sem precisar procurar nada, para que eu
comece a trabalhar direto.

- A tela de avaliação resolve sozinha qual é a rodada aberta do projeto
- O cabeçalho mostra o nome do projeto e o meu nome
- Não existe link secreto nem código de entrada: o acesso vem do vínculo de membro

**24.** Como Avaliador, quero saber por que não tenho nada para fazer quando for o caso, para que eu
não fique achando que a ferramenta quebrou.

- Sem codebook completo, a tela diz que o administrador ainda está montando o codebook
- Sem rodada aberta, a tela diz que está aguardando rodada
- Com rodada aberta e sem resposta, a tela diz que está aguardando respostas
- Com tudo avaliado e a rodada ainda aberta, a tela diz que eu terminei e estou aguardando o
  fechamento

**25.** Como Avaliador, quero consultar o prompt e o item de entrada durante a análise, para que eu
julgue a resposta sabendo o que foi pedido à LLM.

- Um painel retrátil no topo mostra o prompt e o item que originou a resposta
- O painel abre e fecha sem sair da tela nem perder o que já foi preenchido
- Nome e descrição do prompt aparecem só quando preenchidos pelo Administrador

**26.** Como Avaliador, quero ler a resposta com a formatação original preservada, para que quebras
de linha e espaçamento não me atrapalhem.

- Quebras de linha e espaçamentos são preservados
- Textos longos rolam dentro do próprio bloco, sem quebrar o layout da página

**27.** Como Avaliador, quero ver os critérios agrupados por definição, para que eu julgue uma
definição de cada vez.

- Os critérios aparecem agrupados por definição, com a definição podendo expandir e recolher
- Os critérios gerais aparecem dentro de cada definição, junto dos específicos daquela definição
- Um ícone ao lado de cada critério e de cada definição revela a descrição, quando existe

**28.** Como Avaliador, quero atribuir Alto, Médio ou Baixo a cada critério, para que a minha leitura
fique registrada na mesma régua que a dos meus colegas.

- Os três valores são apresentados como botões, com cor distinta para cada um
- A escala é fixa e não é configurável pelo projeto
- A nota escolhida fica visível antes do envio e pode ser trocada até o envio

**29.** Como Avaliador, quero escrever uma justificativa opcional em cada critério, para que a
discussão posterior tenha o meu raciocínio e não só o meu voto.

- Cada critério tem um campo de texto opcional, com instrução visual do que escrever
- O campo respeita o limite de tamanho
- A justificativa é enviada junto com a nota e fica visível na revisão de discordâncias

**30.** Como Avaliador, quero ser impedido de enviar pela metade, para que eu não deixe buraco no
cálculo sem perceber.

- O botão de enviar fica desabilitado até que todos os critérios de todas as definições tenham nota
- A tela indica quais definições ainda têm critério sem nota
- A checagem também acontece no servidor

**31.** Como Avaliador, quero que o envio trave a avaliação daquela resposta, para que o dado de
pesquisa não seja alterado depois.

- O envio marca a resposta como avaliada por mim, esconde os botões de nota e trava os campos de
  texto em modo leitura
- Uma segunda tentativa de enviar a mesma resposta é recusada com mensagem clara
- Não existe em lugar nenhum uma ação de editar ou apagar avaliação enviada

**32.** Como Avaliador, quero avançar automaticamente para a próxima resposta depois de enviar, para
que eu mantenha o ritmo.

- O envio leva à próxima resposta ainda não avaliada por mim
- Existem controles de anterior e próxima para navegar livremente
- Respostas já avaliadas continuam acessíveis em modo leitura

**33.** Como Avaliador, quero acompanhar o meu progresso na rodada, para que eu saiba quanto falta.

- Um indicador mostra quantas respostas eu já avaliei sobre o total da rodada
- O total pode crescer se o Administrador gerar mais respostas, e a tela deixa isso explícito
- O progresso é individual, e não do grupo

**34.** Como Avaliador, quero ver as respostas em ordem embaralhada só para mim, para que a ordem da
fila não influencie o resultado do grupo.

- Cada avaliador recebe uma ordem própria, estável entre visitas
- Cada resposta tem um rótulo fixo, igual para todos, independente da posição na fila
- A ordem é embaralhada por decisão metodológica, e isso fica registrado no documento

**35.** Como Avaliador, não quero ver o valor do ICR, para que eu julgue o que estou lendo em vez de
tentar acertar o número.

- Nenhuma tela do avaliador exibe coeficiente de concordância, nem antes nem depois do fechamento
- A revisão de discordâncias mostra as divergências, sem métrica agregada
- O painel com o número existe apenas para o Administrador

**36.** Como Administrador de Projeto que também avalia, quero avaliar pelo meu vínculo de avaliador,
para que fique registrado com qual papel eu avaliei.

- A avaliação aponta para o vínculo de membro, e não para o usuário
- Quem tem os dois vínculos usa a tela de avaliação pelo vínculo de avaliador
- O histórico por pessoa continua obtível juntando os vínculos daquele usuário


### Concordância

**37.** Como Administrador de Projeto, quero ver o ICR de cada rodada, para que eu saiba se o meu
codebook está ambíguo.

- O coeficiente é o Krippendorff's Alpha ordinal
- O cálculo é por rodada, sobre a versão de codebook que aquela rodada fixou
- Nenhuma tela apresenta um ICR agregado entre rodadas de versões diferentes

**38.** Como Administrador de Projeto, quero ver a série de ICR ao longo das rodadas, para que eu
saiba se o refinamento está funcionando.

- A tela do projeto mostra o ICR de cada rodada em ordem cronológica
- A série deixa visível qual versão de codebook cada rodada usou
- Não existe média das rodadas, porque ela apagaria justamente a evolução

**39.** Como Administrador de Projeto, quero ver a concordância por definição e por critério, para
que eu saiba onde exatamente refinar.

- Existe uma matriz com definições nas linhas e critérios nas colunas, ou equivalente legível
- Cada célula mostra o coeficiente daquele par dentro da rodada
- Células sem dado suficiente aparecem como não calculáveis, e não como zero

**40.** Como Administrador de Projeto, quero ver a faixa de referência da literatura junto do número,
para que eu saiba interpretá-lo.

- A faixa exibida é a de Krippendorff: abaixo de 0,667 questionável, de 0,667 a 0,8 aceitável, e
  0,8 ou mais boa
- A faixa é referência, e não trava nada
- A origem da faixa aparece na tela, para não parecer número inventado pela ferramenta

**41.** Como Administrador de Projeto, quero ver o tamanho da amostra ao lado do coeficiente, para
que eu não tire conclusão de ruído.

- Cada coeficiente exibido vem acompanhado do número de unidades e do número de avaliadores
- Amostras pequenas recebem um aviso explícito de que o valor é instável
- O aviso é textual e não esconde o número

**42.** Como Administrador de Projeto, quero saber quando o ICR não é calculável, para que eu entenda
que é falta de dado e não um erro.

- Com menos de dois avaliadores com avaliação enviada, a tela mostra "não calculável" e explica o
  motivo
- A ausência de ICR não impede fechar a rodada nem avançar de fase
- O aviso aparece cedo, e não só no fim da rodada

**43.** Como Administrador de Projeto, quero que avaliações parciais entrem no cálculo, para que o
trabalho de quem avaliou parte da rodada não seja descartado.

- Respostas não avaliadas por alguém entram como dado faltante, que é o que o Alpha trata
- Nenhum avaliador é excluído do cálculo por não ter terminado
- O número de avaliações efetivas por avaliador fica visível

**44.** Como Administrador de Projeto, quero que o cálculo seja feito sob demanda, para que ele
reflita sempre o estado atual das exclusões declaradas.

- O coeficiente é derivado das notas, que são imutáveis
- O valor muda apenas quando uma marca de outlier é adicionada ou removida
- Nenhum valor de ICR é gravado como retrato congelado


### Outliers

**45.** Como Administrador de Projeto, quero marcar um avaliador como outlier em uma rodada, para que
eu possa ver o resultado sem quem destoou muito.

- A marcação é feita na área de membros do projeto e vale para uma rodada específica
- A mesma pessoa pode ser outlier numa rodada e não ser em outra
- A marcação nunca reescreve rodadas anteriores por conta própria

**46.** Como Administrador de Projeto, quero justificar por escrito toda marcação de outlier, para
que a exclusão seja defensável na monografia.

- A justificativa é obrigatória e não aceita texto vazio
- A marcação registra autor e data
- A justificativa fica visível junto da marca

**47.** Como Administrador de Projeto, quero desfazer uma marcação de outlier, para que um erro de
julgamento meu não fique permanente no dado.

- A remoção da marca é possível a qualquer momento e registra autor e data
- O ICR volta a incluir aquela pessoa imediatamente
- O histórico de marcações fica registrado

**48.** Como Administrador de Projeto, quero ver o ICR com todos e sem os outliers lado a lado, para
que a exclusão apareça na análise em vez de ficar escondida.

- Os dois valores aparecem juntos sempre que houver ao menos um outlier na rodada
- O valor com todos nunca é escondido nem substituído pelo valor filtrado
- Quando não há outlier, a tela mostra um valor só, sem sugerir que falta algo

**49.** Como Avaliador marcado como outlier, quero continuar avaliando normalmente, para que a marca
seja sobre o cálculo e não sobre o meu acesso.

- A marca não altera em nada a tela do avaliador
- As avaliações continuam gravadas e imutáveis
- O avaliador não é notificado da marca pela ferramenta


### Revisão de discordâncias e consenso

**50.** Como Administrador de Projeto, quero ver as notas de todos lado a lado depois do fechamento,
para que a equipe discuta sobre o mesmo material.

- A tela mostra todas as células, com as divergentes marcadas
- As notas aparecem por avaliador, com o nome real
- Notas de quem está marcado como outlier aparecem, identificadas como tal

**51.** Como Administrador de Projeto, quero distinguir divergência adjacente de divergência extrema,
para que eu saiba se o problema é a fronteira da escala ou a definição em si.

- Divergência adjacente é Alto com Médio, ou Médio com Baixo
- Divergência extrema é Alto com Baixo
- As duas têm marcação visual distinta, e a tela explica a diferença

**52.** Como Administrador de Projeto, quero ler as justificativas de cada nota na própria célula,
para que a conversa parta do raciocínio e não do voto.

- A justificativa aparece ao passar o mouse ou ao expandir a célula
- Células sem justificativa deixam isso claro, em vez de parecerem vazias por erro
- O texto longo rola dentro do próprio espaço

**53.** Como Administrador de Projeto, quero registrar por escrito o que a equipe decidiu em cada
divergência, para que a razão da mudança do codebook fique documentada.

- A anotação é feita por critério dentro da resposta e é salva no servidor
- A anotação do Administrador é visível para todos os membros daquela rodada
- A anotação sobrevive a recarregar a página e a sair e voltar

**54.** Como Avaliador, quero acessar a revisão de discordâncias da rodada em que avaliei, para que
eu entenda onde eu me afastei do grupo.

- O acesso abre depois do fechamento da rodada
- O avaliador vê apenas as rodadas em que ele avaliou
- O avaliador não vê nenhum coeficiente

**55.** Como Avaliador, quero ter um espaço próprio de anotações na revisão, para que eu prepare o
que quero levar para a reunião.

- A anotação do avaliador é salva no servidor e é privada dele
- Ela sobrevive a recarregar a página
- Ela não aparece para os outros avaliadores

**56.** Como Administrador de Projeto, quero que a discussão fique presa à rodada, para que a Fase 4
meça a clareza do codebook e não a memória do grupo.

- As anotações pertencem à rodada em que foram escritas
- O avaliador não vê discordâncias nem anotações de rodadas em que não participou
- O Administrador vê tudo


### Exportação

**57.** Como Administrador de Projeto, quero exportar as notas da rodada em CSV, para que eu possa
recalcular e analisar por fora da ferramenta.

- O arquivo sai em formato longo, uma linha por nota
- Cada linha traz rodada, versão de codebook, versão de prompt, item, resposta, definição, critério,
  avaliador, nota, justificativa e marca de outlier
- A exportação é do Administrador e cobre uma rodada por vez


### Avanço para a Fase 3

**58.** Como Administrador de Projeto, quero avançar para a Fase 3 quando eu julgar que o codebook
está validado, para que a decisão continue sendo minha.

- O avanço exige nenhuma rodada aberta e ao menos uma rodada fechada na Fase 2
- Nenhum valor de ICR impede o avanço
- A confirmação mostra o ICR da última rodada com a faixa de referência ao lado

**59.** Como Administrador de Projeto, quero que a ferramenta me diga o que falta quando o avanço
está bloqueado, para que eu não fique olhando um botão desabilitado.

- A mensagem nomeia a pré-condição que falta
- A checagem acontece no servidor
- O avanço continua sendo confirmado explicitamente


### Acesso e autorização

**60.** Como Administrador de Projeto, quero que só eu possa criar rodada, gerar resposta, fechar
rodada, marcar outlier e exportar, para que o dado de pesquisa não seja alterado por engano.

- Todas essas ações são recusadas para quem tem apenas o vínculo de avaliador
- A recusa acontece na camada de aplicação, em toda ação de escrita
- Quem não é membro do projeto não alcança nenhuma dessas telas

**61.** Como Administrador de Projeto, quero que desativar um avaliador preserve o que ele avaliou,
para que eu não perca dado ao gerenciar a equipe.

- As avaliações do vínculo desativado continuam existindo e continuam contando no ICR
- O vínculo desativado sai do denominador do progresso da rodada
- A tela de membros fala em desativar, e deixa claro que as avaliações permanecem

**62.** Como Administrador de Projeto, quero que a exclusão do cálculo tenha uma porta só, para que
não exista um caminho de excluir alguém sem justificar.

- Desativar um avaliador não retira as notas dele do cálculo
- A única forma de retirar notas do cálculo é a marca de outlier, com justificativa
- As duas ações são apresentadas na interface como coisas diferentes


## Requisitos Não Funcionais


### Integridade e rastreabilidade

- Toda nota fica atrelada à versão do codebook vigente no momento da submissão, através da rodada e
  também das colunas de proveniência da resposta.
- Avaliação enviada é imutável. A recusa de edição e de segundo envio vive na camada de aplicação,
  apoiada por restrições declarativas de unicidade e pela coluna obrigatória de data de envio.
  Restrição sim, trigger não.
- A avaliação aponta para o vínculo de membro, e a chave estrangeira usa restrição em vez de
  cascata, para que remover membro não apague dado de pesquisa.
- Marcações de outlier registram autor, data e justificativa, e a remoção também é registrada.
- Nenhuma tela oferece apagar avaliação, apagar resposta ou apagar rodada.

### Desempenho e integração com a LLM

- A geração é assíncrona, com estado de carregamento visível, botão desabilitado durante a chamada e
  proteção contra duplo clique.
- Cada resposta é persistida assim que chega, para que uma falha no meio do lote não descarte o que
  já foi pago.
- Erros da LLM são traduzidos em mensagens distinguíveis entre si, sem expor a chave nem trechos
  dela.
- O teto de respostas por projeto é conferido no servidor antes de cada chamada.

### Cálculo

- O coeficiente é o Krippendorff's Alpha com nível de mensuração ordinal, calculado por rodada.
- O cálculo trata avaliação ausente como dado faltante e não exclui ninguém por incompletude.
- O cálculo é derivado sob demanda das notas, e nenhum valor é gravado como retrato.
- O módulo de cálculo é puro: recebe a matriz de notas e devolve o coeficiente, sem tocar banco nem
  sessão.

### Usabilidade e interface

- Textos longos preservam formatação original e rolam dentro do próprio bloco, sem quebrar o layout.
- Ação destrutiva ou irreversível pede confirmação explícita, e o texto da confirmação diz o que vai
  acontecer. Fechar rodada e avançar de fase entram nessa regra.
- Todo bloqueio informa o que falta, em vez de apenas desabilitar o controle.

### Segurança

- Todas as ações deste épico checam papel explicitamente na camada de aplicação, conforme a ADR
  0007. Não há RLS, trigger nem RPC.
- A chave da OpenAI nunca aparece em variável exposta ao cliente.


## Decisões de Implementação


### Codebook e critérios

- Nasce uma tabela de critérios, ligada à **versão** do codebook, com vínculo **anulável** à
  definição. Vínculo preenchido significa critério específico daquela definição; vínculo vazio
  significa critério geral da versão. A herança é resolvida na leitura.
- A alternativa de duplicar uma linha por definição no salvamento foi descartada: ela infla o
  histórico, faz o diff entre versões ficar ilegível e obriga a manter as cópias em sincronia.
- Um critério geral produz **uma nota por definição**, e não uma por resposta. A mesma regra pode
  ser clara numa definição e ambígua em outra, e colapsar isso apagaria o sinal mais útil da fase.
- Salvar uma versão substitui o conjunto inteiro de definições e critérios daquela versão, do mesmo
  jeito que criar versão nova copia tudo. Não há edição parcial de critério solto, seguindo o padrão
  que o Épico 1 estabeleceu para definições.
- A descrição da definição ganha limite de tamanho em `lib/limits.ts` e a CHECK correspondente, que
  hoje não existe na tabela porque na Fase 1 a coluna nasce nula.
- A regra de salvamento na Fase 2 passa a exigir, além de ao menos uma definição, que cada definição
  tenha ao menos um critério próprio ou herdado dos gerais.

### Escala

- A escala é fixa: Alto, Médio e Baixo, com CHECK no banco. Não é configurável por projeto.
- Escala configurável arrastaria consigo o nível de mensuração do coeficiente, o diff entre versões
  do codebook, a comparabilidade entre rodadas e a migração de notas antigas. É um épico próprio, e
  não um campo.

### Rodada

- Tabela nova de rodadas, ligada ao projeto, apontando para a versão de codebook e a versão de
  prompt, com número sequencial dentro do projeto, estado, autor, data de criação e data de
  fechamento.
- A criação da rodada preenche a marca de uso das duas versões na mesma transação, que é o que
  congela ambas conforme a ADR 0009.
- Uma rodada aberta por projeto, garantida por índice único parcial sobre o estado aberto, além da
  checagem na ação.
- O fechamento é irreversível e impede resposta nova e avaliação nova.
- Não existe tabela de ligação entre rodada e item. A Resposta já aponta para rodada e item, então
  "quais itens esta rodada consumiu" e "em quais rodadas este item já foi usado" são consultas sobre
  as respostas. Uma tabela que sempre espelharia outra seria um segundo lugar para a mesma verdade,
  com chance de divergir na retentativa de uma geração parcial.
- A coluna de uso do item continua existindo e continua respondendo outra pergunta, a de se o item
  está congelado para edição. Ela é preenchida na primeira resposta que consome o item.

### Resposta e geração

- Tabela nova de respostas, com rodada, item, texto e proveniência completa: origem, modelo, versão
  do modelo, versão do prompt e versão do codebook.
- As versões ficam gravadas também na resposta, mesmo já sendo determinadas pela rodada. A
  redundância é deliberada: proveniência é uma afirmação sobre como aquele texto veio a existir, e é
  o que permite acrescentar a resposta colada manualmente no futuro sem remodelar a tabela, além de
  tornar a exportação autossuficiente linha a linha. Um teste prova que as duas fontes concordam.
- Unicidade em rodada mais item, para impedir duas respostas do mesmo item na mesma rodada.
- Falha na geração não persiste nada. Resposta sem texto não é avaliável, não entra no cálculo e só
  existiria para poluir a contagem da rodada.
- O envio à LLM é composto por prompt mais títulos das definições, conforme a ADR 0002. Nenhum
  critério vai à LLM antes da Fase 3, o que torna sem objeto a instrução do documento antigo de
  pedir à LLM que não use os rótulos da escala: a escala nunca é enviada.
- A geração reaproveita o módulo `lib/ai` do Épico 1, sem interface nova.

### Avaliação

- Duas tabelas. Uma de avaliações, com rodada, resposta, vínculo de membro e data de envio, com
  unicidade em resposta mais vínculo. Outra de notas, com avaliação, definição, critério, valor da
  escala e justificativa, com unicidade em avaliação, definição e critério.
- A chave das notas inclui a **definição** porque um critério geral é avaliado uma vez por
  definição. A ADR 0009 registrou a chave sem a definição e precisa de emenda.
- A avaliação é a unidade de submissão e de imutabilidade: enviou, travou. Isso torna "avaliada" um
  fato datado, em vez de algo inferido da contagem de notas.
- A ordem das respostas na fila do avaliador é embaralhada de forma determinística a partir do
  vínculo de membro e da rodada, para ser estável entre visitas. O rótulo exibido da resposta é fixo
  e igual para todos.

### Concordância

- Módulo novo e puro de cálculo, com uma função só: recebe a matriz de notas por unidade e
  avaliador e devolve o coeficiente, mais o número de unidades e de avaliadores.
- Krippendorff's Alpha com nível ordinal. Cohen's Kappa não é implementado: o Alpha cobre também o
  caso de dois avaliadores, sem a restrição de ser par a par, então manter os dois seria manter duas
  implementações para a mesma pergunta.
- A unidade de análise é o par resposta mais célula, onde célula é a dupla definição e critério. O
  coeficiente é calculado para a rodada inteira e também por célula.
- Nada é agregado entre rodadas de versões diferentes de codebook. O painel geral mostra a série por
  rodada.
- A faixa de referência da ADR 0004 é constante da aplicação e aparece junto de todo coeficiente.
- Menos de dois avaliadores com avaliação enviada resulta em "não calculável" com o motivo, e não em
  zero nem em erro.

### Outlier

- Tabela nova ligando vínculo de membro e rodada, com justificativa, autor e data, mais o registro
  da remoção. A marca é por rodada, e não por projeto: marcar o projeto inteiro é uma afirmação
  sobre a pessoa, marcar a rodada é uma afirmação sobre um conjunto de notas, que é o que o
  Administrador de fato observou.
- O outlier continua avaliando, continua com as notas gravadas e continua aparecendo na revisão de
  discordâncias, identificado. Só sai do cálculo.
- O valor com todos e o valor sem outliers aparecem juntos, e o primeiro nunca é escondido.
- A **ADR 0008 perde a exigência do recorte do Administrador-avaliador**. O viés que ela descreve
  continua real, e passa a ser tratado pelo mesmo mecanismo de outlier, que o Administrador pode
  aplicar a si mesmo. A emenda precisa dizer isso, senão o argumento da ADR fica órfão.

### Revisão de discordâncias e anotações

- Divergência é qualquer célula sem unanimidade entre os avaliadores considerados. Divergência
  adjacente e extrema recebem marcação distinta, porque numa escala ordinal elas são diagnósticos
  diferentes: adjacente costuma indicar fronteira borrada entre pontos da escala, extrema costuma
  indicar definição ambígua.
- A tela mostra todas as células, e não só as divergentes, com as divergentes destacadas.
- Anotações são persistidas, não são estado local. Elas registram por que o codebook mudou entre
  uma rodada e a seguinte, o que é dado de pesquisa. Tabela ligando rodada, resposta, definição,
  critério e vínculo de membro, com o texto.
- A anotação do Administrador é a ata e é visível para os membros daquela rodada. A anotação do
  avaliador é privada dele.
- Nomes reais para todos por enquanto. Anonimização fica registrada como funcionalidade futura no
  glossário.

### Telas e rotas

- A autoria de descrições e critérios acontece na tela de codebook que já existe, e não numa tela
  nova. O codebook é a mesma entidade nas duas fases, e duplicar a tela criaria dois lugares para
  editar a mesma versão.
- Nascem a área de rodadas do Administrador, com lista, criação, gestão da rodada aberta e revisão
  de discordâncias por rodada, e a tela do Avaliador, que resolve sozinha qual é a rodada aberta em
  vez de exigir um identificador na URL. É isso que o documento antigo chamava de URL exclusiva, e
  não um link secreto, que colidiria com a ADR 0006.
- As métricas ficam na página do projeto, junto da barra de fases, que é onde o Administrador já
  olha o estado geral.
- A rota de respostas do questionário de perfil já se chama `profile-answers`, então a colisão de
  nome que o Épico 1 previa não existe mais e a palavra `responses` está livre para a Resposta da
  LLM.

### Atualização de dados

- Sem tempo real. A aba de avaliações do Administrador revalida na navegação e oferece um botão
  explícito de atualizar. Assinatura, reconexão e estado de sincronia seriam complexidade para
  resolver um problema que não existe, num projeto que acabou de retirar complexidade da camada de
  dados.

### Limites

Entram em `lib/limits.ts`, com CHECK espelhada, seguindo o padrão que o arquivo documenta:
descrição da definição em 2000, nome do critério em 200, descrição do critério em 2000, texto da
resposta em 50000, justificativa em 2000, anotação de consenso em 5000 e justificativa de outlier em
2000. A migração acrescenta também a CHECK que falta na descrição da definição.


## Testing Decisions

Um bom teste aqui prova comportamento observável pela borda do sistema: dado um estado de banco e um
ator, chamar a ação produz o efeito certo ou o erro certo. Ele não olha nome de função interna, ordem
de query nem estrutura de componente. As perguntas que cada teste responde são "o Administrador
conseguiu, o Avaliador foi barrado" e "o dado que ficou gravado é o que a metodologia exige".

### Costuras

A costura principal continua sendo a **Server Action**, que é onde o projeto já concentra regra e
autorização. Ela cobre autoria de critérios, criação e fechamento de rodada, geração, envio de
avaliação, marca de outlier, anotações, exportação e avanço de fase.

A segunda costura já existe: **`lib/ai`**, substituída por uma implementação falsa nos testes de
geração, para não gastar dinheiro nem depender de resultado variável.

Nasce **uma costura nova, e só uma**: o módulo puro de cálculo de concordância. Ele existe porque o
cálculo precisa ser provado contra valores conhecidos sem passar por banco, sessão ou tela. Recebe a
matriz de notas e devolve o coeficiente. Nenhuma action calcula coeficiente por conta própria.

### O que será testado

- **Actions de codebook na Fase 2**: criar critério específico e geral; salvar sem critério em alguma
  definição é recusado, dizendo qual definição; editar critério em versão em aberto altera no lugar;
  editar em versão congelada cria a versão seguinte copiando definições e critérios; salvar com
  rodada aberta é recusado; avaliador é barrado.
- **Actions de rodada**: criar rodada congela as duas versões na mesma transação; criar segunda
  rodada com uma aberta é recusado; fechar impede resposta nova e avaliação nova; fechar duas vezes é
  recusado; avaliador é barrado.
- **Action de geração**: compõe o envio com prompt mais títulos, sem descrição e sem critério, usando
  a LLM falsa; grava proveniência completa; item repetido na mesma rodada é recusado; falha parcial
  grava as que deram certo e não deixa linha das que falharam; teto do projeto recusa antes de
  chamar a LLM; avaliador é barrado.
- **Action de envio de avaliação**: envio incompleto é recusado; envio completo grava avaliação e
  notas com a chave por definição e critério; segundo envio da mesma resposta pelo mesmo vínculo é
  recusado; vínculo de outro projeto é recusado; administrador sem vínculo de avaliador é recusado.
- **Actions de outlier**: marcar sem justificativa é recusado; marcar afeta o cálculo daquela rodada
  e só dela; desmarcar restaura; avaliador é barrado.
- **Actions de anotação**: anotação do Administrador é visível para os membros da rodada; anotação do
  avaliador é privada; anotação de rodada em que o avaliador não participou não é acessível.
- **Action de avanço de fase**: recusa com rodada aberta; recusa sem rodada fechada; avança com ICR
  baixo, provando que métrica não trava; avaliador é barrado.
- **Módulo de cálculo, em teste unitário sem banco**: valores conhecidos da literatura para Alpha
  ordinal; comportamento com dado faltante; retorno de não calculável com menos de dois avaliadores;
  concordância perfeita dando 1; e o caso de todos concordarem por acaso numa distribuição
  degenerada, que é onde o Alpha se distingue da concordância percentual.
- **Páginas novas**: administrador vê a área de rodadas, avaliador não vê; avaliador vê a tela de
  avaliação, administrador sem vínculo de avaliador não vê; quem não é membro leva 404 ou redirect;
  nenhuma tela do avaliador exibe coeficiente.
- **Funções puras**: resolução da herança de critérios gerais para a lista de células de uma
  definição; classificação de divergência entre adjacente e extrema; embaralhamento determinístico da
  ordem das respostas, provando estabilidade entre chamadas e diferença entre avaliadores.

### Prior art

Os testes de integração de action seguem o desenho que o projeto já usa: sessão simulada pelos
helpers de `@/test`, fixtures pelo executor de dono e limpeza no final. Os mais próximos em forma e
em regra são os de versionamento de codebook e de prompt do Épico 1, que também provam a diferença
entre alterar no lugar e criar versão nova a partir da coluna de uso, e os de teste de prompt, que já
substituem `lib/ai` por uma implementação falsa. Os testes de página seguem os de configurações e de
membros. Os unitários seguem os de versionamento e de reordenação.


## Out of Scope

Fora deste épico, com motivo:

- **Colar resposta manualmente**, prevista na ADR 0003. A Fase 2 mede ambiguidade de codebook sobre
  um lote gerado pelo próprio pipeline, e resposta colada tem proveniência incompleta. A coluna de
  origem nasce mesmo assim, com um valor só em uso. Se entrar depois, o vínculo ao item de entrada é
  obrigatório, e não opcional como o documento antigo pedia, porque resposta sem item não tem lugar
  na matriz nem no cálculo.
- **Atualização em tempo real** da chegada das notas.
- **Anonimização dos avaliadores** na revisão de discordâncias.
- **Escala configurável** por projeto.
- **Distribuição de respostas entre avaliadores** com sobreposição parcial. Todos avaliam tudo. O
  controle de custo humano é o tamanho da rodada.
- **Retorno da Fase 3 para a Fase 2**, que o documento antigo pedia. O único retorno do processo é da
  Fase 4 para a Fase 3, conforme a ADR 0004.
- **Reabrir rodada fechada**.
- **Cohen's Kappa**, e qualquer coeficiente além do Alpha ordinal.
- **Meta de qualidade** e a dimensão de Qualidade em geral, que pertencem à Fase 3.
- **Fase 3 e Fase 4** inteiras, incluindo o envio do codebook completo à LLM e o teste de replicação.

Fora do projeto por decisões anteriores que continuam valendo: chave de API trazida pelo usuário,
escolha de modelo ou de outra LLM, limites de requisição sobre a chave da ferramenta, LLM como
avaliadora, entrada em projeto por código, e partição de itens entre conjuntos reservados.


## Further Notes

**O documento de requisitos original deste épico descreve outra coisa.** Ele foi escrito sobre um
protótipo anterior e contradiz decisões registradas. Os pontos em que este spec o contraria de
propósito: o vocabulário volta a ser o do glossário (projeto, rodada, item de entrada, questionário
de perfil); definição não é sinônimo de categoria, que é um dos três tipos; o codebook completo não é
injetado no prompt na Fase 2, porque isso só acontece na Fase 3; não existe retorno para a Fase 2;
prompt e itens pertencem ao projeto e são versionados, então a rodada os referencia em vez de
contê-los; e a autorização é checada em Server Action com o ator vindo da sessão, e não recebida no corpo
de uma requisição. As chamadas "limitações conhecidas" do documento antigo eram bugs do protótipo, e
três delas foram eliminadas por decisão de desenho: anotação que some ao recarregar passa a ser
persistida, ICR agregado entre versões deixa de existir em favor da série por rodada, e criar versão
de codebook com rodada aberta passa a ser bloqueado.

**Documentos de domínio a atualizar junto com este épico.** O glossário já recebeu Escala como termo
próprio, a distinção entre critério específico e geral, a definição de Concordância como Alpha
ordinal por rodada e o registro da anonimização como item em aberto. Falta acrescentar Rodada aberta
e Rodada fechada, Outlier, Avaliação e Nota. A ADR 0008 recebe emenda retirando o recorte do
Administrador-avaliador e explicando que o viés passa a ser tratado pela marca de outlier. A ADR 0009
recebe emenda corrigindo a chave de unicidade das notas, que precisa incluir a definição. Nascem duas
ADRs: uma para a escala fixa e outra para o mecanismo de outlier junto com a decisão de não mostrar o
coeficiente ao avaliador.

**Por que o avaliador não vê o ICR.** É a decisão menos óbvia deste spec e vale repetir o motivo.
Mostrar "estamos em 0,62 e precisamos de 0,8" faz as pessoas votarem no que imaginam que o grupo vai
votar. A concordância sobe, e a ferramenta perde exatamente a capacidade de detectar que o codebook
está ambíguo, que é a única coisa que a Fase 2 existe para medir. A conversa de alinhamento precisa
ser sobre o texto da definição, não sobre a meta.

**Por que regerar em vez de reaproveitar respostas entre rodadas.** Como a LLM recebe só os títulos
na Fase 2, refinar descrições e critérios não muda nada do que ela produziria, e reaproveitar as
respostas da rodada anterior isolaria perfeitamente a variável. Foi descartado porque o avaliador
lembra da nota que deu, e a segunda rodada passaria a medir memória em vez de clareza do codebook. O
meio-termo adotado é regerar sobre os mesmos itens: o texto muda o bastante para quebrar a memória
literal e a tarefa continua comparável. O preço aceito é que a variação não determinística do modelo
entra no delta de ICR entre rodadas, o que é tolerável porque na Fase 2 a pergunta é sobre o
codebook e não sobre a qualidade da resposta.

**A ordem embaralhada é escolha metodológica.** Com cinco ou mais respostas por rodada, efeito de
ordem e fadiga são ameaças reais: se todos veem a mesma sequência, esse ruído entra correlacionado no
coeficiente e vira concordância falsa. Embaralhar por avaliador descorrelaciona o ruído sem custo de
implementação. Isso precisa estar escrito para não parecer descuido.

**As ADRs continuam fora do repositório, por ora.** `docs/adr` segue no gitignore por decisão
consciente, então as quatro mudanças de decisão listadas acima (emendas na 0008 e na 0009, mais a
0010 sobre a escala fixa e a 0011 sobre outlier e visibilidade do coeficiente) existem apenas na
máquina de quem as escreveu. Fica registrado como pendência: ADR é o tipo de documento que a banca
vai querer ler, e em algum momento antes da entrega essa pasta precisa ser versionada.
