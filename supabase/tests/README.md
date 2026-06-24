# Testes da camada de dados (Épico 0)

Seam **único** de teste do Épico 0: testes de integração pgTAP contra o **Supabase
local**, contra o **schema real** (migrations 0001/0002), sem mockar a aplicação.
Cada teste **personifica um usuário** (`request.jwt.claims` + `role authenticated`) e
afirma **comportamento externo** — o que esse usuário enxerga sob RLS e os efeitos
colaterais de suas ações (notificação criada, membro materializado, flag ligada).

## Pré-requisito

Um runtime de container (Docker / OrbStack / colima) rodando — `supabase start`
sobe o Postgres local nele.

## Rodar a suíte

```bash
npm test
```

Equivale a `supabase start && supabase db reset && supabase test db`. O `db reset`
reaplica as migrations **e** o `supabase/seed.sql` (que instala o pgTAP e os helpers
de teste — local apenas, nunca vai pro remoto) a cada execução, garantindo schema
fresco; `supabase test db` sozinho não aplica migrations. O `supabase test db` roda
todo `supabase/tests/*_test.sql` com pg_prove; cada arquivo roda numa transação
revertida ao final, então não suja o banco.

Iteração rápida (stack já no ar, sem reaplicar migrations): `supabase test db`.

## Helpers (em `../seed.sql`)

| Helper | Para que serve |
|---|---|
| `tests.create_user(email, name) -> uuid` | Cria um usuário em `auth.users`; o trigger materializa o `profile`. Devolve o id. |
| `tests.authenticate_as(user_id)` | Personifica o usuário pelo resto da transação. Chamar de novo troca de usuário. |
| `tests.clear_authentication()` | Volta ao papel anônimo (`auth.uid()` = null). |

## Molde de um teste

Veja [`projects_rls_test.sql`](projects_rls_test.sql) — o teste de referência
(não-membro não vê o projeto; membro ativo vê). Esqueleto:

```sql
begin;
select plan(<n>);

-- fixtures como superusuário (RLS desligada)
-- ...

select tests.authenticate_as(<algum_user_id>);
select is( (select count(*)::int from public.<tabela>), <esperado>, '<descrição>' );

select * from finish();
rollback;
```

Criar um novo arquivo: `supabase test new <nome>` (gera `<nome>_test.sql` aqui).
