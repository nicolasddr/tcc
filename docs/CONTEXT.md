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
Regra que define como julgar a *resposta da LLM*, e não o dado em si, com uma escala
(Alto/Médio/Baixo, por exemplo). Faz parte do codebook: na Fase 2 é usado pelos avaliadores
para validar o codebook e na Fase 3 vai também à LLM, como parte do codebook completo.
É autorado na Fase 2.

## Pipeline e avaliação

**Prompt**
A instrução enviada à LLM. É uma entidade separada do codebook, e na Fase 3 converge com ele
no envio ("o codebook é o prompt").

**Item de entrada**
Uma unidade de dado que vira uma resposta: uma pergunta de usuário, um commit, o conteúdo de
um `.bpmn`. É texto opaco para a ferramenta. Os itens pertencem a um pool do projeto, não a
uma fase, e as Fases 2 e 3 amostram desse pool.
Evitar: dado, registro.

**Resposta**
A saída da LLM para um item de entrada, produzida pelo pipeline (prompt + definições + item).

**Proveniência (da Resposta)**
O que permite reproduzir e comparar uma resposta: a origem (gerada pela ferramenta ou colada
manualmente), o modelo e a versão usados, e as versões de prompt e codebook que a produziram.
É exigida pela promessa de replicabilidade do Shah.

**Avaliar**
Ato do Avaliador de aplicar o codebook a uma resposta, atribuindo escala e justificativa.

**Validar**
Medir, via ICR, se os avaliadores aplicam o codebook de forma consistente (Fase 2).

**Refinar**
Mudar o número ou a descrição de itens entre rodadas. Na Fase 2 refina-se o codebook; na
Fase 3, primeiro o codebook (até o ICR subir) e depois o prompt (pela qualidade).

**Concordância (ICR)**
Grau em que avaliadores independentes chegam à mesma conclusão. Medida por Krippendorff's
Alpha (primária) ou Cohen's Kappa.
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
Estado explícito do projeto no processo de Shah (1, 2 e 3; a Fase 4 está fora do escopo). O
avanço é uma ação consciente do Administrador, nunca automático nem travado por métrica.

- *Fase 1, configurar o pipeline*: prompt inicial, itens, LLM e os títulos das definições.
  Termina com um *smoke test*, isto é, poucas respostas só para ver se o pipeline roda.
- *Fase 2, validar o codebook*: a LLM gera o lote avaliável ainda só com os títulos (a mesma
  entrada da Fase 1, em escala). Aqui se autoram descrições e critérios, que serão usados
  pelos avaliadores, avalia-se, calcula-se o ICR e refina-se o codebook até a concordância
  subir. A pergunta da fase é se o codebook está ambíguo; qualidade ainda não importa.
- *Fase 3, validar o prompt*: o codebook completo passa a ir à LLM junto com o prompt ("o
  codebook é o prompt"), e por isso as respostas mudam. Com ICR baixo, refina-se o codebook;
  com ICR alto, refina-se o prompt para empurrar a qualidade.

**Rodada**
Um ciclo de gerar respostas, avaliar e calcular ICR dentro de uma fase. É a unidade contável:
uma fase é feita de várias rodadas. Entre uma rodada e a próxima, o Administrador refina (o
codebook na Fase 2, o codebook ou o prompt na Fase 3).
Evitar: iteração como unidade contável ("iterativo" só como adjetivo do processo).

## Papéis

**Administrador de Projeto**
Conduz o processo: cria o projeto, autora o codebook, itera o prompt e acompanha as métricas.
Todo usuário com permissão que cria um projeto vira seu Administrador.
Evitar: Pesquisador (não existe esse papel).

**Avaliador**
Avalia respostas da LLM de forma independente, seguindo o codebook. Não autora o codebook.

**Super-admin**
Administrador da plataforma; aprova ou rejeita permissão para criar projetos.

## Em aberto

- LLM como avaliadora (*could-have*): se for construída, decidir se conta no ICR principal ou
  se aparece como lente separada (LLM contra consenso humano). A recomendação em registro é a
  lente separada. Resolver no Épico 3 ou depois.
