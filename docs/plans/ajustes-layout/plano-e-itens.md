# Plano E: Upload de itens como botão

Ajuste **10** da referência visual `docs/plans/ajustes-layout/referencia-visual.html`.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | "Importar arquivo" ao lado de "+ Novo item", sem o input nativo em inglês (ajuste 10) | `feat(itens): importar arquivo como botão` | ✅ |

## Contexto

- Arquivo principal: `app/projects/[id]/pipeline/items-editor.tsx` (a aba é
  `app/projects/[id]/(tabs)/items/page.tsx`).
- Sem comentários novos, sem `npx prettier`. Teste afetado: `(tabs)/items/page.int.test.ts` (~190
  procura "Upload de itens"). Buscar outras frases antigas antes de mudar.
- Verificação: cena com projeto e alguns itens, `/dev/login` na `:3100`; testar o upload de verdade
  (escolher arquivo e arrastar), e o caso de pool vazio. Limpar a cena no fim.

## Hoje

- O cartão "Upload de itens" ocupa o topo da aba, acima da lista, com uma área de arrastar e um
  `<input type="file">` nativo (~138). O navegador mostra "Choose File / No file chosen" em inglês.
- O formulário de item tem outro `<input type="file">` nativo, "Carregar de um arquivo" (~96), com o
  mesmo problema.

## Proposta

- **Pool com itens**: o cartão grande sai. Na linha "N itens no pool · busca · + Novo item", entra um
  botão secundário **"Importar arquivo"** à esquerda de "+ Novo item". O botão é um `<label>` estilizado
  como `Button` (ver `buttonClassName` ou equivalente em `app/components/ui/button.tsx`) apontando para
  um `<input type="file" class="sr-only">`, com o mesmo `accept`, `disabled` e `onChange` de hoje.
- **Arrastar e soltar** continua funcionando: o alvo do drop passa a ser a lista inteira (com um
  destaque visual enquanto o arquivo está por cima).
- **Pool vazio**: a área grande de upload volta como estado inicial, porque ali ela é o primeiro passo.
- Os formatos aceitos ("Formatos de texto … até 2 MB") vão para o `InfoTooltip` do botão ou para o
  `help` da seção. Nenhum texto some.
- O input "Carregar de um arquivo" do formulário de item recebe o mesmo tratamento (rótulo em
  português, input escondido), sem mudar de lugar.
- Mensagens de "Lendo o arquivo…" e de erro continuam aparecendo perto de onde a ação aconteceu.
