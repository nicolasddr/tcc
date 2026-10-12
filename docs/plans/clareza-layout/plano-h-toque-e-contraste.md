# Plano H: toque, foco e contraste nos controles pequenos

Sugestão 10 da análise de 12/10 (`referencia-visual.html#s10`), retomada de 08/10 em parte. O ⓘ de
24 px que abre no toque já entrou no Plano E (Parte 1), e os rótulos das fases futuras na barra de
fase no Plano C. Faça por último.

| Parte | Entrega | Commit sugerido | Estado |
|---|---|---|---|
| 1 | Alvo mínimo de 24 px, ações por linha como botões `sm`, `text-faint` só em decoração e `--color-muted` mais escuro | `fix(acessibilidade): alvos de 24 px e contraste do texto secundário` | |

## Contexto

- Arquivos: `app/components/ui/button.tsx` (variantes sem tamanho: `ghost`, `link`, `quiet`, e o
  `dangerGhost` se ainda existir depois do Plano G), `app/projects/[id]/member-list.tsx` (~48–66),
  `app/projects/[id]/member-actions.tsx`, `(tabs)/evaluate/evaluation-form.tsx` (o "+ Justificar",
  ~138), `app/components/ui/tabs.tsx` (~75), `app/globals.css` (~27–35), e os usos de `text-faint`
  (lista abaixo).
- WCAG 2.5.8 (alvo mínimo, AA): 24 × 24 px, ou espaço livre equivalente em volta. **Links dentro de
  uma frase** estão isentos (exceção "inline"); não mexa neles.
- WCAG 1.4.3 (contraste): 4,5:1 para texto. Hoje `--color-faint` (#9ca3af) dá 2,4:1 sobre o cartão,
  e `--color-muted` (#6b7280) dá 4,39:1 sobre o `--color-canvas` (#f3f4f6).
- Só visual: nenhum texto e nenhuma regra mudam.

## Parte 1

**Proposta**
- **Alvo de 24 px nas variantes sem tamanho**: `link`, `quiet` (e `dangerGhost`, se sobrar) ganham
  `min-h-6` (24 px). O `base` já é `inline-flex items-center`, então a altura cresce sem mudar a
  largura nem o texto. Confira que nenhum desses botões está no meio de uma frase (aí a classe
  desalinha a linha; se estiver, é link inline e fica isento).
- **Ações por linha em Membros**: "Ver respostas" vira `ButtonLink` `secondary` `sm` (28 px).
  "Desativar" já virou `danger` `sm` no Plano G; confira.
- **"+ Justificar"**: além do `min-h-6`, `py-1` para o alvo não colar no botão de nota de cima.
- **`text-faint` só em borda e decoração** (ícones, separadores). Troque por `text-muted` onde é
  texto:
  - `ui/tabs.tsx` ~75 (aba desabilitada);
  - `components/notification-bell.tsx` ~94 (data da notificação);
  - `(tabs)/profile-answers/[userId]/page.tsx` ~111 (resposta em branco);
  - `rounds/quality-matrix-table.tsx` ~61, `rounds/agreement-matrix-table.tsx` ~28 (célula que não
    se aplica) e `rounds/reference-comparison-panel.tsx` ~39 (comparação vazia);
  - ficam: `CircleIcon` em `checklist.tsx` e `phase-4-return.tsx`, e o ícone do `Chip`.
- **`--color-muted`**: de `#6b7280` para `#5b6472` em `globals.css`. Meça o contraste nas duas
  superfícies (`#ffffff` e `#f3f4f6`) e registre os números na resposta final. Se algum texto ficar
  escuro demais perto do `--color-label` (#374151), diga onde.

**Medição** (no navegador, com `javascript_tool`)
- Em Visão geral, Membros, Avaliar, Itens e Rodadas, liste os controles menores que 24 px:

```js
[...document.querySelectorAll('a,button,summary,input,select,textarea,[role=tab],[role=button]')]
  .map((el) => [el, el.getBoundingClientRect()])
  .filter(([, r]) => r.width && r.height && (r.width < 24 || r.height < 24))
  .map(([el, r]) => `${el.tagName} ${Math.round(r.width)}×${Math.round(r.height)} ${el.textContent.trim().slice(0, 40)}`)
```

- Separe o que é link dentro de frase (isento) do resto, e corrija o resto. Rode antes e depois e
  mostre as duas listas na resposta final.

**Pronto quando**
- A medição não acha controle fora de frase com menos de 24 px nas cinco telas.
- "Ver respostas" e "Desativar" medem 28 px de altura.
- `grep -rn "text-faint" app` só acha ícones e decoração.
- O contraste de `--color-muted` passa de 4,5:1 sobre branco e sobre o canvas.
- Telas conferidas em 1280 e 375 px.
- Lint, typecheck e testes passam (procure testes que afirmam `text-faint` ou a variante `link`
  do "Ver respostas").
