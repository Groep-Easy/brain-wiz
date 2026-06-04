import { useMemo, useState, type JSX } from 'react'
import { BalanceScale } from '../components/BalanceScale.js'
import type { ItemOption } from '../shared/scaleGame.js'
import {
  ANSWERING_SCALE_PHASE,
  EASY_SCALE_DIFFICULTY,
  HARD_SCALE_DIFFICULTY,
  REVEAL_SCALE_PHASE,
  type ScaleDifficulty,
  type ScalePhase,
} from '../shared/scaleGame.constants.js'
import type { EquationClueProps, EquationSideProps } from './ScaleMechanicsMock.types.js'
import { getSampleScalePuzzle } from './samplePuzzle.js'

export function ScaleMechanicsMock(): JSX.Element {
  const [phase, setPhase] = useState<ScalePhase>(ANSWERING_SCALE_PHASE)
  const [difficulty, setDifficulty] = useState<ScaleDifficulty>(EASY_SCALE_DIFFICULTY)
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined)
  const puzzle = useMemo(
    () => getSampleScalePuzzle(puzzleIndex, difficulty),
    [difficulty, puzzleIndex]
  )

  function chooseDifficulty(nextDifficulty: ScaleDifficulty): void {
    setDifficulty(nextDifficulty)
    setPhase(ANSWERING_SCALE_PHASE)
    setSelectedOptionId(undefined)
    setPuzzleIndex((currentIndex) => currentIndex + 1)
  }

  function chooseAnswer(optionId: string): void {
    setSelectedOptionId(optionId)
    setPhase(REVEAL_SCALE_PHASE)
  }

  return (
    <main className="scale-mechanics-mock">
      <div className="scale-mechanics-mock__bar">
        <button
          className={getMockButtonClass(difficulty === EASY_SCALE_DIFFICULTY)}
          onClick={() => {
            chooseDifficulty(EASY_SCALE_DIFFICULTY)
          }}
          type="button"
        >
          Easy
        </button>
        <button
          className={getMockButtonClass(difficulty === HARD_SCALE_DIFFICULTY)}
          onClick={() => {
            chooseDifficulty(HARD_SCALE_DIFFICULTY)
          }}
          type="button"
        >
          Hard
        </button>
        <button
          className="scale-mechanics-mock__button"
          disabled={phase === REVEAL_SCALE_PHASE}
          onClick={() => {
            setSelectedOptionId(undefined)
            setPhase(REVEAL_SCALE_PHASE)
          }}
          type="button"
        >
          Reveal
        </button>
        <button
          className="scale-mechanics-mock__button"
          onClick={() => {
            setPhase(ANSWERING_SCALE_PHASE)
            setSelectedOptionId(undefined)
            setPuzzleIndex((currentIndex) => currentIndex + 1)
          }}
          type="button"
        >
          Reset
        </button>
      </div>
      <div className="scale-mechanics-mock__equations" aria-label="Balance equations">
        {puzzle.equations.map((equation) => (
          <EquationClue equation={equation} key={equation.id} />
        ))}
      </div>
      <BalanceScale debugPivot phase={phase} puzzle={puzzle} />
      {/* To be deleted later, answers will be send to client ui */}
      <div className="scale-mechanics-mock__answers" aria-label="Mock answer choices">
        {puzzle.options.map((option) => (
          <button
            className={getAnswerButtonClass(
              option,
              selectedOptionId,
              puzzle.correctOptionId,
              phase
            )}
            disabled={phase === REVEAL_SCALE_PHASE}
            key={option.id}
            onClick={() => {
              chooseAnswer(option.id)
            }}
            type="button"
          >
            <span>{option.emoji}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </main>
  )
}

function EquationClue({ equation }: EquationClueProps): JSX.Element {
  return (
    <div className="scale-mechanics-mock__equation">
      <EquationSide stacks={equation.left} />
      <span className="scale-mechanics-mock__equals">=</span>
      <EquationSide stacks={equation.right} />
    </div>
  )
}

function EquationSide({ stacks }: EquationSideProps): JSX.Element {
  return (
    <span className="scale-mechanics-mock__equation-side">
      {stacks.map((stack) => (
        <span className="scale-mechanics-mock__stack" key={`${stack.item.id}-${stack.count}`}>
          <span className="scale-mechanics-mock__stack-count">{formatCount(stack.count)}</span>
          <span className="scale-mechanics-mock__stack-emoji">{stack.item.emoji}</span>
          <span>{pluralize(stack.item.label, stack.count)}</span>
        </span>
      ))}
    </span>
  )
}

function getMockButtonClass(isActive: boolean): string {
  return isActive
    ? 'scale-mechanics-mock__button scale-mechanics-mock__button--active'
    : 'scale-mechanics-mock__button'
}

function getAnswerButtonClass(
  option: ItemOption,
  selectedOptionId: string | undefined,
  correctOptionId: string | undefined,
  phase: ScalePhase
): string {
  const classes = ['scale-mechanics-mock__answer']

  if (phase === REVEAL_SCALE_PHASE && option.id === correctOptionId) {
    classes.push('scale-mechanics-mock__answer--correct')
  }

  if (
    phase === REVEAL_SCALE_PHASE &&
    option.id === selectedOptionId &&
    option.id !== correctOptionId
  ) {
    classes.push('scale-mechanics-mock__answer--wrong')
  }

  return classes.join(' ')
}

function formatCount(count: number): string {
  return count.toString()
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`
}
