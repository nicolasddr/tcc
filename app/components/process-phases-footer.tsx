import { PROJECT_PHASES } from '@/app/projects/[id]/phase-bar'
import './process-phases-footer.css'

export function ProcessPhasesFooter() {
  return (
    <footer className="page-footer">
      <div className="footer-phases">
        {PROJECT_PHASES.map((phase, i) => (
          <div key={phase.name} className={`footer-phase fp${i + 1}`}>
            <div className="footer-phase-num">Fase {i + 1}</div>
            <div className="footer-phase-name">{phase.name}</div>
          </div>
        ))}
      </div>
    </footer>
  )
}
