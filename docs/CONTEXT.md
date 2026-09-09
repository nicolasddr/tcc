# Linguagem do Domínio: Ferramenta de Prompt Science

Glossário canônico (linguagem ubíqua) da ferramenta que implementa a metodologia de
Prompt Science de Shah (2025). Só entram aqui termos específicos deste domínio.

As decisões vivem em [`docs/adr/`](./adr). A wiki do TCC tem uma série de ADRs anterior,
sobre stack, auth e modelo de dados do Épico 0; os ADRs daqui cobrem o processo e o núcleo
da metodologia.

## Codebook

**Codebook**
Conjunto que define a tarefa. Tem duas partes: as *definições*, que estruturam a tarefa da
LLM, e os *critérios*, que guiam o avaliador humano. As duas compõem o codebook, e na Fase 3
o codebook completo também é enviado à LLM. Shah trata o codebook como conceito único; a
ferramenta o divide por público primário.

**Definição**
Um conceito que estrutura a tarefa da LLM. Tem título (o termo ou rótulo, por exemplo
"Informacional"), descrição (o texto que explica o que é) e tipo. A LLM recebe só os títulos
nas Fases 1 e 2; o codebook completo, com descrições e critérios, só vai para a LLM na Fase 3.
Evitar: instrução, categoria (são casos ou sinônimos imprecisos; ver o tipo abaixo).

**Tipo de definição**
Uma de três naturezas:

- *Categoria*: rótulo nominal para tarefa de classificação (Informacional, Transacional).
- *Dimensão de qualidade*: aspecto a avaliar em texto livre (Atomicidade, Clareza).
- *Diretriz*: característica que o conteúdo gerado deve ter, em tarefa de geração.

**Critério**
Regra que define como julgar a *resposta da LLM*, e não o dado em si, na *escala* da
ferramenta. Faz parte do codebook: na Fase 2 é usado pelos avaliadores para validar o
codebook e na Fase 3 vai também à LLM, como parte do codebook completo. É autorado na Fase 2.
Um critério pode ser *específico*, quando pertence a uma definição, ou *geral*, quando vale
para todas as definições da versão. O geral é avaliado uma vez por definição, e não uma vez
por resposta, porque a mesma regra pode ser clara numa definição e ambígua em outra.

**Escala**
A régua com que o Avaliador julga um critério, ordinal e de três pontos: Alto, Médio e Baixo.
É fixa na ferramenta e não configurável por projeto, porque o nível de mensuração da métrica
de concordância, o diff entre versões do codebook e a comparabilidade entre rodadas dependem
dela ser a mesma sempre.

## Pipeline e avaliação

**Prompt**
A instrução enviada à LLM. É uma entidade separada do codebook, e na Fase 3 converge com ele
no envio ("o codebook é o prompt").

**Versão (de codebook ou de prompt)**
O conteúdo do codebook ou do prompt num dado momento, numerado em sequência dentro do projeto.
Codebook e prompt são versionados de forma independente. Toda versão registra quem a criou e
quando, porque o histórico é dado de pesquisa.

**Versão em aberto**
A versão vigente enquanto nenhuma rodada a usou: é a área de trabalho do Administrador, e salvar
altera a própria versão, sem criar número novo. Na Fase 1 a versão vigente está sempre em aberto,
já que a fase não tem rodadas.
Evitar: rascunho (não existe rascunho separado da versão; ver ADR 0009).

**Versão congelada**
A versão que já foi usada por uma rodada, ou que deixou de ser a mais recente. Não muda mais:
salvar sobre ela cria a versão seguinte. A única exceção são os metadados descritivos do prompt
(nome, descrição e registro de mudanças), que não vão à LLM e não são versionados.

**Teste de prompt**
A verificação que fecha a Fase 1: chama a LLM com o prompt, os títulos das definições e um item de
entrada, e mostra a saída na tela sem gravar nada. Não produz Resposta nem Rodada, e não congela
versão.
Evitar: smoke test, que era o nome antigo e sugeria persistência (ver ADR 0001).

**Item de entrada**
Uma unidade de dado que vira uma resposta: uma pergunta de usuário, um commit, o conteúdo de
um `.bpmn`. É texto opaco para a ferramenta. Os itens pertencem a um pool do projeto, não a
uma fase, e as fases seguintes amostram desse pool. O pool não é particionado: cabe ao humano não
reusar na Fase 4 um item que os avaliadores já viram, e a ferramenta só informa em quais rodadas
cada item já foi *usado*, a mesma palavra que marca a versão usada por uma rodada.
Evitar: dado, registro, e sobretudo *treino* e *teste* como partição, porque nada aqui é
treinado.

**Resposta**
A saída da LLM para um item de entrada, produzida pelo pipeline (prompt + definições + item).
Não confundir com as respostas do questionário de perfil, que um Avaliador dá ao entrar no
projeto: aquelas são de outro conceito e não devem usar esta palavra.
Junto do texto, toda resposta grava o que permite reproduzi-la e compará-la: a origem (gerada
pela ferramenta ou colada manualmente), o modelo e a versão usados, e as versões de prompt e
codebook que a produziram. É o que a promessa de replicabilidade do Shah exige.
Evitar: um nome coletivo para esses cinco campos, *proveniência* inclusive. Eles são concretos e
poucos; citá-los diz mais do que o rótulo.

**Avaliar**
Ato do Avaliador de aplicar o codebook a uma resposta, atribuindo escala e justificativa.

**Validar**
Medir, via ICR, se os avaliadores aplicam o codebook de forma consistente (Fase 2).

**Refinar**
Mudar o número ou a descrição de itens entre rodadas. Na Fase 2 refina-se o codebook; na
Fase 3, primeiro o codebook (até o ICR subir) e depois o prompt (pela qualidade).

**Concordância (ICR)**
Grau em que avaliadores independentes chegam à mesma conclusão. Medida por Krippendorff's
Alpha ordinal, calculado **por rodada**, sobre a versão de codebook que aquela rodada fixou,
e nunca agregado entre versões diferentes. Cohen's Kappa não é usado: o Alpha cobre também o
caso de dois avaliadores, sem a restrição de ser par a par.
Evitar: confiabilidade, acurácia.

**Qualidade**
Quão "boa" é a resposta da LLM segundo os critérios. É uma dimensão independente da
Concordância, e as duas aparecem separadas na UI. Só é leitura confiável quando o ICR está
alto.

## Projeto e processo

**Projeto**
Unidade de trabalho onde um Administrador conduz o processo de prompt science sobre uma
tarefa. Tem um pool de itens de entrada, um codebook, prompts e uma fase atual.

**Tipo de tarefa**
Dica opcional declarada na criação do projeto (Classificação, Avaliação de qualidade, Geração,
Não sei/Misto). Só personaliza tooltips e exemplos, além do tipo pré-selecionado das
definições. Não muda o comportamento da ferramenta, que é agnóstica de tarefa.

**Fase**
Estado explícito do projeto no processo de Shah (1 a 4). O avanço é uma ação consciente do
Administrador, nunca automático nem travado por métrica. Pré-condição estrutural é coisa
diferente de métrica: sem prompt, sem definição ou sem item a fase seguinte não tem o que fazer,
e por isso o avanço fica bloqueado até os insumos existirem. O único retorno possível é da Fase 4
para a Fase 3.

- *Fase 1, configurar o pipeline*: prompt inicial, itens, LLM e os títulos das definições. Não
  produz resposta persistida. Termina com um *teste de prompt*, que chama a LLM e mostra a saída
  na tela sem gravar nada, só para verificar que o pipeline roda antes de convidar avaliadores.
- *Fase 2, validar o codebook*: a LLM gera o lote avaliável ainda só com os títulos (a mesma
  entrada da Fase 1, em escala). Aqui se autoram descrições e critérios, que serão usados
  pelos avaliadores, avalia-se, calcula-se o ICR e refina-se o codebook até a concordância
  subir. A pergunta da fase é se o codebook está ambíguo; qualidade ainda não importa.
- *Fase 3, validar o prompt*: o codebook completo passa a ir à LLM junto com o prompt ("o
  codebook é o prompt"), e por isso as respostas mudam. Com ICR baixo, refina-se o codebook;
  com ICR alto, refina-se o prompt para empurrar a qualidade.
- *Fase 4, testar a replicação*: repete a avaliação com itens de entrada novos e avaliadores
  novos, sobre codebook e prompt congelados. Responde se o codebook generaliza ou se só funcionava
  com aquelas pessoas e aqueles dados. Se o resultado reprovar, o Administrador pode voltar à
  Fase 3, o que descongela as versões; a rodada da Fase 4 fica preservada como histórico.

**Rodada**
Um ciclo de gerar respostas, avaliar e calcular ICR dentro de uma fase. Existe da Fase 2 em
diante, já que a Fase 1 não persiste resposta nenhuma. É a unidade contável: uma fase é feita de
várias rodadas. Entre uma rodada e a próxima, o Administrador refina (o
codebook na Fase 2, o codebook ou o prompt na Fase 3).
Evitar: iteração como unidade contável ("iterativo" só como adjetivo do processo).

**Rodada aberta**
A rodada que ainda aceita geração de resposta e envio de avaliação. Existe no máximo uma por
projeto, e a criação dela é o que congela o par de versões que ela usa. Enquanto há rodada
aberta, o codebook não pode ser editado, porque a versão que os avaliadores estão aplicando não
pode mudar debaixo deles.

**Rodada fechada**
A rodada encerrada pelo Administrador. Não aceita mais resposta nem avaliação, libera a revisão
de discordâncias e destrava a edição do codebook, cuja próxima alteração cria versão nova.
Fechar é irreversível, e não avança a fase.

**Avaliação**
O conjunto das notas que um Avaliador enviou sobre uma Resposta, de uma vez só. É a unidade de
submissão e de imutabilidade: enviou, travou. Aponta para o vínculo de membro, e não para o
usuário.

**Nota**
O valor da escala que uma Avaliação atribui a um critério dentro de uma definição, com
justificativa opcional. Um critério geral rende uma nota em cada definição da versão.

**Outlier**
Marca que o Administrador aplica a um avaliador **em uma rodada**, retirando as notas dele do
cálculo daquela rodada. Exige justificativa escrita, é reversível e fica registrada com autor e
data. O outlier continua avaliando e continua aparecendo na revisão de discordâncias,
identificado: a marca é sobre o cálculo, não sobre o acesso. O valor com todos e o valor sem
outliers aparecem sempre juntos, para que a exclusão fique na análise em vez de virar um número
único mais bonito.
Evitar: usar desativação de membro como forma de tirar alguém do cálculo; a porta é uma só.

## Papéis

**Administrador de Projeto**
Conduz o processo: cria o projeto, autora o codebook, itera o prompt e acompanha as métricas.
Todo usuário com permissão que cria um projeto vira seu Administrador.
Evitar: Pesquisador (não existe esse papel).

**Avaliador**
Avalia respostas da LLM de forma independente, seguindo o codebook. Não autora o codebook.

**Administrador-avaliador**
Administrador que também assumiu o papel de Avaliador no próprio projeto, ganhando um segundo
vínculo e passando pelo mesmo consentimento e questionário dos demais. Como ele autora o codebook
e avalia com ele, é fonte conhecida de viés, e os painéis de concordância precisam conseguir
separá-lo dos demais avaliadores.

**Super-admin**
Administrador da plataforma; aprova ou rejeita permissão para criar projetos.

## Em aberto

- LLM como avaliadora (*could-have*): se for construída, decidir se conta no ICR principal ou
  se aparece como lente separada (LLM contra consenso humano). A recomendação em registro é a
  lente separada. Resolver no Épico 3 ou depois.
- Anonimização dos avaliadores na revisão de discordâncias: hoje todos veem os nomes reais.
  Exibir pseudônimos estáveis ("Avaliador 1") para reduzir pressão de conformidade fica como
  funcionalidade futura.
- Saída estruturada da Resposta: hoje a saída da LLM é texto livre e opaco. Estruturá-la por
  definição facilitaria a tela de avaliação, mas prende a ferramenta a um formato e quebra quando
  a LLM desobedece. Reavaliar quando a tela de avaliação existir.
