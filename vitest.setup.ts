import { config } from 'dotenv'

// Carrega `.env.local` (onde está a DATABASE_URL do Postgres local, porta 54322)
// ANTES de qualquer teste importar `lib/db` — que lê `process.env.DATABASE_URL`
// no topo do módulo. setupFiles roda em cada worker antes dos testes, então a
// env já está populada quando a conexão é criada.
config({ path: '.env.local' })
