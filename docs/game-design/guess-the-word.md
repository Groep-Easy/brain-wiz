# Guess the Word

## Overview

Guess the Word is a Brain Wiz minigame where players have to guess a secret 5-letter word within 6 attempts. The host shows the name of the puzzle on the main screen, while the player plays the game and types guesses using an on-screen keyboard and answer grid on the phone client.

The goal is simple: find the correct word using the color coded feedback from each guess. Each guess reveals which letters are correct, present but misplaced, or not in the word at all.

## Game concept

Guess the Word works with a 5-letter word puzzle.

A round contains:

- A secret 5-letter word
- A 6-row tile grid showing guesses and feedback
- An on-screen keyboard for input
- A submit button (ENTER key)
- A delete button (⌫ key)

After each guess, every tile changes colour to give feedback:

Green: Correct letter, correct position.
Yellow: Correct letter, wrong position.
Pink:  Letter not in the word.

### Double letter handling

Double letters are handled carefully. If a player guesses a word with a repeated letter but the answer only contains that letter once, only one of the two tiles will be marked green or yellow. The other will be marked pink. This prevents misleading feedback about letter frequency.

### Input validation

Two validation messages can appear:

- **"The word is too short!"** — shown when the player tries to submit a guess with fewer than 5 letters
- **"This word does not exist!"** — shown when the submitted word is not found in the word list

Both messages disappear automatically after 3 seconds.

---

## User flow

The Guess the Word flow is:

1. The game starts a Guess the Word round
2. The host/client displays the Guess the Word screen
3. The player types a 5-letter word using the on-screen keyboard
4. The player submits the guess by pressing ENTER
5. The tiles reveal feedback with a staggered flip animation
6. The player continues guessing until the word is solved, all 6 attempts are used, or the time is up
7. The game phase transitions to `solved` or `failed`
8. The final submission is sent through the normal scoring/round flow

This keeps Guess the Word consistent with the other minigames in Brain Wiz.

---

## Main files

The Guess the Word minigame is split into small files so the logic, types, styling, and preview setup stay separated.
(When implementing the game was called wordle, but the name changed)

### `WordleGame.tsx`

This is the main React component for the minigame.

It is responsible for:

- Rendering the full Guess the Word screen
- Showing the title
- Rendering the tile grid (rows × columns)
- Rendering the on-screen keyboard
- Showing validation messages for short or invalid words
- Triggering tile reveal animations per row

The component receives all its data through props and has no internal state. This keeps it reusable in both the real game flow and the mock preview flow.

The component contains several sub-components:

#### `Title`

Renders the "Guess the word" heading at the top of the screen.

#### `TileRow`

Renders a single row of tiles. Each row can be in one of three states:

- A **completed guess** — shows the guessed letters with their colour-coded feedback states
- The **active row** — shows the letters the player is currently typing
- An **empty row** — shows blank tiles for unused attempts

The `isRevealing` prop triggers the staggered flip animation on the row when feedback arrives.

#### `Tile`

Renders a single letter tile. The tile uses its `state` prop to apply the correct color class:

```ts
type TileState = 'empty' | 'correct' | 'present' | 'wrong'
```

When `isRevealing` is true, each tile receives a staggered animation delay based on its index:

```ts
const delay = isRevealing ? `${index * 300}ms` : '0ms'
```

This creates a left-to-right flip effect when a guess is evaluated.

#### `Keyboard`

Renders the on-screen QWERTY keyboard split into three rows:

- Row 1: Q–P (10 keys)
- Row 2: A–L (9 keys)
- Row 3: ENTER, Z–M (7 keys), ⌫

The ENTER and ⌫ keys use the `key--wide` class to make them visually distinct.

#### `handleShortWord` / `handleUnrealWord`

These functions return small notification elements shown conditionally when the player submits an invalid guess:

```tsx
{showShortWord && handleShortWord()}
{showUnrealWord && handleUnrealWord()}
```

---

### `WordleGame.types.ts`

This file defines the TypeScript types for the Guess the Word components.

**`WordleGameProps`** — props for the main `WordleGame` component.

**`TileRowProps`** — props for a single tile row.

**`TileProps`** — props for a single tile.

---
### `WordleMock.tsx`

The mock file contains all the stateful game logic and is used to drive the `WordleGame` component during both local development and the real game flow.

It manages:

- `guesses` — the list of evaluated guesses received from feedback
- `guessWords` — the list of submitted guess strings
- `currentInput` — the word the player is currently typing
- `revealingRow` — which row is currently animating
- `showUnrealWord` / `showShortWord` — validation message visibility
- `waitingForFeedback` — whether the game is waiting for the server to respond

#### Reset on new round

When a new `roundId` is received, all state is reset:

```ts
useEffect(() => {
  setGuesses([])
  setGuessWords([])
  setCurrentInput('')
  setRevealingRow(null)
  setWaitingForFeedback(false)
  autoSubmittedGuessCount.current = 0
}, [roundId])
```

This ensures every new Guess the Word round starts clean.

#### Feedback handling

When new `feedback` arrives from the server, the component:

1. Updates `guesses` and `guessWords` with the server-evaluated result
2. Clears the `waitingForFeedback` flag
3. Triggers the reveal animation on the latest row
4. Automatically calls `onSubmit` if the game phase is `solved` or `failed`

The `autoSubmittedGuessCount` ref prevents `onSubmit` from being called more than once for the same guess count:

```ts
const autoSubmittedGuessCount = useRef(0)
```

#### Input handling

Key presses are blocked when:

- The game is already `submitted`
- The component is `waitingForFeedback`
- The game phase is not `playing` or `waiting`

Input is converted to uppercase and capped at `wordLength` characters.

#### Submit handling

When the player presses ENTER:

1. If the input is shorter than `wordLength`, `showShortWord` is shown for 3 seconds
2. If the word is not in the dictionary, `showUnrealWord` is shown for 3 seconds
3. Otherwise, the guess is added to `guessWords`, `currentInput` is cleared, `waitingForFeedback` is set to `true`, and `onGuess` is called with the updated guess list

The component waits for the server to return feedback before allowing the next guess.

#### Body class

The mock adds a CSS class to the body on mount:

```ts
document.body.classList.add('wordle-game-page')
```

This allows global background styling to be applied specifically when the Guess the Word screen is active, without affecting other parts of the app.

---

### `wordleGame.constants.ts` (shared)

This file defines the shared constants used across the Guess the Word minigame.

```ts
export const WORD_LENGTH = 5
export const MAX_TRIES = 6
export const ALPHABET = [...'QWERTYUIOPASDFGHJKLZXCVBNM'] as const
export type Letter = (typeof ALPHABET)[number]
export const FIVE_LETTER_WORDS = words.filter((w) => w.length === WORD_LENGTH)
```

The `ALPHABET` constant is ordered in QWERTY layout so the keyboard renders correctly without any additional sorting.

`FIVE_LETTER_WORDS` is derived at startup by filtering the full word list from the `an-array-of-english-words` package down to only 5-letter words.

---

### `wordleGame.types.ts` (shared)

This file defines the shared TypeScript types used across the Guess the Word minigame.

---

### `wordleGame.ts` (shared logic)

This file contains all pure game logic for the Guess the Word minigame.

#### `evaluate_guess(guess, answer)`

Evaluates a single guess against the answer and returns a `Guess` object with tile states.

The evaluation runs in two passes:

1. **First pass** — marks all correct letters (green) and removes them from the remaining letter pool
2. **Second pass** — marks present letters (yellow) if they appear in the remaining pool, otherwise marks them as wrong (pink)

This two-pass approach correctly handles double letters. A repeated letter in a guess is only marked yellow or green if the answer contains enough occurrences of that letter to account for it.

#### `is_solved(guess, answer)`

Returns `true` if the guess exactly matches the answer.

#### `get_game_state(guesses, answer)`

Derives the current `GamePhase` from the list of guesses.|

#### `get_random_word()`

Returns a random 5-letter word from `FIVE_LETTER_WORDS`. Falls back to `'crane'` if the list is unexpectedly empty.

#### `is_valid_word(word)`

Returns `true` if the word exists in the `FIVE_LETTER_WORDS` list. Used to validate player input before submission.

#### `getAmountGuesses(guesses)`

Returns the number of guesses made.

#### `getAmountTime(startTime, endTime)`

Returns the elapsed time in seconds between two `Date` objects.

---

## Word list and known limitation

The Guess the Word minigame currently uses the `an-array-of-english-words` npm package as its word source. At startup, the full list of over 120,000 words is filtered down to only 5-letter words, resulting in approximately 12,000 valid words.

This approach works but has a known limitation: the package is large and the filtered list is kept in memory at runtime.

Two alternative approaches were considered but not implemented:

1. **Store the 5-letter words in a JSON file** — this was explored but the resulting file (~12,000 words) exceeded the Sigrid code quality constraints and was therefore not viable.

2. **Seed the words into the database** — this was considered but advised against because it would require restructuring the minigame and parts of the main game framework, which was not feasible within the project timeline.

As a result, the current implementation retains the npm package. This is a known technical debt item and a better solution should be considered in future projects.

---

## Integration with the game flow

Guess the Word is added as a selectable minigame in the Brain Wiz game flow.

The general integration works like this:

1. Guess the Word is added to the available minigame blocks
2. The round builder creates a Guess the Word round with a secret word
3. The client renders the Guess the Word surface via `WordleMock`
4. The player submits guesses through the normal answer flow
5. The server evaluates each guess and returns `WordleFeedback`
6. The final submission is sent when the game phase reaches `solved` or `failed`
7. The backend scores the submitted answer

Guess the Word reuses the same round, answer, and scoring flow as the other minigames.

---

## Host/client behaviour

Guess the Word is designed for the Brain Wiz host/client setup.

The host screen displays the title of the game.
The phone client is used by the player to type and submit guesses into a grid using the on-screen keyboard.

Important behaviour:

- Only letters from the QWERTY alphabet can be entered
- Input is capped at 5 characters
- Submitting a word shorter than 5 letters shows a warning message
- Submitting a word not in the dictionary shows a warning message
- Both warning messages disappear after 3 seconds
- Input and submission are blocked while waiting for server feedback
- Input and submission are blocked after the game is submitted

---

## Summary

Guess the Word adds an engaging word-guessing minigame to Brain Wiz. Players guess a 5-letter word within 6 attempts, using color coded tile feedback to narrow down the answer.

The implementation is split into clear parts:

- `WordleGame.tsx` handles rendering, tile display, and the on-screen keyboard
- `WordleGame.types.ts` defines the component contract
- `WordleMock.tsx` contains all stateful game logic and drives the component
- `wordleGame.constants.ts` defines shared constants including the word list
- `wordleGame.types.ts` defines shared types used across the minigame
- `wordleGame.ts` contains all pure game logic including guess evaluation and game state

 Input is validated against a dictionary before submission. The word list is currently sourced from an npm package, which is a known limitation.
