import './projects.css'
import '@/app/components/skeleton.css'

// Shell de loading compartilhado pelas páginas de projeto (detalhe, perguntas,
// onboarding, respostas). Reaproveita as classes de container para que a topbar e o
// layout apareçam de imediato, com blocos placeholder no lugar do conteúdo.
export function ProjectPageSkeleton() {
  return (
    <div className="project-page">
      <header className="project-topbar">
        <span className="skeleton skeleton-text" style={{ width: 72 }} />
      </header>

      <main className="project-main">
        <div className="project-narrow">
          <span className="skeleton skeleton-text" style={{ width: '60%', height: '1.8em' }} />
          <span className="skeleton skeleton-text" style={{ width: '40%', marginTop: 12 }} />
          <span className="skeleton" style={{ height: 96, marginTop: 24 }} />
          <span className="skeleton" style={{ height: 64, marginTop: 16 }} />
        </div>
      </main>
    </div>
  )
}
