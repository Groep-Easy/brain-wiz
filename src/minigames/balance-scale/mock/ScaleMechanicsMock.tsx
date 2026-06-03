import { useMemo, useState, type JSX } from 'react'
import { BalanceScale } from '../components/BalanceScale.js'
import type {
  ItemOption,
  ItemStack,
  ScaleDifficulty,
  ScaleEquation,
  ScalePhase,
} from '../shared/scaleGame.js'
import { getSampleScalePuzzle } from './samplePuzzle.js'

export function ScaleMechanicsMock(): JSX.Element {
  const [phase, setPhase] = useState<ScalePhase>('answering')
  const [difficulty, setDifficulty] = useState<ScaleDifficulty>('easy')
  const [puzzleIndex, setPuzzleIndex] = useState(0)
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined)
  const puzzle = useMemo(
    () => getSampleScalePuzzle(puzzleIndex, difficulty),
    [difficulty, puzzleIndex]
  )

  function chooseDifficulty(nextDifficulty: ScaleDifficulty): void {
    setDifficulty(nextDifficulty)
    setPhase('answering')
    setSelectedOptionId(undefined)
    setPuzzleIndex((currentIndex) => currentIndex + 1)
  }

  function chooseAnswer(optionId: string): void {
    setSelectedOptionId(optionId)
    setPhase('reveal')
  }

  return (
    <main className="scale-mechanics-mock">
      <div className="scale-mechanics-mock__bar">
        <button
          className={getMockButtonClass(difficulty === 'easy')}
          onClick={() => {
            chooseDifficulty('easy')
          }}
          type="button"
        >
          Easy
        </button>
        <button
          className={getMockButtonClass(difficulty === 'hard')}
          onClick={() => {
            chooseDifficulty('hard')
          }}
          type="button"
        >
          Hard
        </button>
        <button
          className="scale-mechanics-mock__button"
          disabled={phase === 'reveal'}
          onClick={() => {
            setSelectedOptionId(undefined)
            setPhase('reveal')
          }}
          type="button"
        >
          Reveal
        </button>
        <button
          className="scale-mechanics-mock__button"
          onClick={() => {
            setPhase('answering')
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
            disabled={phase === 'reveal'}
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

function EquationClue({ equation }: { equation: ScaleEquation }): JSX.Element {
  return (
    <div className="scale-mechanics-mock__equation">
      <EquationSide stacks={equation.left} />
      <span className="scale-mechanics-mock__equals">=</span>
      <EquationSide stacks={equation.right} />
    </div>
  )
}

function EquationSide({ stacks }: { stacks: ItemStack[] }): JSX.Element {
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

  if (phase === 'reveal' && option.id === correctOptionId) {
    classes.push('scale-mechanics-mock__answer--correct')
  }

  if (phase === 'reveal' && option.id === selectedOptionId && option.id !== correctOptionId) {
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
