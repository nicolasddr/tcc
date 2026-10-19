# Importação de itens em lote

Escrito em 2026-10-19 contra o `main` em `85c22d8`. Sem issue no GitHub: os commits não levam
`Refs`/`Closes`.

**Objetivo:** o Administrador escolhe ou arrasta vários arquivos de uma vez na aba Itens, vê **só os
títulos** que vão virar itens (e quais arquivos foram recusados, com o motivo curto) e cadastra todos
num clique. O conteúdo dos arquivos não aparece na tela antes do cadastro. Um arquivo só continua
abrindo o formulário editável de hoje.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Servidor e leitura: `createItems` (tudo ou nada, ordem estável), leitura de vários arquivos com motivo curto, limites do lote, `bodySizeLimit` | `feat(itens): cadastrar vários itens numa ação só` | |
| 2 | Tela: seleção múltipla, painel do lote só com títulos, cadastro, textos de ajuda | `feat(itens): importar vários arquivos de uma vez vendo só os títulos` | |

A Parte 1 não muda nada visível: nenhuma tela chama `createItems` ainda. A Parte 2 só mexe em
componente e texto.

**Decisões ⚠ D1, D3 e D4 confirmadas pelo usuário em 2026-10-19**, todas na opção recomendada:
lote é vários arquivos (um item por arquivo), não CSV; um envio por lote, tudo ou nada, com
`bodySizeLimit` de 4 MB; prévia só com títulos, não editáveis. Não perguntar de novo.

---

## 1. Ponto de partida

| Peça | Onde | Nesta série |
|---|---|---|
| Tela | `(tabs)/items/page.tsx` → `pipeline/items-editor.tsx` (`ItemsEditor`) | Parte 2 |
| Leitura de arquivo | `pipeline/item-content.ts`: `readItemFile` (lista de permissão, 2 MB, UTF-8 estrito, `\0`, vazio, 50.000 caracteres), `normalizeItemContent`, `itemContentError` | Parte 1 acrescenta a leitura do lote |
| Um arquivo por vez | `items-editor.tsx`: `useItemFile` recusa `files.length > 1` com `ONE_FILE`; `baseName` tira a extensão; o arquivo abre `NewItemPanel` com nome e conteúdo editáveis | Parte 2 troca a recusa pelo lote |
| Cadastro | `pipeline/actions.ts`: `parseItemForm` (~619), `createItem` (~634): `isProjectAdmin`, um `insert` por chamada, `revalidatePath` de `/items` e do projeto | Parte 1 extrai a validação e cria `createItems` |
| Ordem do pool | `pipeline/items.ts`: `loadItems` ordena só por `asc(createdAt)` | Parte 1 (achado 1) |
| Limites | `lib/limits.ts`: `ITEM_NAME_MAX` 200, `ITEM_CONTENT_MAX` 50.000, `ITEM_FILE_BYTES_MAX` 2 MB | Parte 1 acrescenta os do lote |
| Config | `next.config.ts` vazio: Server Actions com o corpo padrão de 1 MB | Parte 1 (achado 2) |
| Testes | `pipeline/actions.int.test.ts`: "itens de entrada no pool do projeto" (~1176, helper `itemFd`) e "item cadastrado a partir de arquivo" (~1485, `readText`/`readError`); `(tabs)/items/page.int.test.ts` (~176 e ~205 conferem os textos do upload) | as duas Partes |

Caminhos curtos são relativos a `app/projects/[id]/`.

---

## 2. O que a leitura do código achou

1. **Itens gravados na mesma transação ficam com o mesmo `created_at`.** A coluna usa `defaultNow()`,
   e `now()` no Postgres é o início da transação. Um `insert` de vários itens faria todos empatarem, e
   `loadItems` (só `asc(createdAt)`) os listaria em ordem indefinida, que pode mudar entre
   recarregamentos. Saída na Parte 1: gravar `createdAt` explícito por posição,
   `` sql`now() + ${i} * interval '1 microsecond'` ``, na ordem da prévia. Não mexe em `loadItems` nem
   em quem amostra o pool.
2. **O corpo de uma Server Action tem 1 MB por padrão** (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md`).
   Um item pode ter 50.000 caracteres (até ~200 KB em UTF-8), então cinco itens grandes já passam do
   limite, e o erro do Next não diz nada útil ao usuário. Ver D3.
3. **As mensagens de recusa de `readItemFile` são para um arquivo só**: falam em "cole o conteúdo
   direto no campo" e "carregar no campo". Numa lista de 30 arquivos isso não cabe. A Parte 1 dá a
   cada recusa um motivo curto (`reason`) sem mudar o `error` de hoje, que os testes (~1587–1640)
   conferem.
4. **`ITEM_FILE_NOTE` deixa de ser verdade para o lote** ("O conteúdo entra no formulário e continua
   editável antes de cadastrar"). Está no `more` da seção e nos dois testes da página (~201, ~224).
   Parte 2 reescreve e atualiza os testes.
5. **O nome do item no lote vem do nome do arquivo**, e o nome do arquivo pode passar de 200
   caracteres (raro, mas a action recusaria o lote inteiro). A leitura do lote marca esse arquivo como
   recusado, com motivo, em vez de mandá-lo.
6. **Não há unicidade de nome no pool** (`input_items` só tem CHECKs de tamanho e branco), e
   `createItem` aceita nome repetido hoje. Ver D5.
7. **Carregar um arquivo com um rascunho aberto já substitui o rascunho sem perguntar**
   (`openDraft` troca a `key`). O lote segue o mesmo comportamento; mudar isso fica fora deste plano.

---

## 3. Decisões

**D1 ⚠. O que é "lote".** Duas leituras possíveis do pedido:

- **(a) recomendada: vários arquivos, um item por arquivo.** O título é o nome do arquivo sem
  extensão, como já acontece hoje com um arquivo só. É a extensão natural do que existe (`ONE_FILE`
  já diz "Nesta fase, um arquivo por vez"), e todos os formatos aceitos continuam valendo.
- **(b) um arquivo com vários itens** (CSV com colunas nome/conteúdo, ou JSON Lines). Conflita com o
  que existe: hoje um `.csv` inteiro vira **um** item, e a ferramenta trata o conteúdo como texto
  opaco (CONTEXT, *Item de entrada*). Exigiria formato, parser, colunas e mensagens novas.

**Confirmada: (a).**

**D2. Um arquivo só continua abrindo o formulário editável.** Preserva a HU-19 ("o conteúdo do
arquivo aparece no campo, editável antes de salvar"). Dois ou mais arquivos abrem o lote. A
alternativa (sempre o lote) tiraria a edição antes de cadastrar de quem sobe um arquivo só.

**D3 ⚠. Tamanho do lote.** Opções:

- **(a) recomendada: um envio por lote, tudo ou nada.** `serverActions.bodySizeLimit: '4mb'` no
  `next.config.ts` (abaixo do teto de 4,5 MB do corpo de função na Vercel), e dois limites novos em
  `lib/limits.ts`: `ITEM_BATCH_MAX = 500` itens (conferido no navegador **e** na action) e
  `ITEM_BATCH_BYTES_MAX = 3 * 1024 * 1024` (nomes + conteúdos em UTF-8, conferido **só no
  navegador**, como o `ITEM_FILE_BYTES_MAX`: o servidor nem chegaria a ler um corpo maior). Lote
  acima disso não é enviado, e o painel diz o tamanho e o limite.
- **(b) envio em pedaços**: o navegador manda o lote em fatias de ~800 KB, uma action por fatia, sem
  mexer na config. Sem limite prático, mas uma falha no meio deixa o lote metade cadastrado, e a tela
  precisa explicar o que entrou e o que não.

O `bodySizeLimit` vale para todas as Server Actions do app; 4 MB ainda é pequeno. **Confirmada:
(a).**

**D4 ⚠. A prévia mostra só títulos, e os títulos não são editáveis nela.** Cada linha: o título, e
um botão para tirar o arquivo do lote. Renomear fica para depois do cadastro, pelo "Editar" da linha
do item. A alternativa é um campo de nome por linha, que ajuda quem tem arquivos mal nomeados mas
vira um formulário de 30 campos. O conteúdo **nunca** vai para o markup do painel (é o requisito; tem
teste na Parte 2). **Confirmada.**

**D5. Nome repetido não bloqueia.** O pool não tem unicidade e a ferramenta "só informa" (CONTEXT).
A prévia marca o título que já existe no pool ou que se repete dentro do lote ("já existe no pool",
"repetido no lote"), sem impedir o cadastro.

**D6. Arquivo recusado não derruba o lote.** A prévia separa "prontos para cadastrar" de "recusados"
(título + motivo curto). O botão cadastra só os prontos. No servidor, o lote recebido é tudo ou nada:
se algum item for inválido (o que só acontece por caminho fora da tela), nada é gravado e a mensagem
nomeia o item.

**D7. Ordem.** A prévia ordena os títulos por nome com `localeCompare('pt-BR', { numeric: true })`
("Consulta 2" antes de "Consulta 10"), e o pool recebe os itens nessa mesma ordem (achado 1).

---

## 4. Gotchas

- Caminho com `[id]` no filtro do vitest dá "No test files found": filtrar por substring
  (`npx vitest run actions.int`), e `-t` pelo título do `describe`.
- Separador de saída no zsh não pode começar com `=` (vira expansão de caminho).
- `scores` precisa estar vazia antes de `npm test` (cena de conferência no banco quebra os int tests);
  outra sessão rodando vitest junto dá vermelhos aleatórios (`pgrep -fl vitest`).
- Sem Prettier no repo; sem comentários novos no código.
- Mudou texto de ajuda ou rótulo: buscar a frase antiga nos testes antes de prever edições (inclusive
  o prefixo cortado, como `'Arraste um arquivo'`).
- TDD: ver o teste falhar pela asserção, não pelo import, antes do código.

---

## 5. Parte 1 — Servidor e leitura do lote

### 5.1 Limites — `lib/limits.ts`

`ITEM_BATCH_MAX` e `ITEM_BATCH_BYTES_MAX` (D3). Sem CHECK no banco: não são propriedade de uma
linha.

### 5.2 Motivo curto da recusa — `pipeline/item-content.ts` (TDD, integração)

No describe "item cadastrado a partir de arquivo" de `pipeline/actions.int.test.ts`:

- [ ] cada recusa de `readItemFile` traz `reason` curto, além do `error` de hoje: formato não aceito,
      PDF ou Word, não é texto, maior que 2 MB, mais de 50.000 caracteres, vazio. Conferir o texto
      exato de cada um; os testes antigos de `error` não mudam.

Depois: `ItemFileResult` vira `{ error: string; reason: string } | { text: string }`. `readError` dos
testes continua lendo `error`.

### 5.3 Leitura de vários arquivos — `pipeline/item-content.ts` (TDD, integração)

Função nova `readItemBatch(files: File[], poolNames: string[]): Promise<ItemBatch>`, no mesmo arquivo,
com `baseName` movido de `items-editor.tsx` para cá (exportado).

```ts
export type ItemBatchEntry =
  | { key: string; name: string; content: string; duplicate: 'pool' | 'batch' | null }
  | { key: string; name: string; reason: string }

export type ItemBatch = { ready: ItemBatchEntry[]; refused: ItemBatchEntry[]; bytes: number }
```

(nomes finais a critério de quem implementa; registrar no handoff). Testes, num describe novo
"lote de arquivos":

- [ ] lê cada arquivo com `readItemFile`, um de cada vez, e nomeia pelo nome sem extensão;
- [ ] ordena os prontos por nome com ordenação numérica (D7);
- [ ] separa os recusados com o `reason` de 5.2, sem derrubar os outros;
- [ ] recusa o arquivo cujo nome sem extensão passa de `ITEM_NAME_MAX`, ou fica em branco (`.txt`
      puro), com motivo;
- [ ] marca `duplicate: 'pool'` (comparação sem diferenciar caixa e com `trim`) e `'batch'`;
- [ ] `bytes` soma nome + conteúdo em UTF-8 (`TextEncoder`) só dos prontos;
- [ ] `key` estável e única mesmo com dois arquivos de mesmo nome (ex.: `a.txt` e `a.md`).

### 5.4 Validação compartilhada — `pipeline/actions.ts`

Extrair de `parseItemForm` um `parseItem(name: string, content: string)` com as mesmas regras e
mensagens; `parseItemForm` passa a chamá-lo. Sem teste novo: os de `createItem`/`updateItem`
existentes cobrem.

### 5.5 `createItems` — `pipeline/actions.ts` (TDD, integração)

Assinatura no idioma das outras: `createItems(_prev: ItemsState, formData: FormData)`, com
`project_id` e os pares em `formData.getAll('name')` / `formData.getAll('content')`.
`ItemsState = { error: string } | { ok: true; nonce: number; count: number } | null`.

Num describe novo "itens cadastrados em lote", com um helper `batchFd(project, items)` ao lado do
`itemFd`:

- [ ] cadastra todos com `createdBy`, e `loadItems` os devolve **na ordem enviada**, depois dos itens
      que já estavam no pool (achado 1); um item cadastrado depois por `createItem` vem depois deles;
- [ ] normaliza CRLF e BOM de cada conteúdo, como `createItem`;
- [ ] aceita nomes repetidos entre si e com o pool (D5);
- [ ] um item inválido (nome em branco, conteúdo em branco, nome acima de 200, conteúdo acima de
      50.000) recusa o lote inteiro, **nada é gravado**, e a mensagem nomeia o item (posição e nome);
- [ ] lote vazio e quantidade diferente de nomes e conteúdos são recusados;
- [ ] acima de `ITEM_BATCH_MAX` é recusado, com a mensagem dizendo o limite;
- [ ] avaliador ativo e não-membro recebem `ITEM_CREATE_DENIED`, e nada é gravado;
- [ ] na Fase 4 o lote é aceito (o pool continua aberto, como `createItem`).

Depois: `isProjectAdmin` antes de gravar; um `transaction` com um `insert(...).values([...])` e
`createdAt` por posição; os mesmos dois `revalidatePath` de `createItem`.

O teste "não existe ação de apagar versão" (~491) confere `Object.keys(actions)` com `toEqual` e
**quebra**: acrescentar `'createItems'` logo depois de `'createItem'` (a ordem é a de exportação).

### 5.6 Config — `next.config.ts`

`serverActions.bodySizeLimit: '4mb'` (D3). Ler o guia em `node_modules/next/dist/docs/` para saber se
no 16.2 a chave ainda fica em `experimental`. Sem teste automatizado; conferir na Parte 2, no
navegador, com um lote de ~2 MB.

### 5.7 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- Nenhuma tela mudou (`git diff --stat` sem `.tsx`).
- Testes antigos editados: só o da lista de actions (5.5). Listar no handoff.

### 5.8 O que a Parte 2 herda

Preenchido em 2026-10-19, ao fim da Parte 1 (sem commit ainda).

- **Decisões:** D1–D7 como estão; nenhuma nova.
- **Tipos** (`pipeline/item-content.ts`): em vez da união do plano, dois tipos separados.
  `ItemBatchReady = { key; name; content; duplicate: 'pool' | 'batch' | null }`,
  `ItemBatchRefused = { key; name; reason }`, `ItemBatch = { ready; refused; bytes }`.
- **`readItemBatch(files, poolNames)`**: lê em sequência; `key` = `` `${posição}:${file.name}` ``
  (estável para a mesma lista); nome = `baseName(file.name).trim()`. Prontos e recusados saem
  ordenados por nome (`localeCompare('pt-BR', { numeric: true })`). No **recusado**, `name` é o nome
  do arquivo **com extensão** (ex.: `artigo.pdf`), para identificar o arquivo. `duplicate`: `'pool'`
  tem precedência sobre `'batch'`; no lote, **todas** as ocorrências repetidas ficam marcadas.
  `bytes` só dos prontos. `readItemBatch` **não** confere `ITEM_BATCH_MAX` nem
  `ITEM_BATCH_BYTES_MAX`: o painel compara `ready.length` e `bytes`.
- **`baseName`** saiu de `items-editor.tsx` e é importado de `item-content.ts` (único `.tsx` no
  diff; sem mudança visível).
- **Motivos curtos** (`reason`): `Formato não aceito`, `PDF e Word não são aceitos`,
  `Não é texto puro`, `Maior que 2 MB`, `Mais de 50.000 caracteres`, `Arquivo vazio`; só no lote:
  `Nome em branco`, `Nome com mais de 200 caracteres`.
- **`createItems(_prev: ItemsState, formData)`** (`pipeline/actions.ts`): `project_id` + pares
  `getAll('name')`/`getAll('content')`. Sucesso `{ ok, nonce, count }`. Mensagens: lote vazio
  "Nenhum item para cadastrar. Escolha os arquivos de novo."; quantidades diferentes "O lote chegou
  incompleto: …"; acima do limite "Um lote pode ter no máximo 500 itens, e este tem N. Cadastre o
  restante em outro lote."; item inválido "Item 3 (“Nome”): <mensagem de `createItem`>" (sem o
  parêntese quando o nome está em branco; nome cortado em 60 caracteres com "…"); sem permissão,
  o mesmo `ITEM_CREATE_DENIED` de `createItem`.
- **Validação**: `parseItem(name, content)` extraído; `parseItemForm` só o chama.
- **`bodySizeLimit`**: no Next 16 ainda fica em `experimental.serverActions` (tipo em
  `next/dist/server/config-shared.d.ts`); `'4mb'`. Não conferido no navegador (fica para 6.5).
- **Testes antigos editados:** só a lista de `Object.keys(actions)` (`'createItems'` depois de
  `'createItem'`). Novos: um teste de `reason` em "item cadastrado a partir de arquivo" e os
  describes "lote de arquivos" (7) e "itens cadastrados em lote" (8), com o helper `batchFd`.

---

## 6. Parte 2 — A tela do lote

### 6.1 Seleção e arraste de vários arquivos — `pipeline/items-editor.tsx`

- `HiddenFileInput` ganha a prop `multiple`. Usam `multiple`: o "Escolher arquivo" da zona vazia, o
  "Importar arquivo" e o arraste sobre a lista. **Não** usa: o "Carregar de um arquivo" do formulário
  de edição, que troca o conteúdo de um item.
- `useItemFile` perde a recusa de `ONE_FILE` (a constante sai). Um arquivo → `openDraft`, como hoje
  (D2). Dois ou mais → `readItemBatch` e abre o painel do lote no lugar do `NewItemPanel` (os dois não
  ficam abertos juntos; achado 7).
- Enquanto lê: "Lendo N arquivos…" no lugar de "Lendo o arquivo…".

### 6.2 Painel do lote — componente novo, exportado (`ItemBatchPanel`)

`Panel tone="accent"`, título "Importar N arquivos", ação "Cancelar".

- Linha de resumo: "N itens prontos para cadastrar" e, se houver, "M arquivos recusados" (`plural`).
- Lista dos prontos: **só o título** (D4), com a marca de D5 quando houver, e um botão por linha para
  tirar do lote (`aria-label` "Tirar “X” do lote").
- Lista dos recusados, depois, em tom apagado: título + motivo curto. Não são enviados.
- Acima de `ITEM_BATCH_BYTES_MAX` ou de `ITEM_BATCH_MAX`: `Alert` de erro dizendo o tamanho e o
  limite e pedindo para tirar arquivos e enviar o resto depois; botão desabilitado.
- Botão "Cadastrar N itens" (`loadingText` "Cadastrando…"), desabilitado com zero prontos. Monta o
  `FormData` e chama `createItems` por `startTransition(() => submit(data))`, como
  `codebook-editor.tsx` (~861).
- Erro do servidor: `Alert` de erro, a lista continua como estava.
- Sucesso: o painel fecha e aparece `Alert` de sucesso "N itens cadastrados." acima da lista (padrão
  `nonce` do `NewItemPanel`).

O conteúdo dos arquivos fica só no estado do componente e no `FormData`; nunca em atributo, `title`,
`aria-*` ou texto renderizado.

### 6.3 Textos

Conferir cada frase contra o código antes de escrever:

- zona vazia: "Arraste um arquivo de texto aqui" → "Arraste arquivos de texto aqui";
- `ITEM_FILE_NOTE`: dizer que um arquivo entra no formulário e continua editável, que vários arquivos
  viram um item cada com o nome do arquivo, e que o arquivo em si não é guardado;
- `editFileHint` (formulário de edição) não muda.

### 6.4 Testes (TDD) — `(tabs)/items/page.int.test.ts`

- [ ] o painel do lote, renderizado com prontos e recusados, mostra os títulos, as marcas de D5, os
      motivos e "Cadastrar N itens", e **não contém o conteúdo** de nenhum arquivo (conteúdo com uma
      marca única, ex. `CONTEUDO-SECRETO-1`, ausente do markup);
- [ ] com lote acima do limite de bytes, o botão sai desabilitado e o alerta diz o limite;
- [ ] com zero prontos, o botão sai desabilitado;
- [ ] a zona vazia e o "Importar arquivo" têm input com `multiple`; o "Carregar de um arquivo" do
      formulário de edição não tem;
- [ ] os testes de ~176 e ~205 com os textos novos (zona vazia e `ITEM_FILE_NOTE`).

### 6.5 Conferência no navegador

Preview do dev server, login por `/dev/login`, aba Itens de um projeto com e sem itens:

- escolher 3+ arquivos pelo botão e arrastar outros 3+ sobre a lista (no preview, pôr os arquivos no
  input por `DataTransfer` via `javascript_tool` e disparar `change`/`drop`);
- um arquivo recusado no meio (ex.: `.pdf`) aparece em "recusados" e não impede os outros;
- cadastrar: os itens aparecem no fim do pool, na ordem da prévia, sem recarregar a página;
- um lote de ~2 MB passa (confirma o `bodySizeLimit`), e um acima de 3 MB é barrado no painel;
- um arquivo só continua abrindo o formulário editável;
- 375 px: os títulos longos quebram sem empurrar a página para o lado.

### 6.6 Pronto quando

- `npm run lint`, `npm run typecheck`, `npm test` verdes.
- Conferência de 6.5 feita, com captura do painel.

---

## 7. Fora deste plano

- Um arquivo com vários itens (CSV, JSON Lines): D1 (b).
- Editar título ou conteúdo na prévia do lote: D4.
- Desfazer um lote cadastrado, ou remover vários itens de uma vez.
- Perguntar antes de substituir um rascunho aberto ao carregar arquivo (achado 7).
