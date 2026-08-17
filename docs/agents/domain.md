# Domain Docs

Como os skills de engenharia devem consumir a documentação de domínio deste repositório ao explorar o código.

## Antes de explorar, leia isto

- **`CONTEXT.md`** na raiz do repositório, ou
- **`CONTEXT-MAP.md`** na raiz do repositório, se existir — aponta para um `CONTEXT.md` por contexto. Leia cada um relevante ao tópico.
- **`docs/adr/`** — leia as ADRs que tocam a área em que você vai trabalhar. Em repos multi-contexto, verifique também `src/<context>/docs/adr/` para decisões escopadas ao contexto.

Se algum desses arquivos não existir, **prossiga em silêncio**. Não sinalize a ausência; não sugira criá-los de antemão. O skill `/domain-modeling` (acessado via `/grill-with-docs` e `/improve-codebase-architecture`) os cria de forma preguiçosa quando termos ou decisões realmente forem resolvidos.

## Estrutura de arquivos

Repo single-context (a maioria dos repos, incluindo este):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-...md
│   └── 0007-...md
└── src/ (ou app/)
```

Repo multi-contexto (presença de `CONTEXT-MAP.md` na raiz):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← decisões de todo o sistema
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← decisões específicas do contexto
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use o vocabulário do glossário

Quando sua saída nomear um conceito de domínio (no título de uma issue, em uma proposta de refatoração, em uma hipótese, no nome de um teste), use o termo como definido em `CONTEXT.md`. Não fuja para sinônimos que o glossário explicitamente evita.

Se o conceito de que você precisa ainda não estiver no glossário, isso é um sinal — ou você está inventando linguagem que o projeto não usa (reconsidere) ou há uma lacuna real (anote para `/domain-modeling`).

## Sinalize conflitos com ADRs

Se sua saída contradisser uma ADR existente, exponha isso explicitamente em vez de sobrescrever silenciosamente:

> _Contradiz a ADR-0007 (migração para Drizzle ORM) — mas vale reabrir porque…_
