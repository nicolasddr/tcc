# Documentação

Índice da documentação do projeto.

## Domínio e decisões

- [CONTEXT.md](./CONTEXT.md): glossário do domínio (linguagem ubíqua), com o
  significado de cada termo (codebook, definição, fase, ICR, papéis).
- [adr/](./adr): decisões de arquitetura, ou seja, por que foi feito assim.
- [prd/](./prd): requisitos de produto (Épico 0, Fundação).
- [issues/](./issues): fatias verticais do Épico 0 e o status de cada uma.

## Desenvolvimento: [dev/](./dev)

Documentação técnica e operacional, de mão na massa:

- [dev/status.md](./dev/status.md): o que está construído e o que ainda é plano.
  É a orientação de alto nível; a tabela por fatia mora em [issues/](./issues).
- [dev/camada-de-dados.md](./dev/camada-de-dados.md): Drizzle-only com
  autorização na camada de aplicação, e as armadilhas não-óbvias que reaparecem
  a cada nova action ou fatia.
- [dev/performance.md](./dev/performance.md): latência de navegação e de auth,
  incluindo o throttle dos `loading.tsx`, a troca de `getUser` por `getClaims` e
  a co-localização de região entre Vercel e Supabase.
- [dev/testes-e2e.md](./dev/testes-e2e.md): testes E2E com Playwright, o porquê e
  as armadilhas. O "como rodar" fica em [`e2e/README.md`](../e2e/README.md).
- [dev/deploy.md](./dev/deploy.md): checklist de produção (allowlist do callback,
  variáveis da Vercel, região da função, `DATABASE_URL` com pooler na 6543).
