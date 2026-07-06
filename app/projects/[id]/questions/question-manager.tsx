'use client'

import { useActionState, useState } from 'react'
import {
  addQuestion,
  updateQuestion,
  removeQuestion,
  type QuestionState,
} from './actions'
import type { OnboardingQuestion } from '@/app/onboarding/questions'
import { SubmitButton } from '@/app/components/submit-button'

const initialState: QuestionState = null

// Campos compartilhados pelos forms de adicionar e editar. Mantém o textarea de opções
// visível apenas quando o tipo é múltipla escolha (estado local por form).
function QuestionFields({
  defaultText,
  defaultType,
  defaultOptions,
}: {
  defaultText?: string
  defaultType?: string
  defaultOptions?: string[]
}) {
  const [type, setType] = useState(defaultType ?? 'open')

  return (
    <>
      <label className="field">
        <span className="field-label">Pergunta</span>
        <input
          type="text"
          name="question_text"
          required
          defaultValue={defaultText}
          placeholder="Ex.: Qual é a sua área de formação?"
          className="field-input"
        />
      </label>

      <label className="field">
        <span className="field-label">Tipo</span>
        <select
          name="question_type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="field-input"
        >
          <option value="open">Resposta aberta</option>
          <option value="multiple_choice">Múltipla escolha</option>
        </select>
      </label>

      {type === 'multiple_choice' ? (
        <label className="field">
          <span className="field-label">Opções (uma por linha)</span>
          <textarea
            name="options"
            rows={3}
            defaultValue={defaultOptions?.join('\n')}
            placeholder={'Graduação\nMestrado\nDoutorado'}
            className="field-input"
          />
          <span className="field-hint">
            O avaliador escolhe uma opção ou marca “Outro” e escreve. Mínimo de 2 opções.
          </span>
        </label>
      ) : null}
    </>
  )
}

function AddQuestionForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addQuestion, initialState)
  // Cada sucesso traz um nonce novo → remonta os campos (limpa texto/opções e volta o
  // tipo a "aberta") sem um efeito que chame setState.
  const fieldsKey = state && 'ok' in state ? state.nonce : 'idle'

  return (
    <form action={action} className="project-form question-form">
      <input type="hidden" name="project_id" value={projectId} />
      <QuestionFields key={fieldsKey} />

      {state && 'error' in state ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <div className="form-actions">
        <button type="submit" className="btn-invite btn-inline" disabled={pending}>
          {pending ? 'Adicionando…' : 'Adicionar pergunta'}
        </button>
      </div>
    </form>
  )
}

function EditQuestionForm({
  projectId,
  question,
}: {
  projectId: string
  question: OnboardingQuestion
}) {
  const [state, action, pending] = useActionState(updateQuestion, initialState)

  return (
    <div className="question-item">
      <form action={action} className="project-form question-form">
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="question_id" value={question.id} />
        <QuestionFields
          defaultText={question.questionText}
          defaultType={question.questionType}
          defaultOptions={question.options ?? undefined}
        />

        {state && 'error' in state ? (
          <p className="form-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state && 'ok' in state ? (
          <p className="form-success" role="status">
            Pergunta atualizada.
          </p>
        ) : null}

        <div className="form-actions question-actions">
          <button type="submit" className="btn-invite btn-inline" disabled={pending}>
            {pending ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>

      {/* Remover cascateia as respostas — confirma antes de enviar. */}
      <form
        action={removeQuestion}
        className="question-remove"
        onSubmit={(e) => {
          if (
            !confirm(
              'Remover esta pergunta? As respostas já dadas a ela também serão apagadas.',
            )
          ) {
            e.preventDefault()
          }
        }}
      >
        <input type="hidden" name="project_id" value={projectId} />
        <input type="hidden" name="question_id" value={question.id} />
        <SubmitButton className="btn-decline" pendingText="Removendo…">
          Remover
        </SubmitButton>
      </form>
    </div>
  )
}

export function QuestionManager({
  projectId,
  questions,
}: {
  projectId: string
  questions: OnboardingQuestion[]
}) {
  return (
    <div className="questions-manager">
      {questions.length === 0 ? (
        <p className="projects-empty">
          Nenhuma pergunta ainda. Adicione a primeira abaixo — ou deixe em branco para um
          onboarding só com consentimento.
        </p>
      ) : (
        <ul className="questions-list">
          {questions.map((q, i) => (
            <li key={q.id}>
              <p className="question-order">Pergunta {i + 1}</p>
              <EditQuestionForm projectId={projectId} question={q} />
            </li>
          ))}
        </ul>
      )}

      <section className="project-section">
        <h2 className="project-section-title">Adicionar pergunta</h2>
        <AddQuestionForm projectId={projectId} />
      </section>
    </div>
  )
}
