import { useEffect, useRef, useState } from 'react'
import type { JSX } from 'react'
import { WordleGame } from '../components/WordleGame'
import { is_valid_word } from '../shared/wordleGame'
import { WORD_LENGTH } from '../shared/wordleGame.constants'
import type { GamePhase, Guess, WordleFeedback, WordleSubmission } from '../shared/wordleGame.types'
import '../components/WordleGame.css'

interface WordleMockProps {
  roundId?: string
  wordLength?: number
  maxTries?: number
  feedback?: WordleFeedback | null | undefined
  onGuess?: (submission: WordleSubmission) => void
  onSubmit: (submission: WordleSubmission) => void
  submitted?: boolean
}

export function WordleMock({
  roundId,
  wordLength = WORD_LENGTH,
  maxTries = 6,
  feedback = null,
  onGuess,
  onSubmit,
  submitted = false,
}: WordleMockProps): JSX.Element {


  useEffect(() => {
    document.body.classList.add('wordle-game-page')
    return () => {
      document.body.classList.remove('wordle-game-page')
    }
  }, [])


  const [guesses, setGuesses] = useState<Guess[]>([])
  const [guessWords, setGuessWords] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState<string>('')
  const [revealingRow, setRevealingRow] = useState<number | null>(null)
  const [showUnrealWord, setShowUnrealWord] = useState(false)
  const [showShortWord, setShowShortWord] = useState(false)
  const [waitingForFeedback, setWaitingForFeedback] = useState(false)
  const autoSubmittedGuessCount = useRef(0)
  const phase: GamePhase = feedback?.phase ?? (guesses.length > 0 ? 'playing' : 'waiting')

  useEffect(() => {
    setGuesses([])
    setGuessWords([])
    setCurrentInput('')
    setRevealingRow(null)
    setWaitingForFeedback(false)
    autoSubmittedGuessCount.current = 0
  }, [roundId])

  useEffect(() => {
    if (!feedback) return

    const nextWords = feedback.guesses.map((guess) =>
      guess.word.map((tile) => tile.letter).join('')
    )

    setGuesses(feedback.guesses)
    setGuessWords(nextWords)
    setWaitingForFeedback(false)

    const latestRow = feedback.guesses.length - 1
    if (latestRow >= 0) {
      setRevealingRow(latestRow)
      setTimeout(() => setRevealingRow(null), wordLength * 300)
    }

    if (
      (feedback.phase === 'solved' || feedback.phase === 'failed') &&
      !submitted &&
      autoSubmittedGuessCount.current !== nextWords.length
    ) {
      autoSubmittedGuessCount.current = nextWords.length
      onSubmit({ guesses: nextWords })
    }
  }, [feedback, onSubmit, submitted, wordLength])

  function handleKey(key: string): void {
    if (submitted || waitingForFeedback || (phase !== 'playing' && phase !== 'waiting')) return
    if (currentInput.length < wordLength) {
      setCurrentInput((prev) => prev + key.toUpperCase())
    }
  }

  function handleDelete(): void {
    if (submitted || waitingForFeedback) return
    setCurrentInput((prev) => prev.slice(0, -1))
  }

  function handleSubmit(): void {
    if (submitted || waitingForFeedback || guessWords.length >= maxTries) return
    if (currentInput.length !== wordLength) {
      setShowShortWord(true)
      setTimeout(() => setShowShortWord(false), 3000)
      return
    } else if (!is_valid_word(currentInput)) {
      setShowUnrealWord(true)
      setTimeout(() => setShowUnrealWord(false), 3000)
      return
    } else {
      const guessedWord = currentInput.toUpperCase()
      const newGuessWords = [...guessWords, guessedWord]

      setGuessWords(newGuessWords)
      setCurrentInput('')
      setWaitingForFeedback(true)
      onGuess?.({ guesses: newGuessWords })
    }
  }

  return (
    <WordleGame
      guesses={guesses}
      wordLength={wordLength}
      maxTries={maxTries}
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
