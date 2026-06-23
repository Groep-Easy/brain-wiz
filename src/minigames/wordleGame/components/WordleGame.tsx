import './WordleGame.css'
import type { JSX } from 'react'
import type { WordleGameProps, TileRowProps, TileProps, KeyboardProps } from './WordleGame.types'
import type { Letter } from '../shared/wordleGame.constants';
import { ALPHABET } from '../shared/wordleGame.constants';
import type { TileState } from '../shared/wordleGame.types';

export function WordleGame(props: WordleGameProps): JSX.Element {
  const { guesses, answer, currentInput, onDelete, onKey, onSubmit, revealingRow, showUnrealWord, showShortWord} = props;
  const wordLength = answer.length;
  const totalRows = 6;

  const rows = Array.from({ length: totalRows }, (_, index) => {
    const completedGuess = guesses[index];
    const isActive = index === guesses.length;

    return (
      <TileRow
        key={index}
        tilerow={completedGuess}
        currentInput={isActive ? currentInput : ''}
        wordLength={wordLength}
        isactive={isActive}
        isRevealing={revealingRow === index}
      />
    );
  });

  return (
    <div className="wordle-game">
      <Title />
      {rows}
      {showShortWord && handleShortWord()}
      {showUnrealWord && handleUnrealWord()}
      <Keyboard
      onDelete={onDelete}
      onKey={onKey}
      onSubmit={onSubmit} />
    </div>
  );
}

export function Title() : JSX.Element {
  return <div className='title'> Guess the word </div>
}

export function Tile({ tile, index, isRevealing }: TileProps): JSX.Element {
  const delay = isRevealing ? `${index * 300}ms` : '0ms'
  return (
    <div className= {`tile tile--${tile.state}`}
      style={{ animationDelay: delay,
       transition: `background-color 0.3s ease ${delay},
                    border-color 0.3s ease ${delay}` }}>
      {tile.letter}
    </div>
  )
}

export function TileRow(props: TileRowProps): JSX.Element {
  return (
    <div className="tile-row">
      {Array.from({ length: props.wordLength }, (_, index) => {
        let letter: Letter | '' = ''
        let state: TileState = 'empty'

        if (props.tilerow) {
          letter = props.tilerow.word[index]?.letter ?? ''
          state = props.tilerow.word[index]?.state ?? 'empty'
        } else if (props.isactive) {
          letter = props.currentInput[index] ?? ''
        }

        return <Tile key={index} tile={{ letter, state }} index={index} isRevealing={props.isRevealing} />
      })}
    </div>
  )
}

export function Keyboard({ onKey, onSubmit, onDelete }: KeyboardProps): JSX.Element {
  return (
    <div className="keyboard">

      <div className='keyboard keyboard--row1'>
      {ALPHABET.slice(0, 10).map((letter) => (
        <button key={letter} className="key" onClick={() => onKey(letter)}>
          {letter}
        </button>
      ))}
      </div>

      <div className='keyboard keyboard--row2'>
      {ALPHABET.slice(10, 19).map((letter) => (
        <button key={letter} className="key" onClick={() => onKey(letter)}>
          {letter}
        </button>
      ))}
      </div>

      <div className='keyboard keyboard--row3'>
      <button className="key key--wide" onClick={onSubmit}>ENTER</button>

      {ALPHABET.slice(19).map((letter) => (
        <button key={letter} className="key" onClick={() => onKey(letter)}>
          {letter}
        </button>
      ))}

      <button className="key key--wide" onClick={onDelete}>⌫</button>

      </div>
    </div>
  )
}

export function handleUnrealWord(): JSX.Element{
  return (
    <div className='unrealword'>
      This word does not exist!
    </div>
  )
}

export function handleShortWord(): JSX.Element{
  return (
    <div className='shortword'>
      The word is too short!
    </div>
  )
}
