import type { RoundAnswerChoice } from '@brain-wiz/shared/types/index'

const DEFAULT_TILE_CLASSES = ['tile-teal', 'tile-red', 'tile-blue', 'tile-tan'] as const

export interface MinigameChoiceGridProps {
  choices: RoundAnswerChoice[]
  selectedChoiceId: string | null
  submitted: boolean
  phase: 'playing' | 'reveal'
  correctChoiceId?: string | undefined
  tileClasses?: readonly string[]
  onSelect: (choice: RoundAnswerChoice) => void
}

/**
 * Shared phone-side answer grid for minigames where the client only chooses
 * one server-provided option and sends that option's opaque submission payload.
 */
export function MinigameChoiceGrid({
  choices,
  selectedChoiceId,
  submitted,
  phase,
  correctChoiceId,
  tileClasses = DEFAULT_TILE_CLASSES,
  onSelect,
}: MinigameChoiceGridProps): React.JSX.Element {
  return (
    <section className="answer-page">
      <div className="answer-grid">
        {choices.map((choice, index) => {
          const isCorrect = choice.id === correctChoiceId
          const isDimmed = phase === 'reveal' && correctChoiceId !== undefined && !isCorrect

          return (
            <button
              aria-label={choice.label}
              className={`answer-tile minigame-answer-tile ${
                tileClasses[index] ?? tileClasses[0] ?? 'tile-teal'
              } ${isDimmed ? 'is-dim' : ''} ${
                phase === 'reveal' && isCorrect ? 'is-correct' : ''
              } ${choice.id === selectedChoiceId ? 'is-selected' : ''}`}
              disabled={submitted || phase === 'reveal'}
              key={choice.id}
              onClick={() => onSelect(choice)}
              type="button"
            >
              <span className="answer-shape">{choice.emoji}</span>
              <span className="minigame-answer-label">{choice.label}</span>
              {choice.id === selectedChoiceId ? <span className="answer-you">You</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
