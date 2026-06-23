import { useState } from 'react'
import type { JSX } from 'react'
import { WordleGame } from '../components/WordleGame'
import {
  evaluate_guess,
  get_game_state,
  is_valid_word
} from '../shared/wordleGame'
import { WORD_LENGTH } from '../shared/wordleGame.constants'
import type { Guess } from '../shared/wordleGame.types'
import '../components/WordleGame.css'


interface WordleMockProps {
  answer: string
  onSubmit: (submission: { guesses: Guess[] }) => void
  submitted?: boolean
}


export function WordleMock({ answer, onSubmit }: WordleMockProps): JSX.Element {
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [currentInput, setCurrentInput] = useState<string>('')
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [showUnrealWord, setShowUnrealWord] = useState(false)
  const [showShortWord, setShowShortWord] = useState(false)
  const phase = get_game_state(guesses, answer)

  function handleKey(key: string): void {
    if (phase !== 'playing' && phase !== 'waiting') return
    if (currentInput.length < WORD_LENGTH) {
      setCurrentInput(prev => prev + key)
    }
  }

  function handleDelete(): void {
    setCurrentInput(prev => prev.slice(0, -1))
  }

  function handleSubmit(): void {
    if (currentInput.length !== WORD_LENGTH){
      setShowShortWord(true)
      setTimeout(() => setShowShortWord(false), 3000)
      return
    }
    else if (!is_valid_word(currentInput)){
      setShowUnrealWord(true)
      setTimeout(() => setShowUnrealWord(false), 3000)
      return
    }

    else{
    const newGuess = evaluate_guess(currentInput, answer)
    const newGuesses = [...guesses, newGuess]
    const newIndex = guesses.length

    setGuesses(prev => [...prev, newGuess])
    setCurrentInput('')
    setRevealingRow(newIndex)
    setTimeout(() => setRevealingRow(null), WORD_LENGTH * 300)

    const newPhase = get_game_state(newGuesses, answer)

    if (newPhase === 'solved' || newPhase === 'failed') {
      onSubmit({ guesses: newGuesses })
    }
    }
  }

  return (
    <WordleGame
      guesses={guesses}
      answer={answer}
      gamephase={phase}
      currentInput={currentInput}
      onKey={handleKey}
      onDelete={handleDelete}
      onSubmit={handleSubmit}
      revealingRow={revealingRow}
      showUnrealWord={showUnrealWord}
      showShortWord={showShortWord}
    />
  )
}



