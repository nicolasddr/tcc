import './process-phases-footer.css'

export function ProcessPhasesFooter() {
  return (
    <footer className="page-footer">
      <div className="footer-phases">
        <div className="footer-phase fp1">
          <div className="footer-phase-num">Fase 1</div>
          <div className="footer-phase-name">Configuração Inicial</div>
        </div>
        <div className="footer-phase fp2">
          <div className="footer-phase-num">Fase 2</div>
          <div className="footer-phase-name">Validação do Codebook</div>
        </div>
        <div className="footer-phase fp3">
          <div className="footer-phase-num">Fase 3</div>
          <div className="footer-phase-name">Validação do Prompt</div>
        </div>
        <div className="footer-phase fp4">
          <div className="footer-phase-num">Fase 4</div>
          <div className="footer-phase-name">Validação Final</div>
        </div>
      </div>
    </footer>
  )
}
