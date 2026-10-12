# Plano F: Codebook, Prompt e Itens com um padrão só de edição

Sugestão 6 da análise de 12/10 (`referencia-visual.html#s6`). Faça depois do Plano E e antes do G.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | `SaveBar` com "Cancelar"/"Descartar"; `EditableRow` com "Editar" visível; Codebook com "Editar" no cabeçalho e sem o segundo "Definições" | `refactor(codebook): editar no cabeçalho e barra de salvar em toda edição` | |
| 2 | Prompt com "Editar" e a `SaveBar` no lugar de "Salvar prompt" + "Voltar à leitura" | `refactor(prompt): edição com a barra de salvar` | |
| 3 | Itens com "Editar" visível por linha, `SaveBar` no item aberto e o estado vazio sem busca | `refactor(itens): editar visível e barra de salvar no item` | |

## O padrão

- **Entrar**: botão "Editar" (`secondary`, `sm`) no canto direito do cabeçalho do bloco. Item
  congelado: "Ver conteúdo".
- **Em edição**: a `SaveBar` fixa no rodapé, sempre visível enquanto a edição está aberta, com a
  frase do que mudou à esquerda e dois botões à direita.
- **Sair**: "Descartar" quando há alteração (desfaz e sai), "Cancelar" quando não há (só sai).
  "Salvar" fica desabilitado sem alteração. Somem "Voltar à leitura", "Concluir edição" e o "Fechar"
  de edição.
- Depois de salvar, volta à leitura com a mensagem de sucesso de hoje ("Definições salvas.",
  "Prompt salvo.").

## Contexto comum

- Arquivos:
  - `app/components/ui/save-bar.tsx` e `ui/editable-row.tsx`;
  - `app/projects/[id]/pipeline/codebook-editor.tsx` (`SectionTitle` ~172 e ~522, `CodebookFields`
    com `dirty` ~486 e `discard` ~497, a `SaveBar` ~712, `CodebookEditor` ~759, "Editar definições"
    ~822), `pipeline/version-status.tsx`;
  - `pipeline/prompt-editor.tsx` (~95–220) e `pipeline/prompt-metadata-editor.tsx`;
  - `pipeline/items-editor.tsx` (`NewItemPanel` ~225, `EditItemForm` ~265, `ItemRow` ~325,
    `ItemsEditor` ~364);
  - `(tabs)/codebook/page.tsx`, `(tabs)/prompt/page.tsx`, `(tabs)/items/page.tsx`.
- Decisões herdadas do redesenho das telas (memória "Redesenho das telas"):
  - o modo leitura/edição é **derivado** (`editingNonce === savedNonce`), não um `useState` de modo.
    O eslint proíbe `setState` dentro de `useEffect`, então a volta à leitura depois de salvar não
    pode ser feita por efeito;
  - o `EditableRow` esconde o corpo por **classe** (`flex`/`hidden`), nunca pelo atributo `hidden`;
    campos escondidos continuam montados, com `required={expanded}`;
  - o foco volta ao botão de abrir quando o painel fecha.
- O aviso de saída (`beforeunload`) continua onde existe hoje, ligado ao `dirty`.
- Só apresentação: as actions (`saveCodebook`, `savePrompt`, `updateItem`, `createItem`) e as
  regras de versão não mudam.
- Testes: `(tabs)/codebook/page.int.test.ts`, `(tabs)/prompt/page.int.test.ts`,
  `(tabs)/items/page.int.test.ts`, `pipeline/page.int.test.ts`. Procure "Editar definições",
  "Editar texto", "Salvar prompt", "Voltar à leitura", "Concluir edição", "Salvar item", "Salvar
  definições".

## Parte 1: `SaveBar`, `EditableRow` e Codebook

**Hoje**
- A `SaveBar` só aparece com alteração (`dirty`). Sem alteração, o Codebook em edição mostra
  "Voltar à leitura". O botão de salvar diz "Salvar definições".
- "Editar definições" (primário) fica no **pé** da lista, em leitura.
- Em edição, o cartão interno repete o título "Definições" (`SectionTitle` ~522), logo abaixo do
  `Section` "Definições" da página. O ⓘ desse título explica a ordem (`ORDER_HELP`).
- O `EditableRow` só tem o nome do item/definição como botão (o "Editar" é `sr-only`) e um rodapé
  com "Concluir edição".

**Proposta**
- **`SaveBar`**: nova prop `dirty: boolean`. Com `dirty`, "Descartar"; sem, "Cancelar" e o
  "Salvar" desabilitado. A frase da esquerda sem alteração é "Nenhuma alteração.". O `saveLabel`
  padrão continua "Salvar".
- **`EditableRow`**:
  - o título deixa de ser botão; o botão de abrir é um "Editar" visível (`secondary`, `sm`), à
    direita, antes do `actions`, com `aria-expanded` e `aria-controls`. O texto vem do
    `expandLabel` de hoje;
  - o clique no cartão fechado continua abrindo (atalho de mouse);
  - sai o rodapé com o `collapseLabel`. O `footer` (texto) continua, sem o botão;
  - o botão "Editar" some enquanto o painel está aberto, exceto no caso do ⚠ F3.
- **Codebook em leitura**: "Editar" vai para a linha do `VersionStatus` ("Versão 2 · Em aberto ⓘ
  [Editar]"). O `VersionStatus` ganha uma prop `action` (mostrada à direita). Sem versão e sem
  definições, o caminho de hoje (`onAdd` no estado vazio) continua.
- **Codebook em edição**: a `SaveBar` aparece sempre, com `dirty` e `saveLabel` "Salvar". Sai o
  `FormActions` com "Voltar à leitura". Sai o `SectionTitle` "Definições" do cartão interno; o
  `ORDER_HELP` passa a um ⓘ curto ao lado do contador ou do botão de adicionar, ou ao `hint` do
  `Section` da página em edição. Escolha o lugar que deixa a frase visível perto da lista.

**⚠ F3. Como recolher uma definição no Codebook em edição.** Ali o `EditableRow` não é "sair da
edição": a `SaveBar` é global e várias definições podem ser mexidas antes de salvar. Sem o "Concluir
edição", falta um jeito visível de recolher o painel de uma definição.
- Recomendado: o botão do cabeçalho alterna entre "Editar" e "Recolher" (só nas definições). As
  alterações recolhidas continuam contadas na `SaveBar`.
- Alternativa: abrir outra definição recolhe a atual (já é assim, `expandedKey`), e não há botão
  de recolher.

Confirmar antes de implementar.

**Passos**
1. **(TDD)** Testes da `SaveBar` (unitário: rótulos com e sem `dirty`, "Salvar" desabilitado) e do
   Codebook (`codebook/page.int.test.ts`: o "Editar" está na linha da versão; em edição há uma
   `SaveBar`, nenhum "Voltar à leitura" e um título "Definições" só). Leia os vermelhos.
2. `SaveBar`, `EditableRow`, `VersionStatus` e `codebook-editor.tsx`.
3. Navegador: entrar e sair com e sem alteração, salvar, recolher uma definição (F3), e conferir
   que fechar a aba com alteração ainda avisa.

**Pronto quando**
- O Codebook tem "Editar" no cabeçalho, e em edição só a `SaveBar` (Cancelar/Descartar e Salvar).
- Só um "Definições" na tela em edição.
- Salvar volta à leitura com "Definições salvas.".
- Lint, typecheck e testes passam.

## Parte 2: Prompt

**Hoje** (`prompt-editor.tsx`)
- Em leitura, "Editar texto" (ou "Escrever o prompt") no cabeçalho do `Panel`, primário.
- Em edição, "Salvar prompt" e "Voltar à leitura" no fim do formulário.
- Os metadados (`PromptMetadataEditor`, dentro do `Disclosure` "Detalhes da versão…") são outro
  formulário, sempre editável, com "Salvar dados do prompt".

**Proposta**
- "Editar" (`secondary`, `sm`) no cabeçalho do `Panel`, ao lado de "Histórico". Sem versão, o
  rótulo "Escrever o prompt" continua (é a primeira escrita, não uma edição), no mesmo estilo.
- Em edição, a `SaveBar` com `dirty = text !== (version?.text ?? '')` e "Salvar" também desabilitado
  com texto vazio (a regra de hoje). Sai o `FormActions`.
- A frase da `SaveBar` com alteração: "Texto do prompt alterado.".
- Adicione o `beforeunload` com `dirty`, igual ao do Codebook, se o Prompt ainda não tiver.

**⚠ F1. Os metadados do prompt.** O formulário "Salvar dados do prompt" não é um modo de edição:
salva nome, descrição e registro de mudanças sem criar versão.
- Recomendado: fica como está, dentro do `Disclosure`, com o próprio botão. Muda só o rótulo para
  "Salvar dados" (o contexto já diz que é do prompt).
- Alternativa: entra no mesmo padrão, com "Editar" no resumo do `Disclosure` e a `SaveBar`.

Confirmar antes de implementar.

**Pronto quando**
- Prompt com "Editar" no cabeçalho, edição com a `SaveBar`, e salvar volta à leitura com "Prompt
  salvo.".
- Fase 4 (congelado): sem "Editar", o aviso de congelado continua (o tom muda no Plano G).
- Lint, typecheck e testes passam.

## Parte 3: Itens

**Hoje** (`items-editor.tsx`)
- Cada item é um `EditableRow`: abrir é clicar no cartão; o "Editar" é só `sr-only`. O ⋯ tem só
  "Remover".
- Aberto, o `EditItemForm` tem "Salvar item" e o rodapé do `EditableRow` tem "Concluir edição".
  Item congelado: "Ver conteúdo" e "Fechar".
- "Novo item" abre o `NewItemPanel` com "Fechar" e "Cadastrar item".
- Com o pool vazio, a linha de cima mostra "0 itens no pool" e a busca "Buscar no pool".

**Proposta**
- Cada linha mostra "Editar" visível (Parte 1), ao lado do ⋯. Congelado: "Ver conteúdo"; aberto, o
  item congelado mostra "Fechar" no lugar do "Ver conteúdo" (não é saída de edição, é fechar a
  leitura).
- Item aberto: o `EditItemForm` usa a `SaveBar` (fixa dentro da linha, `sticky bottom-0`), com
  `dirty` comparando nome e conteúdo aos de hoje. Para saber o `dirty`, os campos do `ItemFields`
  passam a ser controlados no `EditItemForm`, ou o formulário escuta `onInput` e compara os
  valores. "Descartar" restaura e fecha; "Cancelar" fecha.
- `NewItemPanel`: o "Fechar" do cabeçalho vira "Cancelar" sem nada digitado e "Descartar" com algo
  digitado. "Cadastrar item" continua (cria, não edita).
- Pool vazio: sai a busca e a linha "0 itens no pool · 0 caracteres". O estado vazio diz "Nenhum
  item de entrada ainda. Envie o primeiro pelo bloco acima." (aponta para o "Enviar itens" do Plano
  A). O "Novo item" continua.

**⚠ F2. Depois de salvar um item.**
- Recomendado: a linha fecha e mostra "Item atualizado." logo abaixo do título por alguns
  segundos (ou até a próxima ação), como o Codebook e o Prompt voltam à leitura depois de salvar.
- Alternativa: continua aberta, como hoje, com "Item atualizado." acima da `SaveBar`.

Confirmar antes de implementar.

**Pronto quando**
- Todo item tem "Editar" (ou "Ver conteúdo") visível, e o item aberto usa a `SaveBar`.
- Não há mais "Concluir edição", "Salvar item" nem "Fechar" de edição em nenhuma das três abas
  (`grep -rn "Concluir edição\|Voltar à leitura\|Salvar item\|Salvar prompt\|Salvar definições"
  app` só acha testes que afirmam a ausência).
- Pool vazio sem busca, com o estado vazio apontando para o envio.
- Editar, descartar, cancelar e salvar um item funcionam no navegador, inclusive com 375 px.
- Lint, typecheck e testes passam.
