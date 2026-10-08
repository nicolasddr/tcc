# Plano A: Painel com textos corretos e guia recolhido

Ajustes **01 e 02** da referência visual `docs/plans/ajustes-layout/referencia-visual.html`
(abrir no navegador; cada ajuste é um cartão numerado com "Hoje" e "Proposta").

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Textos do painel que não batem com a ferramenta (ajuste 01) | `fix(painel): textos de entrada por convite e fase 4` | ✅ |
| 2 | Guia do processo recolhido quando já há projetos (ajuste 02) | `feat(painel): guia do processo recolhido` | ✅ |

## Contexto comum

- Arquivos: `app/dashboard/page.tsx` e `app/components/process-overview.tsx` (+ `process-overview.css`).
- Convenções do repo (ver memória): sem comentários novos, não rodar `npx prettier`, buscar nos testes
  o texto antigo antes de mudar (`grep-texto-antigo-nos-testes`).
- Verificação: `/dev/login?next=/dashboard` na `:3100`. O usuário dev não tem projetos, então a
  Parte 2 precisa de uma cena com ao menos um projeto (ver `vitest-como-runner-de-seed`) e da
  limpeza no fim (`cena-no-banco-quebra-int-test`).

## Parte 1: textos que não batem com a ferramenta (ajuste 01)

**Hoje** (`process-overview.tsx`):
- Cartão Administrador: "Crie projetos com código de acesso". Não existe código de acesso.
- Cartão Avaliador: "Entre com o código fornecido" e o botão "Entrar no Projeto"
  (`joinAction` em `dashboard/page.tsx`), um `<Button>` sem ação. A entrada é por convite por e-mail.
- Diagrama das fases: a Fase 4 tem a etiqueta "🔒 fora do protótipo" e a seta antes dela fica
  apagada (`opacity: 0.35`). A Fase 4 já está construída.

**Proposta**:
- Administrador: "Crie projetos e convide avaliadores por e-mail".
- Avaliador: trocar o item do código por "Você entra por convite. O convite aparece em Meus projetos,
  com Aceitar e Recusar." e **remover o botão**. A prop `joinAction` some do `ProcessOverview` e do
  painel.
- Fase 4: tirar a etiqueta "fora do protótipo" e a opacidade da seta. Conferir se a classe `out-tag`
  fica sem uso no CSS e removê-la.
- Conferir o texto da Fase 4 ("Novos avaliadores em dados de teste separados") contra o que a
  ferramenta faz hoje na Fase 4 (codebook e prompt congelados, itens e avaliadores novos, comparação
  com a rodada de referência). Ajustar só se estiver errado.

## Parte 2: guia recolhido quando já há projetos (ajuste 02)

**Hoje**: abaixo de "Meus projetos" vêm sempre os dois cartões de papel e "Como funciona o processo"
(codebook, quatro fases, por que, referência), com mais de 1.500 px. O botão "Criar Novo Projeto" do
cartão Administrador repete o "+ Novo projeto" do topo.

**Proposta**:
- **Sem projetos** (`!hasProjects`): o painel fica como está hoje, porque ali o guia é a porta de entrada.
- **Com projetos**: os cartões de papel somem, e a seção "Como funciona o processo" fica dentro de um
  `Disclosure` (`app/components/ui/disclosure.tsx`) fechado, com o resumo "Como funciona o processo".
- Para isso, o `ProcessOverview` precisa separar os cartões de papel da seção do processo (duas
  exportações ou uma prop do tipo `compact`). Escolher o que ficar mais simples.
