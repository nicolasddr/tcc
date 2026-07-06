import './dashboard.css'
import '@/app/components/skeleton.css'

// Mostrado na hora ao voltar/navegar para o dashboard, enquanto o servidor carrega
// projetos, notificações e convites.
export default function Loading() {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <span className="skeleton" style={{ width: 180, height: 40, borderRadius: 8 }} />
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <section className="projects-section">
            <div className="projects-section-head">
              <span className="skeleton skeleton-text" style={{ width: 160, height: '1.6em' }} />
              <span className="skeleton" style={{ width: 130, height: 38 }} />
            </div>
            <ul className="projects-list">
              {[0, 1, 2].map((i) => (
                <li key={i}>
                  <span className="skeleton" style={{ display: 'block', height: 72 }} />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
