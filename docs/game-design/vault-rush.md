# Vault Rush

## Overview

Vault Rush is a Brain Wiz minigame where players have to crack a 4-digit vault code by using logical clues. The host shows the puzzle and the clues on the main screen, while the player enters the code on the phone client.

The goal of the minigame is simple: find the correct vault code as quickly as possible. This makes the game easy to understand for players, but still interesting because they need to reason through the hints under time pressure.

The minigame is designed around a vault/security theme. The UI uses a dark background, digital green code display, golden vault accents, side lasers, security panels, and a locked-vault look to make the game feel more like a real safe-cracking challenge.

---

## Game concept

Vault Rush works with a short code puzzle.

A round contains:

- A 4-digit secret code
- A set of clues
- A code input on the client
- A submit button
- A result check after submitting

Example clues:

```text
The first digit is lower than 3
The second digit is even
The third digit is higher than 5
The fourth digit is not 0
```

The player uses these clues to enter the correct code. Once the player submits, the answer is locked and cannot be changed anymore.

---

## User flow

The Vault Rush flow is:

1. The game starts a Vault Rush round
2. The host/client displays the Vault Rush screen
3. The player reads the clues
4. The player enters a 4-digit code
5. The player submits the code
6. The submitted answer is locked
7. The game checks whether the submitted code is correct
8. The result is used by the normal scoring/round flow

This keeps Vault Rush consistent with the other minigames in Brain Wiz.

---

## Main files

The Vault Rush minigame is split into small files so the logic, types, styling, and preview setup stay separated.

### `VaultRush.tsx`

This is the main React component for the minigame.

It is responsible for:

- Rendering the Vault Rush screen
- Showing the title and subtitle
- Showing the 4-digit code boxes
- Showing the clues
- Handling the code input
- Submitting the entered code
- Locking the input after submit
- Showing the solution when `solutionCode` is available

The component receives its data through props. This keeps the component reusable in both the real game flow and the mock preview flow.

Important values:

```ts
const MAX_CODE_LENGTH = 4
```

This limits the player input to 4 digits.

The component stores the current typed code in local state:

```ts
const [code, setCode] = useState('')
```

When a new puzzle starts, the code is reset:

```ts
useEffect(() => {
  setCode('')
  onCodeChange?.('')
}, [puzzle.id])
```

This is important because every new Vault Rush puzzle should start with an empty input.

The input handler only allows numbers:

```ts
const nextCode = value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH)
```

This removes every non-digit character and cuts the input off after 4 digits.

The input is also protected after submit:

```ts
if (submitted) {
  return
}
```

This prevents the submitted answer from changing after the player has already submitted.

The input field is disabled when the answer has been submitted:

```tsx
disabled = { submitted }
```

This is important because the submit button already becomes disabled after submitting. Without disabling the input too, the player could still change the local code after submission, which could accidentally change a correct answer into an incorrect one.

---

### `VaultRush.css`

This file contains all styling for the Vault Rush minigame.

The styling is scoped under:

```css
.vault-rush-app
```

This is important because it prevents Vault Rush styles from leaking into other parts of the client, such as the normal question screens or the Sliding Puzzle minigame.

The CSS creates the vault theme by using:

- A dark security-room background
- A subtle grid pattern
- Red side lasers
- Security warning panels
- A vault-door shape behind the title
- Green digital code boxes
- Gold accent colours
- A styled submit button
- Responsive spacing for smaller screens

The main screen container is:

```css
.vault-rush-app
```

This element controls the full-screen layout, background, font, theme variables, and general page alignment.

The main card is:

```css
.vault-rush-card
```

This is the central panel that contains the full minigame UI. It uses dark panels, gold borders, rounded corners, and shadows to make it look like a secure vault interface.

The vault-door decoration is created with pseudo-elements:

```css
.vault-rush-card::before
.vault-rush-card::after
```

These are decorative only. They do not affect the game logic.

The code display uses:

```css
.vault-rush-code
.vault-rush-code-box
```

These classes make the digits look like a digital lock display. The green glow makes the code area feel like an electronic vault keypad.

The clues use:

```css
.vault-rush-clues
.vault-rush-clue
```

Each clue is styled like a security hint card. The diamond icon before each clue is added with:

```css
.vault-rush-clue::before
```

The side security panels are added with:

```css
.vault-rush-header::before
.vault-rush-header::after
```

These panels are only shown on wider screens:

```css
@media (min-width: 1100px);
```

This keeps the layout clean on mobile screens and makes better use of empty space on large host screens.

---

### `VaultRush.types.ts`

This file defines the TypeScript types for the Vault Rush component.

The most important type is the props type used by `VaultRush.tsx`.

It describes what the component needs to render and interact with the game:

- `puzzle`
- `readOnly`
- `solutionCode`
- `submitted`
- `onCodeChange`
- `onSubmitCode`

The `puzzle` contains the data needed for the round, such as the amount of digits and the clue list.

The `readOnly` prop is used when the component should only display the puzzle without allowing the user to type or submit an answer.

The `solutionCode` prop is used when the correct code should be shown, for example after the round is finished or in a mock/test view.

The `submitted` prop tells the component whether the player has already submitted an answer.

The callback props are used to communicate with the parent component:

```ts
onCodeChange
onSubmitCode
```

This keeps the component clean because it does not need to know how the answer is stored or sent to the server.

---

### `VaultRushMock.tsx`

The mock file is used to test and preview Vault Rush locally without needing to start a full multiplayer game.

It is useful during development because it allows the developer to:

- Render the Vault Rush component directly
- Test the UI
- Test typing a code
- Test submitting a code
- Test the submitted state
- Test the solution display
- Quickly check styling changes

The mock should use a sample puzzle object with a fixed code and fixed clues. This makes the minigame predictable during development.

The mock is not the real game logic. It is only a local preview harness.

---

### `Game.tsx`

The client `Game.tsx` file is used as a local minigame preview screen.

It currently allows switching between:

```ts
type PreviewMinigame = 'sliding-puzzle' | 'vault-rush'
```

The selected minigame is stored in state:

```ts
const [selectedMinigame, setSelectedMinigame] = useState<PreviewMinigame>('vault-rush')
```

The preview buttons allow the developer to switch between the Sliding Puzzle and Vault Rush:

```tsx
<button onClick={() => setSelectedMinigame('sliding-puzzle')}>
  Sliding Puzzle
</button>

<button onClick={() => setSelectedMinigame('vault-rush')}>
  Vault Rush
</button>
```

The correct mock component is then rendered:

```tsx
{
  selectedMinigame === 'sliding-puzzle' ? <SlidingPuzzleMock /> : <VaultRushMock />
}
```

This makes `/game` useful as a development screen for testing minigames without going through the full host/client flow every time.

---

## Integration with the game flow

Vault Rush is added as a selectable minigame in the Brain Wiz game flow.

The general integration works like this:

1. Vault Rush is added to the available minigame blocks
2. The round builder can create a Vault Rush round
3. The client can render the Vault Rush surface
4. The player can submit a Vault Rush answer
5. The answer payload is sent through the normal answer flow
6. The backend checks and scores the submitted answer

This means Vault Rush does not need a completely separate game system. It reuses the same round, answer, and scoring flow as the other minigames.

---

## Host/client behaviour

Vault Rush is designed for the Brain Wiz host/client setup.

The host screen is used to present the minigame clearly on a large screen. The visual theme is important here because players look at the host screen together.

The phone client is used by the player to enter the code. The input is kept simple because the player needs to respond quickly.

Important behaviour:

- Only digits can be entered
- The code length is limited to 4 digits
- The submit button is disabled until 4 digits are entered
- After submitting, the input is disabled
- After submitting, the submitted code cannot be changed anymore

This prevents accidental answer changes after submission.

---

## Styling decisions

The Vault Rush styling is intentionally more detailed than the first basic version because this minigame depends heavily on theme and atmosphere.

The main design choices are:

### Vault theme

The minigame should feel like a vault/security challenge, not just a normal form. That is why the design uses dark panels, gold borders, glowing green code boxes, and security-style decorations.

### Strong focus on the code

The 4-digit code is the most important part of the game. The code boxes are large, centered, and styled like a digital lock display.

### Clues as security cards

The clues are shown in separate cards so they are easy to scan. This helps players quickly reason through the puzzle.

### Side visuals for large screens

On wide host screens, empty space can make the minigame look unfinished. The side lasers and security panels fill this space without adding extra gameplay complexity.

### Scoped styling

All Vault Rush styling is placed under `.vault-rush-app`. This is important because the project contains multiple games and screens. Scoped styling reduces the risk of accidentally changing other parts of the app.

---

## Input and submit protection

One important bug fix was added around the submit behaviour.

Before the fix, the user could submit a correct code, but still change the input afterwards. Because `onCodeChange` still fired after submission, the stored answer could change after the submit button was already disabled.

The fix was to stop input changes after submit:

```ts
if (submitted) {
  return
}
```

The input field was also disabled:

```tsx
disabled = { submitted }
```

This makes the submitted answer final.

This behaviour is important for fairness because players should not be able to change their answer after submitting.

---

## Accessibility notes

The code display has an accessible label:

```tsx
aria-label="Vault code"
```

The clue section also has an accessible label:

```tsx
aria-label="Vault clues"
```

The input uses numeric input mode:

```tsx
inputMode = 'numeric'
```

This helps mobile devices show a numeric keyboard, which makes the minigame easier to play on phones.

---

## How to test locally

Start the project and open the minigame preview route:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/game
```

Use the preview buttons to switch to Vault Rush if needed.

Check the following behaviour:

- Vault Rush renders correctly
- The vault theme is visible
- The side lasers and security panels are visible on wide screens
- The input only accepts numbers
- The input cannot go above 4 digits
- The submit button is disabled before 4 digits are entered
- The submit button becomes disabled after submitting
- The input becomes disabled after submitting
- The submitted answer does not change after submit
- The solution can be shown when `solutionCode` is provided

---

## Summary

Vault Rush adds a fast, visual, and easy-to-understand minigame to Brain Wiz. Players crack a 4-digit vault code by reading clues and submitting their answer through the client.

The implementation keeps the minigame separated into clear parts:

- `VaultRush.tsx` handles rendering and input behaviour
- `VaultRush.css` handles the complete vault/security theme
- `VaultRush.types.ts` defines the component contract
- `VaultRushMock.tsx` provides a local development preview
- `Game.tsx` allows switching between minigames during development

The final version is functional, styled, and protected against answer changes after submit.
