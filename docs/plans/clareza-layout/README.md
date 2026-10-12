# Série "clareza de layout" (sugestões de 12/10/2026)

Quarta série de layout. A análise de 12/10 está em `referencia-visual.html` (cópia da página do
Desktop, que é sobrescrita a cada rodada). Cada sugestão tem uma âncora `#s1` a `#s10`.

Só layout, texto e clareza: nenhuma funcionalidade nova, nenhuma regra de negócio muda, e os termos
de `docs/CONTEXT.md` continuam valendo. Cada Parte vai num chat separado.

| Plano | Sugestão (seleção · análise) | Partes | Arquivo |
|---|---|---|---|
| A | Rótulos iguais em toda parte (7 · `#s9`) | 1 | `plano-a-rotulos.md` |
| B | Cabeçalho do projeto com a fase (2 · `#s2`) | 2 | `plano-b-cabecalho.md` |
| C | Visão geral com um "Próximo passo" (1 · `#s1`) | 1 | `plano-c-proximo-passo.md` |
| D | Avaliar com o item de entrada à vista (3 · `#s3`) | 1 | `plano-d-avaliar.md` |
| E | Balões ⓘ curtos e "Saiba mais" (4 · `#s4`, mais o ⓘ de `#s10`) | 3 | `plano-e-ajuda.md` |
| F | Um padrão só de edição (5 · `#s6`) | 3 | `plano-f-edicao.md` |
| G | Cores e confirmações pela gravidade (6 · `#s7`) | 3 | `plano-g-gravidade.md` |
| H | Toque, foco e contraste (8 · `#s10`, sem o ⓘ) | 1 | `plano-h-toque-e-contraste.md` |

Ficaram de fora da seleção: "Rodadas: operar a rodada em cima" (`#s5`) e "Membros e Ajustes: o mais
usado primeiro" (`#s8`).

## Ordem

Siga a ordem das letras. Os motivos:

- **A primeiro**: fixa os nomes e a caixa dos selos que os outros planos já escrevem do jeito
  novo. "Onboarding" continua como está (decidido em 12/10).
- **B antes de C**: o selo da fase no cabeçalho sai de `PROJECT_PHASES`, que a C também usa.
- **E antes de H**: o ⓘ de 24 px, que abre no toque, entra na E (é o mesmo componente que a E
  reescreve). A H fica com o resto da acessibilidade.
- **F antes de G**: a G troca o `confirm()` do `items-editor.tsx` e os avisos do Codebook e do
  Prompt depois que a F reorganizou esses editores.
- **G antes de H**: a G aposenta o `dangerGhost`, e a H mede os alvos que sobram.

## Decisões ⚠

Cada plano marca com ⚠ o que precisa de confirmação **antes** da Parte em que entra. Pergunte todas
as ⚠ da Parte de uma vez, antes de editar código, mesmo quando o pedido for só "implemente a Parte
N".

## Convenções de todas as Partes

- Leia o `AGENTS.md` (é Next 16: qualquer API nova se confere em `node_modules/next/dist/docs/`) e
  o `docs/CONTEXT.md`.
- Nada de comentários novos no código e nada de `npx prettier`.
- Antes de trocar uma frase, procure a antiga nos testes (`grep -rn` pela frase, pelos
  `Object.keys(` e pelos `toEqual` de props). O `markupTextOf` também lê o texto dos balões ⓘ e o
  corpo de `<details>` fechado (para "o que está visível", use o `glanceTextOf`).
- Classe que precisa vencer outra do mesmo componente usa o sufixo `!`: o `cx` não resolve conflito
  de Tailwind.
- Passos marcados **(TDD)**: escreva o teste, rode, leia a **mensagem** de cada vermelho e só então
  escreva o código.
- Verificação no navegador: `/dev/login?next=<rota>` na `:3100`, em 1280 px e em 375 px (375 px só
  vale medido num `iframe` criado por `javascript_tool`). Limpe a cena antes do `npm test`.
- Fim de cada Parte: `npm run lint`, `npm run typecheck` e `npm test` verdes, a tabela do plano com
  ✅ e a sugestão de commit (título + corpo + `Co-Authored-By`). Esta série não tem issue, então não
  há `Closes`.
