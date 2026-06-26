# Light Switch

## Overview

The Light-Switch minigame is a Brain Wiz puzzle challenge in which players must manipulate a set of switches to turn all lights to the “on” state.

Each switch affects one or more lights according to a randomised pattern. Toggling a switch will change the state of the connected lights.

The objective is simple: turn all lights on at the same time.

---

## Game concept

Light Switch works as a short logic puzzle.

A round contains:

- 4 to 6 lights
- 4 switches
- Each switch has 1 to 3 affected lights

Example puzzle:

```text
{
  "id": "puzzle-001",
  "lights": [
    { "id": 0, "isOn": true },
    { "id": 1, "isOn": false },
    { "id": 2, "isOn": true },
    { "id": 3, "isOn": true },
    { "id": 4, "isOn": false },
    { "id": 5, "isOn": true }
  ],
  "switches": [
    {
      "id": 0,
      "affectedLights": [0, 2, 4]
    },
    {
      "id": 1,
      "affectedLights": [1, 4]
    },
    {
      "id": 2,
      "affectedLights": [2, 3, 5]
    },
    {
      "id": 3,
      "affectedLights": [0, 1, 5]
    }
  ]
}
```

The player uses these switches to change the state of the lights. Once all lights are turned on, the switches are locked and can no longer be interacted with. The answer is automatically submitted, and the round ends immediately upon success.

---

## User flow

The Light Switch flow is:

1. The game starts a Light Switch round
2. The host displays instructions and the client displays the Light Switch screen
3. The player toggles the switches to change the state of the lights
4. The player attempts to find the correct combination that turns all lights on
5. The game automatically submits the combination once the win condition is reached (all lights are on)
6. The submitted combination is locked and can no longer be changed
7. The game checks whether the submitted combination is correct
8. The score is generated based on the time taken to complete the puzzle

---

## Main files

### `LightSwitch.tsx`

The Light Switch puzzle is implemented as an interactive game component responsible for handling player input, puzzle state, and win conditions in real time.

Core responsibilities:

- Rendering lights and switches based on puzzle data
- Tracking the current state of all lights
- Handling player interaction with switches
- Evaluating puzzle completion
- Reporting player progress and final results

#### Light Behavior

Each light has an id and a binary state ON (1) or OFF (0).

```ts
export interface Light {
  id: number
  isOn: boolean
}
```

Lights are stored as part of the puzzle state and are updated whenever a switch is toggled. The system re-renders light positions dynamically based on available screen space to ensure responsiveness across different aspect ratios (handled in `getLightPositions`).

#### Switch Behavior

Each switch has an id and controls a predefined list of lights.

```ts
export interface LightSwitch {
  id: number
  affectedLights: number[]
}
```

When a switch is activated (handled in `handleSwitchClick`):

- The switch ID is added to or removed from the current pressed switch list
- All affected lights have their state inverted
- The updated light state is stored immediately

Switches can be toggled multiple times unless the puzzle is solved. The system re-renders switch positions dynamically based on available screen space to ensure responsiveness across different aspect ratios (handled in `getSwitchPositions`).

#### Connections

Connections visually indicate which lights are affected by each switch.

The system generates a connection (simple s curve) between every switch and each light listed in its `affectedLights` property. These connections are rendered dynamically based on the current positions of the switches and lights (handled in `getCurvePath`).

#### Win Condition

After every interaction, the system checks if the win condition is met (handled in `checkIfSolved`):

All lights are in ON state.

If this condition is met:

- The puzzle is marked as solved
- All switches are disabled
- The final combination is submitted automatically via `onSubmit`

#### Progress Tracking

On every switch interaction:

The current switch combination is sent via `onProgress`. This allows external systems to track player progress.

---

### `LightSwitchGame.ts`

This file contains the core logic for generating valid Light Switch puzzles.

It is responsible for creating a randomized but always solvable puzzle configuration within the defined game constraints.

---

### Puzzle generation flow

A puzzle is generated through the following steps:

1. A random number of lights is selected between `MIN_LIGHTS` and `MAX_LIGHTS`.
2. A set of switches is generated using the defined constraints:
   - `SWITCH_COUNT`
   - `MIN_AFFECTED_LIGHTS`
   - `MAX_AFFECTED_LIGHTS`
3. An initial light state is created by simulating switch interactions.

#### Light state generation process

The initial light configuration is generated as follows:

1. Start with all lights in the ON state
2. Apply a random sequence of switch toggles
3. The system retries this process up to 3 times if the result is already solved
4. If all attempts fail, the generator falls back to a safe default state where all lights are OFF

This ensures that most generated puzzles are valid.

#### Core utilities

- `applySwitch` - Applies a switch to the current light state by toggling all affected lights.
- `createSwitches` - Generates a fixed number of switches (`SWITCH_COUNT`), each affecting between `MIN_AFFECTED_LIGHTS` and `MAX_AFFECTED_LIGHTS` randomly selected lights.
- `createLights` - Generates the initial light state by applying randomly selected switch operations within the constraints of `MIN_LIGHTS` and `MAX_LIGHTS`.
- `createLightSwitchPuzzle` - Main entry point that combines switch generation and light state generation to produce a complete puzzle.

### Output

The function returns a complete `LightSwitchPuzzle` object containing:

```ts
export interface LightSwitchPuzzle {
  id: string
  lights: Light[]
  switches: LightSwitch[]
}
```

---

### `LightSwitch.types.ts`

This file defines the TypeScript types used throughout the Light Switch puzzle implementation.

- `Light` - Represents a light and its current state.
- `LightSwitch` - Represents a switch and the lights it affects.
- `LightSwitchPuzzle` - Represents a complete puzzle configuration containing lights and switches.
- `LightSwitchGenerationInput` - Represents the input required to generate a puzzle.
- `LightSwitchGameProps` - Defines the properties passed to the Light Switch game component.

---

### `LightSwitch.constants.ts`

This file defines the configuration limits used by the Light Switch puzzle.

- `MIN_LIGHTS = 4` - Minimum number of lights in a puzzle.
- `MAX_LIGHTS = 6` - Maximum number of lights in a puzzle.
- `SWITCH_COUNT = 4` - Number of switches available in a puzzle.
- `MIN_AFFECTED_LIGHTS = 1` - Minimum number of lights affected by a switch.
- `MAX_AFFECTED_LIGHTS = 3` - Maximum number of lights affected by a switch.

These values are used during puzzle generation to ensure all puzzles follow the intended game design constraints.

---

## Server state and scoring flow

Light Switch uses the Brain Wiz public/private state split to keep the answer hidden from the client at all times.

### Round creation

When a Light Switch round is created, `LightSwitchServerAdapter.createRound()` generates three main components:

- `publicState` - { puzzle }
- `privateState` - { puzzle }
- `scoringConfig` - {baseScore, timeLimitMs}

## Submission format

When the player completes the puzzle, the client sends a submission containing only:

```ts
number[]
```

The submission is then evaluated before awarding points.

---

## Integration with the game flow

Light Switch is added as a selectable minigame in the Brain Wiz game flow.

The general integration works like this:

1. Light Switch is added to the available minigame blocks
2. The round builder can create a Light Switch round
3. The client can render the Light Switch surface
4. The player can submit a Light Switch answer
5. The answer payload is sent through the normal answer flow
6. The backend checks and scores the submitted answer

---

## Host/client behaviour

Light Switch is designed for the Brain Wiz host/client setup.

The host screen is used to present the instructions to all players.

The client is used by the player to interact with the puzzle. Players toggle switches to change the state of the lights and attempt to turn all lights on.

Important behaviour:

- Players can toggle any switch at any time while the puzzle is active
- Toggling a switch immediately updates all affected lights
- The current puzzle state is updated after every interaction
- The puzzle is automatically solved when all lights are turned on
- The solution is automatically submitted when the puzzle is solved
- After submission, all switches are disabled
- After submission, the switch configuration cannot be changed anymore

This prevents accidental answer changes after the puzzle has been completed.

---

## Summary

Light Switch adds a fast, visual logic puzzle to Brain Wiz. Players must toggle switches to turn all lights on by reasoning about how each switch affects multiple lights.

The implementation keeps the minigame separated into clear parts:

- `LightSwitch.tsx` handles rendering, interaction, and game logic
- `LightSwitch.css` handles the visual layout and light/switch styling
- `LightSwitch.types.ts` defines the puzzle, switch, and component data models
- `LightSwitch.constants.ts` defines puzzle generation constraints (lights, switches, and affected ranges)

The final version is responsive, interactive, and automatically locks once the puzzle is solved to ensure a consistent final result.
