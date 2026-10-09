# Plano F: Uma explicação por bloco no Codebook, no Prompt e no Itens

Sugestão **Uma explicação por bloco** da referência visual:
`docs/plans/melhorias-layout/referencia-visual.html#s-texto`.

O restante dessa sugestão já está em outros planos:
- as legendas das tabelas da aba Rodadas estão no Plano C, Parte 2;
- os itens do checklist de fase estão no Plano E, Parte 1.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Codebook, Prompt e Itens: estado vazio com o próximo passo, histórico só a partir da v1 e nenhuma frase repetida | `refactor(textos): uma explicação por bloco no codebook, prompt e itens` | ⬜ |

## A regra

Cada bloco (`Section`) tem um título, **no máximo uma frase visível** (`hint`) e **um ⓘ** (`help`).
A frase e o ⓘ não dizem a mesma coisa. Segue o padrão do redesenho: frase curta na tela, texto longo
no ⓘ. Também vale a regra "nenhum texto some": o texto muda de lugar, mas não é apagado.

O `app/components/ui/section.tsx` **não muda**, e a regra não vira comentário. Ela se aplica ao
conteúdo dos `hint` e `help` de cada tela.

Exemplo: em "Definições" (`codebook/page.tsx` ~39), o `hint` é "Os conceitos que estruturam a tarefa
da LLM." e o `help` começa com a mesma frase. O `help` perde essa abertura repetida.

## Contexto

- Arquivos:
  - `app/projects/[id]/(tabs)/codebook/page.tsx`, `prompt/page.tsx` e `items/page.tsx`;
  - `app/projects/[id]/pipeline/codebook-editor.tsx`, `codebook-history.tsx`, `prompt-history.tsx`
    e `version-status.tsx`.
- Antes de mexer, leia `docs/CONTEXT.md` e o `AGENTS.md`.
- Convenções:
  - nada de comentários novos e nada de `npx prettier`;
  - procure cada frase antiga nos testes antes de mudá-la;
  - o `markupTextOf` lê o texto dos ⓘ, então texto movido continua no markup; para afirmar que algo
    saiu, use o aria-label ou a prop, não a ausência do texto.
- Verificação:
  - use uma cena de projeto novo (Fase 1, sem versão) e outra com versões e itens;
  - entre por `/dev/login` na `:3100`;
  - limpe a cena antes do `npm test` e rode lint, typecheck e testes.

## Parte 1: Codebook, Prompt e Itens

**Hoje**
- No Codebook vazio, "o primeiro salvamento cria a versão 1" aparece duas vezes:
  `version-status.tsx` ~5 e `codebook-history.tsx` ~17.
- "Esta versão não tem definições." (`codebook-editor.tsx` ~207) aparece mesmo quando ainda não
  existe versão.
- No Prompt acontece a mesma duplicação (`prompt-history.tsx` ~18).
- No Itens vazio, o ⓘ repete a lista de formatos (`ITEM_FILE_HINT` no `help` de `items/page.tsx`
  ~34), que já aparece embaixo da área de arrastar.

**Proposta** (esboço do DEPOIS, Codebook vazio na Fase 1):

```
Definições ⓘ
Os conceitos que estruturam a tarefa da LLM.
┌─────────────────────────────────────────────────────────────┐
│ Nenhuma definição ainda.                                    │
│ Na Fase 1 bastam título e tipo; a descrição e os critérios  │
│ entram na Fase 2.                                           │
│ [Adicionar definições]                                      │
└─────────────────────────────────────────────────────────────┘
(sem "Histórico de versões" até existir a versão 1)
```

- **Codebook sem versão e sem definições**: o estado vazio mostra "Nenhuma definição ainda.", uma
  frase sobre a fase e um botão "Adicionar definições".
  - Na Fase 1, a frase é "Na Fase 1 bastam título e tipo; a descrição e os critérios entram na Fase
    2.", que vem do `help` de hoje.
  - O botão segue o mesmo caminho do "adicionar" que o editor já tem. Confira isso no
    `codebook-editor.tsx`.
  - "Esta versão não tem definições." fica só para versão que existe e está vazia, inclusive em
    `codebook/[versionId]/page.tsx`.
- **"Histórico de versões"** só aparece com `versions.length > 0`, no Codebook (`codebook/page.tsx`
  ~58) e no Prompt (`prompt/page.tsx` ~99).
  - No Prompt, o editor recebe `historyAnchor` (~63). Passe a âncora só quando houver histórico,
    para não sobrar um link quebrado.
  - Com isso sai a segunda ocorrência de "o primeiro salvamento cria a versão 1", e a do
    `version-status` continua.
- **Itens com pool vazio**: o `help` deixa de incluir o `ITEM_FILE_HINT`. Com itens no pool, ele
  continua, porque o botão "Importar arquivo" não mostra os formatos.
- Revise os `hint` e `help` das outras seções destas três abas com a regra acima.

**Pronto quando**
- O Codebook vazio na Fase 1 mostra um estado vazio com a ação e sem frase repetida.
- "Histórico de versões" não aparece sem versão e aparece a partir da v1, no Codebook e no Prompt.
- O Itens vazio não tem a lista de formatos no ⓘ.
- Nenhum texto foi apagado, só mudado de lugar.
- Lint, typecheck e testes passam.
