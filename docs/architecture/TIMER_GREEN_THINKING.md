# Green Thinking: Timer Socket Traffic

As part of the green thinking criteria, we reduced unnecessary real-time timer updates in the game flow.

Previously, the server emitted `TIMER_TICK` events during every timed phase, including the round intro, answer phase, reveal phase and leaderboard phase. However, the timer is only visually needed during the active gameplay phase, where players are answering a question or playing a minigame.

The implementation now only broadcasts `TIMER_TICK` events during the `playing` phase. Other phases still use the timer internally so the game flow continues automatically, but they no longer send repeated timer updates over WebSockets.

This change affects:

* `game-engine.service.ts`

  * Timer ticks are only emitted when the phase needs visible countdown updates
  * Intro, reveal and leaderboard timers still run internally without broadcasting ticks

* Host `App.tsx`

  * Timer ticks are ignored when the host is not in the `playing` phase
  * Old timer state is reset when leaving active gameplay

* Client `App.tsx`

  * Timer ticks are ignored when the client is not in the `playing` phase
  * This prevents unnecessary state updates and rerenders outside gameplay

## Why this supports green thinking

This supports green thinking because it reduces unnecessary work during the game. Fewer timer events means less WebSocket traffic, less server broadcasting work, fewer frontend state updates and fewer unnecessary rerenders on the host and client devices.

The game still behaves the same for the user: the timer is shown during active gameplay, and the reveal and leaderboard phases still continue automatically. The difference is that the application no longer sends repeated timer updates during phases where the countdown is not needed.

## Result

The implementation improves energy efficiency without changing the user experience. It keeps the real-time communication focused on the moments where it is actually needed.
