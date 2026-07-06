import '../projects.css'
import '@/app/components/skeleton.css'

// Mostrado instantaneamente ao clicar em "Criar projeto", enquanto a página real
// (auth + leitura de permissão via Drizzle) renderiza no servidor.
export default function Loading() {
  return (
    <div className="project-page">
      <header className="project-topbar">
        <span className="skeleton skeleton-text" style={{ width: 72 }} />
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <span className="skeleton skeleton-text" style={{ width: '55%', height: '1.8em' }} />
          <span
            className="skeleton skeleton-text"
            style={{ width: '80%', marginTop: 12 }}
          />
          <span className="skeleton" style={{ height: 44, marginTop: 24 }} />
          <span className="skeleton" style={{ height: 44, marginTop: 12 }} />
          <span className="skeleton" style={{ height: 120, marginTop: 12 }} />
        </div>
      </main>
    </div>
  )
}
