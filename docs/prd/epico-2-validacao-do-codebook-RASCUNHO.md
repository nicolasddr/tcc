# Épico 2: Validação do codebook (Fase 2) — material bruto

> **Isto não é um spec.** É o material que sobrou do Épico 1 depois que a sessão de grilling
> realocou parte do escopo, mais as decisões que já foram tomadas e que o Épico 2 herda prontas.
> Falta passar por uma sessão de grilling própria antes de virar spec, porque as perguntas em
> aberto no fim deste documento mudam o desenho.
>
> Origem: sessão de grilling de 2026-08-18 sobre o documento "Épico 1: Configuração, Geração e
> Avaliação", que foi dividido em dois. A metade que ficou está em
> [`epico-1-configuracao-do-pipeline.md`](./epico-1-configuracao-do-pipeline.md).

## O que a Fase 2 é

Segundo o glossário e a ADR 0001, a Fase 2 é onde o codebook é validado. A LLM gera o lote
avaliável ainda só com os títulos das definições, que é a mesma entrada da Fase 1 mas em escala.
Aqui se autoram as descrições das definições e os critérios, os avaliadores avaliam, calcula-se o
ICR e refina-se o codebook até a concordância subir.

A pergunta da fase é se o codebook está ambíguo. Qualidade ainda não importa nesta fase.

É aqui também que nascem as duas entidades centrais do domínio que o Épico 1 não constrói: a
**Rodada** e a **Resposta**.

## Histórias realocadas do documento original

O texto abaixo é o do documento de requisitos original, preservado como estava. Ele foi escrito
assumindo que tudo isto acontecia na Fase 1, então a numeração e as menções a "Fase 1" precisam ser
revistas quando virar spec.

### HU-030 (parcial): blocos de critérios do codebook

O que fica para o Épico 2 são os blocos de critérios, já que os blocos de definições ficaram no
Épico 1:

- Cada definição permite incluir critérios específicos (Nome do critério é obrigatório; Descrição é
  opcional).
- O bloco de Critérios Gerais permite adicionar regras aplicadas automaticamente a todas as
  definições da sala.
- O salvamento exige no mínimo uma definição criada e que cada definição possua ao menos um critério
  atrelado (próprio ou herdado dos gerais).
- Tentativas de salvar sem critérios válidos são bloqueadas com aviso informando a obrigatoriedade.
- O uso dos critérios é restrito exclusivamente ao tipo de escolha por categorias (Alto, Médio e
  Baixo).

Junto vem a autoria das **descrições** das definições, que é o segundo tempo do codebook na
ADR 0001. O Épico 1 cria a definição só com título e tipo, e a descrição nasce vazia.

### HU-034: geração de respostas por Inteligência Artificial

- A interface exibe um botão para adicionar respostas, abrindo uma janela de configuração.
- A quantidade de respostas a ser gerada deve ser escolhida entre 1 e 5 unidades por vez.
- A confirmação aciona a IA para produzir os textos baseados nos insumos cadastrados.
- A IA gera os textos de forma limpa nesta fase, sem receber instruções ou rótulos dos critérios de
  avaliação.
- As respostas geradas são salvas imediatamente e disponibilizadas para a análise dos avaliadores.

### HU-036: visualizar prompt, itens e regras

- Prompt e Dados de Teste ficam em uma aba retrátil (abrir/fechar) no topo da tela.
- O texto do prompt mantém sua formatação original (quebras de linha, espaçamentos) com barra de
  rolagem para textos longos.
- Identificadores de nome e descrição do prompt só são exibidos se preenchidos pelo Administrador.
- Critérios de avaliação aparecem em formato de lista expansível/recolhível por categoria.
- Um ícone explicativo exibe a descrição detalhada da regra ao posicionar o mouse (tooltip).
- Critérios Gerais são incluídos visualmente de forma automática em todas as categorias ativas.
- Uma barra ou indicador de progresso (ex: "1/3") exibe o andamento das avaliações do usuário na
  categoria.

### HU-037: atribuir notas e justificativas

- Três botões coloridos são fornecidos para notas: Alto (Verde), Médio (Amarelo) e Baixo (Vermelho).
- Um campo opcional de texto acompanha cada critério para inserção de justificativa, contendo
  instrução visual para explicar a nota.
- O envio definitivo é bloqueado até que uma nota seja selecionada para todos os critérios da
  resposta.
- O envio aplica o selo "Avaliada", oculta os botões de nota e trava os campos de texto como leitura
  (somente-leitura).
- Tentativas de reavaliação de uma resposta já submetida pelo mesmo usuário são bloqueadas com
  mensagem de erro clara.
- Botões "Anterior" e "Próxima" permitem a navegação entre as respostas.

### HU-038: painel de discordâncias e consenso

- Uma tela de revisão exibe o resumo das notas da rodada em modo leitura.
- Campos de texto livre são disponibilizados ao lado dos itens com divergência de notas.
- Os campos permitem o registro de anotações e pontos decididos em reuniões de alinhamento da equipe.

### HU-039 (parcial): fechar a rodada

O avanço de fase ficou no Épico 1. O que sobra aqui é o fechamento da rodada, que foi desacoplado do
avanço de fase durante o grilling. Vale reescrever do zero, porque o texto original acoplava as duas
ações.

### Requisitos não funcionais que vêm junto

- **RNF-017**: cada avaliação fica atrelada ao ID da versão do critério vigente no momento da
  submissão. O versionamento já é construído no Épico 1; o que falta é a amarração da avaliação.
- **RNF-018**: imutabilidade da avaliação submetida. Precisa ser reescrito: o texto original pedia
  bloqueio "no banco de dados", o que reabria a ADR 0007. Ver a ADR 0009.
- **RNF-019**: geração assíncrona com estado de carregamento, para evitar duplo clique e timeout.
- **RNF-020**: textos longos com rolagem e formatação original preservada, sem quebrar o layout.
- **RNF-021**: confirmação explícita antes de ação destrutiva ou irreversível.
- **RNF-022**: validação estrita de papel no servidor. Na prática é a checagem explícita da
  camada de aplicação, conforme a ADR 0007.

## O que falta e o documento original não cobria

O documento original não mencionava **ICR em nenhum momento**, e ICR é o instrumento central da
Fase 2. Sem ele o painel de discordância vira uma tela de anotação sem medida por trás. Precisa
entrar:

- Cálculo de Krippendorff's Alpha como métrica primária e Cohen's Kappa como secundária, conforme o
  glossário.
- A faixa de referência embutida da literatura (abaixo de 0,667 questionável, 0,667 a 0,8 aceitável,
  0,8 ou mais boa), exibida nos painéis, sobrescrevível mas não obrigatória, conforme a ADR 0004.
- Concordância e Qualidade exibidas como dimensões separadas, conforme a ADR 0002.
- A matriz definição por critério, que é o que justifica manter prompt e codebook como entidades
  separadas.
- O recorte que separa o Administrador-avaliador dos demais avaliadores no ICR, conforme a ADR 0008.

## Decisões já tomadas que o Épico 2 herda prontas

Saíram da sessão de grilling e não precisam ser rediscutidas. Estão registradas no spec do Épico 1,
na seção de decisões que ele registra mas não constrói.

- **Rodada**: existe da Fase 2 em diante. Aponta para o par de versões (prompt e codebook) mais o
  conjunto de itens que consumiu, através de uma tabela de ligação. Fechar a rodada não avança a
  fase.
- **Resposta**: grava proveniência completa, ou seja, origem (gerada pela ferramenta ou colada à
  mão), modelo, versão do modelo, versão do prompt e versão do codebook. É o que a ADR 0002 exige
  para replicabilidade.
- **Saída da LLM**: texto livre e opaco. Sem parsing, sem formato imposto. Estruturar a saída está
  registrado como item em aberto no glossário.
- **Composição do envio**: na Fase 2 vai o prompt mais os títulos das definições. Critério nenhum vai
  à LLM antes da Fase 3.
- **Geração**: o número de 1 a 5 é a quantidade de **itens** processados por vez, uma resposta por
  item, sem repetir o mesmo item. Ler como "respostas por item" misturaria a variação não
  determinística do modelo com a discordância entre avaliadores, que é justamente o que a fase mede.
- **Itens**: vêm do pool do projeto, cadastrado no Épico 1. A tela de seleção mostra em quais rodadas
  cada item já foi usado, sem filtrar e sem travar.
- **Avaliação**: vinculada ao vínculo de membro, não ao usuário, para preservar com qual papel a
  pessoa avaliou. Imutável depois do envio, com a imutabilidade na camada de aplicação apoiada por
  restrições declarativas. Remover avaliador passa a significar desativar, e a chave estrangeira usa
  restrição em vez de cascata. Ver a ADR 0009.
- **Discordância e consenso**: escopados à rodada. O avaliador só vê os da rodada em que está
  avaliando, senão a Fase 4 acaba medindo a memória do grupo em vez da clareza do codebook. O
  Administrador vê tudo.
- **Vocabulário**: projeto e não sala, rodada e não iteração, item de entrada e não dados de teste.
  Resposta é a saída da LLM e nunca resposta de questionário.

## Perguntas em aberto, para a sessão de grilling do Épico 2

Estas foram levantadas e adiadas de propósito. São o ponto de partida da próxima sessão.

1. **Critérios Gerais**: como modelar a herança. A recomendação em registro é um Critério com
   vínculo opcional à definição, em que vínculo vazio significa geral e a herança é resolvida na
   leitura, evitando duplicar linhas e preservando a matriz definição por critério. Não foi
   confirmado.
2. **Escala**: fixar Alto, Médio e Baixo, como o documento original pedia, ou deixar configurável. O
   glossário hoje trata a escala como exemplo, e o documento original a trata como fixa. Se ficar
   fixa, o glossário precisa mudar.
3. **Ordem de autoria na Fase 2**: descrições e critérios são autorados antes da primeira geração,
   ou a rodada pode começar com o codebook ainda incompleto?
4. **Refinamento entre rodadas**: quando o Administrador cria uma versão nova de codebook no meio da
   fase, o que acontece com as respostas já geradas e as avaliações já enviadas da rodada anterior?
   A regra de que a avaliação fica presa à versão vigente já existe, mas falta desenhar a experiência
   de refinar e regerar.
5. **Falha parcial na geração**: se três de cinco itens forem gerados e dois falharem, o que a rodada
   registra? Isso ficou de fora do Épico 1 porque lá a geração não persiste.
6. **Atribuição**: todos os avaliadores avaliam todas as respostas, ou há distribuição? O ICR pede
   sobreposição, mas a sobreposição total pode ser cara em tempo humano.
7. **Progresso e fechamento**: qual a condição para o Administrador fechar a rodada? Todos os
   avaliadores terminaram, ou ele fecha quando quiser?

## Épicos seguintes, para não perder de vista

- **Épico 3, Fase 3, validar o prompt**: o codebook completo passa a ir à LLM junto com o prompt, e
  por isso as respostas mudam. Com ICR baixo refina-se o codebook, com ICR alto refina-se o prompt
  para empurrar a qualidade. Entra a meta opcional de qualidade, conforme a ADR 0004.
- **Épico 4, Fase 4, testar a replicação**: repete a avaliação com itens novos e avaliadores novos,
  sobre codebook e prompt congelados. Inclui o retorno da Fase 4 para a Fase 3, que descongela as
  versões e preserva a rodada já executada.
- **Sem épico ainda**: colar resposta manualmente (ADR 0003), chave de API trazida pelo usuário,
  escolha de modelo e de LLM, limites de requisição, e a LLM como avaliadora.
