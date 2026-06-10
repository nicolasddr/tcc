import './home.css'
import { GoogleSignInButton, LoginButton } from './components/auth-buttons'

export default function Home() {
  return (
    <div className="page">
      <header className="page-header">
        <a className="logo" href="/">
          <span className="logo-icon">✦</span>
          Engenharia de Prompt
          <span className="logo-badge">protótipo</span>
        </a>
        <GoogleSignInButton />
      </header>

      <main>
        <div className="hero">
          <h1>Crie e valide prompts de forma sistemática</h1>
          <p>
            Este protótipo implementa o processo proposto por Shah (2025) em{' '}
            <em>From Prompt Engineering to Prompt Science</em>, que visa tornar a
            engenharia de prompt mais verificável, replicável e livre de
            subjetividade individual.
          </p>
          <GoogleSignInButton />
        </div>

        <div className="role-cards">
          <div className="role-card">
            <div className="role-card-header">
              <div className="role-icon">🛡</div>
              <div>
                <div className="role-title">Administrador</div>
                <div className="role-subtitle">Criar e gerenciar projetos</div>
              </div>
            </div>
            <ul className="role-features">
              <li>Crie projetos com código de acesso</li>
              <li>Defina o codebook com definições e critérios</li>
              <li>Acompanhe métricas de concordância</li>
            </ul>
            <LoginButton className="btn-role-primary">Criar Novo Projeto</LoginButton>
          </div>

          <div className="role-card">
            <div className="role-card-header">
              <div className="role-icon">👥</div>
              <div>
                <div className="role-title">Avaliador</div>
                <div className="role-subtitle">Participar de um projeto</div>
              </div>
            </div>
            <ul className="role-features">
              <li>Entre com o código fornecido</li>
              <li>Avalie respostas de forma independente</li>
              <li>Contribua para a validação do prompt</li>
            </ul>
            <LoginButton className="btn-role-outline">Entrar no Projeto</LoginButton>
          </div>
        </div>

        <section className="process-section">
          <h2 className="section-heading">Como funciona o processo</h2>
          <p className="section-subheading">Baseado em Shah (2025), leia antes de começar</p>

          <div className="codebook-block">
            <div className="codebook-block-title">📋 O Codebook</div>
            <p className="codebook-intro">
              O codebook é o documento central do processo. Ele tem duas partes com
              funções distintas:
            </p>
            <div className="codebook-parts">
              <div className="codebook-part">
                <div className="codebook-part-num">Parte 1</div>
                <div className="codebook-part-title">Definições</div>
                <p className="codebook-part-desc">
                  Define os conceitos que estruturam a tarefa da LLM: as categorias,
                  dimensões ou diretrizes do domínio com seus significados precisos. A
                  LLM usará essas definições para produzir sua resposta, e os
                  avaliadores as usarão como referência ao aplicar os critérios.
                </p>
                <div className="codebook-part-example">
                  Em tarefas de classificação, são as categorias possíveis (ex:
                  Informacional, Transacional). Em tarefas de avaliação de qualidade,
                  são as dimensões a avaliar (ex: Atomicidade, Clareza). Em tarefas de
                  geração, são as diretrizes que a LLM deve seguir ao gerar o conteúdo
                  (ex: definição de um bom commit atômico).
                </div>
              </div>

              <div className="codebook-part">
                <div className="codebook-part-num">Parte 2</div>
                <div className="codebook-part-title">Critérios</div>
                <p className="codebook-part-desc">
                  Define como os avaliadores julgam a qualidade das respostas da LLM.
                  Cada critério tem níveis com definições precisas, não apenas rótulos.
                </p>
                <div className="codebook-part-example">
                  <strong>Ex (critério &quot;Corretude&quot;):</strong> Alto: identificou
                  corretamente o que está adequado e o que está problemático / Médio:
                  acertou em parte / Baixo: errou ou ignorou aspectos relevantes
                </div>
              </div>
            </div>
            <div className="codebook-note">
              <strong>
                <span data-tooltip="ICR (Inter-Coder Reliability): grau de concordância entre dois ou mais avaliadores ao aplicar o mesmo codebook. Alta concordância indica que as definições e critérios estão claros o suficiente para serem usados de forma consistente.">
                  Concordância entre avaliadores
                </span>{' '}
                = clareza do codebook.
              </strong>{' '}
              Quando avaliadores divergem, isso indica que alguma definição ou critério
              está ambíguo, e o codebook precisa ser refinado.
            </div>
          </div>

          <div className="phase-diagram">
            <div className="phase-diagram-label">As quatro fases do processo</div>
            <div className="phase-row">
              <div className="phase-card phase-1">
                <div className="phase-card-head">
                  <div className="phase-num-tag">Fase 1</div>
                  <div className="phase-card-name">Configuração Inicial</div>
                </div>
                <div className="phase-card-body">
                  <ul className="phase-acts">
                    <li>Escrever um prompt inicial (pode ser simples)</li>
                    <li>Selecionar dados de teste representativos</li>
                    <li>Configurar o codebook inicial</li>
                  </ul>
                  <div className="phase-outcome">✓ Pipeline configurado</div>
                </div>
              </div>

              <div className="phase-arrow-col">→</div>

              <div className="phase-card phase-2">
                <div className="phase-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div className="phase-num-tag" style={{ marginBottom: 0 }}>Fase 2</div>
                    <span className="loop-tag" style={{ marginTop: 0 }}>↺ iterativo</span>
                  </div>
                  <div className="phase-card-name">Validação do Codebook</div>
                </div>
                <div className="phase-card-body">
                  <ul className="phase-acts">
                    <li>Avaliadores aplicam o codebook de forma independente</li>
                    <li>
                      Calcular{' '}
                      <span data-tooltip="ICR: mede se os avaliadores interpretaram o codebook da mesma forma. ICR baixo significa que alguma definição ou critério precisa ser refinado, não necessariamente que a LLM errou.">
                        concordância (ICR)
                      </span>
                    </li>
                    <li>Se baixa: discutir divergências e refinar o codebook</li>
                  </ul>
                  <div className="phase-outcome">✓ Codebook validado</div>
                </div>
              </div>

              <div className="phase-arrow-col">→</div>

              <div className="phase-card phase-3">
                <div className="phase-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div className="phase-num-tag" style={{ marginBottom: 0 }}>Fase 3</div>
                    <span className="loop-tag" style={{ marginTop: 0 }}>↺ iterativo</span>
                  </div>
                  <div className="phase-card-name">Validação do Prompt</div>
                </div>
                <div className="phase-card-body">
                  <ul className="phase-acts">
                    <li>Codebook incorporado ao prompt como contexto</li>
                    <li>Avaliadores julgam a qualidade das respostas pelos critérios</li>
                    <li>Concordância baixa → refinar codebook e repetir</li>
                    <li>Concordância alta, qualidade insatisfatória → ajustar prompt e repetir</li>
                  </ul>
                  <div className="phase-outcome">✓ Prompt validado</div>
                </div>
              </div>

              <div className="phase-arrow-col" style={{ opacity: 0.35 }}>→</div>

              <div className="phase-card phase-4">
                <div className="phase-card-head">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <div className="phase-num-tag" style={{ marginBottom: 0 }}>Fase 4</div>
                    <span className="out-tag" style={{ marginTop: 0 }}>🔒 fora do protótipo</span>
                  </div>
                  <div className="phase-card-name">Validação Final</div>
                </div>
                <div className="phase-card-body">
                  <ul className="phase-acts">
                    <li>Novos avaliadores em dados de teste separados</li>
                    <li>Verificação final independente do pipeline</li>
                  </ul>
                  <div className="phase-outcome">✓ Pipeline validado</div>
                </div>
              </div>
            </div>
          </div>

          <div className="why-section">
            <div className="subsection-title">Por que esse processo?</div>
            <div className="why-points">
              <div className="why-point">
                <div className="why-icon">🔬</div>
                <div className="why-title">Reduz viés e subjetividade</div>
                <p>
                  Múltiplos avaliadores com critérios objetivos contrabalanceiam
                  perspectivas individuais, e o resultado depende muito menos de uma
                  única visão.
                </p>
              </div>
              <div className="why-point">
                <div className="why-icon">📂</div>
                <div className="why-title">Aumenta a replicabilidade</div>
                <p>
                  A documentação das deliberações torna o processo verificável e evita
                  o loop em que um único pesquisador ajusta o prompt até obter o
                  resultado que espera.
                </p>
              </div>
              <div className="why-point">
                <div className="why-icon">💡</div>
                <div className="why-title">Gera conhecimento sobre a tarefa</div>
                <p>
                  O processo aprofunda o entendimento sobre o problema em si, não
                  apenas produz um prompt confiável.
                </p>
              </div>
            </div>
          </div>

          <div className="reference">
            Baseado em: Shah, C. (2025). From Prompt Engineering to Prompt Science with
            Humans in the Loop. <em>Communications of the ACM</em>, Vol. 68, No. 6, pp.
            54–61. DOI: 10.1145/3709599
          </div>
        </section>
      </main>

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
    </div>
  )
}
