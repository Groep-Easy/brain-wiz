import { useEffect, useRef, useState } from 'react'
import type { GamePhase } from '@brain-wiz/shared/types/index'
import { MinigameDynamicGrid } from '@brain-wiz/minigames/components/MinigameDynamicGrid'
import { MinigameChoiceGrid } from '@brain-wiz/minigames/components/MinigameChoiceGrid'
import { JoinScreen } from './components/JoinScreen'
import { Waiting } from './screens/Waiting'
import { RoundIntro } from './screens/RoundIntro'
import { Answer } from './screens/Answer'
import { Leaderboard } from './screens/Leaderboard'
import { GameOver } from './screens/GameOver'
import { LoadingComp } from './components/LoadingComp'
import { ReconnectToast } from './components/ReconnectToast'
import { CountdownCircle } from '@brain-wiz/shared/components/CountdownCircle'
import { VaultRush } from '../minigames/vault-rush/components/VaultRush'
import type { VaultRushPuzzle } from '../minigames/vault-rush/shared/vaultRushGame'
import type {
  WordleFeedback,
  WordlePublicState,
} from '../minigames/wordleGame/shared/wordleGame.types'
import { useClientSocket } from './hooks/useClientSocket'
import { LightSwitchPuzzlePuzzle } from '../minigames/light-switch/LightSwitch'
import type { LightSwitchPuzzle } from '../minigames/light-switch/LightSwitch.types'
import { BonkAir } from '../minigames/bonk-air/components/BonkAir'
import type { BonkAirPuzzle } from '../minigames/bonk-air/shared/bonkAirGame'
import { BonkAirScorecard } from './components/BonkAirScorecard'
import { FATAL_COUNTDOWN_SECONDS, FULL_BLEED_MINIGAMES } from './App.constants'
import type { ClientApi, MinigamePhase, RoundContent } from './App.types'

function readCodeFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')?.toUpperCase() ?? ''
}

// --- Minigame renderers, dispatched by round type ------------------------

function renderBalanceScaleMinigame(
  s: ClientApi,
  roundContent: RoundContent,
  phase: MinigamePhase
): React.JSX.Element {
  const solution = s.roundReveal?.publicSolution as { correctOptionId?: string } | undefined
  return (
    <MinigameChoiceGrid
      choices={roundContent.answerChoices ?? []}
      correctChoiceId={solution?.correctOptionId}
      onSelect={(choice) => s.selectOption(choice.id, choice.submission)}
      phase={phase}
      selectedChoiceId={s.selectedOptionId}
      submitted={s.roundSubmitted}
    />
  )
}

function renderSlidingPuzzleMinigame(
  s: ClientApi,
  roundContent: RoundContent,
  phase: MinigamePhase
): React.JSX.Element {
  return (
    <MinigameDynamicGrid
      type={'sliding-puzzle'}
      puzzle={roundContent.publicState}
      onProgress={s.handleRoundProgress}
      onSubmit={s.handleRoundSubmit}
      submitted={s.roundSubmitted}
      phase={phase}
    />
  )
}

function renderVaultRushMinigame(
  s: ClientApi,
  roundContent: RoundContent,
  phase: MinigamePhase
): React.JSX.Element {
  const solution = s.roundReveal?.publicSolution as { code?: string } | undefined
  const puzzle = roundContent.publicState as VaultRushPuzzle
  const isReveal = phase === 'reveal'
  return (
    <section className="client-minigame client-minigame--vault-rush">
      <VaultRush
        onSubmitCode={(code) => s.handleRoundSubmit({ code })}
        puzzle={puzzle}
        readOnly={isReveal}
        solutionCode={isReveal ? solution?.code : undefined}
        submitted={s.roundSubmitted}
      />
    </section>
  )
}

function renderWordleMinigame(
  s: ClientApi,
  roundContent: RoundContent,
  phase: MinigamePhase
): React.JSX.Element {
  const publicState = roundContent.publicState as WordlePublicState
  const feedback =
    s.roundFeedback?.roundId === roundContent.roundId
      ? (s.roundFeedback.feedback as WordleFeedback)
      : null
  return (
    <MinigameDynamicGrid
      type="wordle"
      feedback={feedback}
      onGuess={s.handleRoundProgress}
      onSubmit={s.handleRoundSubmit}
      publicState={publicState}
      roundId={roundContent.roundId}
      submitted={s.roundSubmitted}
      phase={phase === 'reveal' ? 'reveal' : 'playing'}
    />
  )
}

function renderLightSwitchMinigame(s: ClientApi, roundContent: RoundContent): React.JSX.Element {
  return (
    <LightSwitchPuzzlePuzzle
      puzzle={roundContent.publicState as LightSwitchPuzzle}
      onProgress={s.handleRoundProgress}
      onSubmit={s.handleRoundSubmit}
    />
  )
}

/**
 * Bonk Air keeps its drawn plan + replay-finished flag locally, and flushes the
 * plan one tick before the server closes the answer window (its own local
 * countdown can otherwise commit late). That local state is why it's its own
 * component rather than a stateless renderer.
 */
function BonkAirMinigame({
  s,
  roundContent,
  phase,
}: {
  s: ClientApi
  roundContent: RoundContent
  phase: MinigamePhase
}): React.JSX.Element {
  const bonkPlanRef = useRef<unknown>(null)
  const [bonkReplayDone, setBonkReplayDone] = useState(false)

  useEffect(() => {
    if (
      s.roomState?.phase === 'playing' &&
      !s.roundSubmitted &&
      s.secondsRemaining > 0 &&
      s.secondsRemaining <= 1
    ) {
      s.handleRoundSubmit(bonkPlanRef.current ?? { solution: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.secondsRemaining, s.roundSubmitted, s.roomState?.phase])

  const puzzle = roundContent.publicState as BonkAirPuzzle
  const points = s.roundReveal?.playerResults?.[s.playerId ?? '']?.pointsAwarded ?? 0

  return (
    <section className="client-minigame client-minigame--bonk-air">
      <BonkAir
        phase={phase}
        puzzle={puzzle}
        onSubmissionChange={(submission) => {
          bonkPlanRef.current = submission
        }}
        onCommit={(submission) => {
          if (!s.roundSubmitted) s.handleRoundSubmit(submission)
        }}
        onReplayComplete={() => setBonkReplayDone(true)}
      />
      {phase === 'reveal' && bonkReplayDone ? (
        <div className="bonk-air-scorecard-overlay">
          <BonkAirScorecard points={points} />
        </div>
      ) : null}
    </section>
  )
}

const CLIENT_MINIGAME_RENDERERS: Record<
  string,
  (s: ClientApi, roundContent: RoundContent, phase: MinigamePhase) => React.JSX.Element | null
> = {
  'balance-scale': renderBalanceScaleMinigame,
  'sliding-puzzle': renderSlidingPuzzleMinigame,
  'vault-rush': renderVaultRushMinigame,
  wordle: renderWordleMinigame,
  'light-switch': renderLightSwitchMinigame,
  // Keyed by roundId so a second Bonk Air round remounts with fresh local state
  // (replay-done flag + drawn plan) instead of reusing the previous round's.
  'bonk-air': (s, roundContent, phase) => (
    <BonkAirMinigame key={roundContent.roundId} s={s} roundContent={roundContent} phase={phase} />
  ),
}

function renderMinigame(s: ClientApi, phase: MinigamePhase): React.JSX.Element | null {
  const roundContent = s.roundContent
  if (!roundContent) return null
  const render = CLIENT_MINIGAME_RENDERERS[roundContent.type]
  return render ? render(s, roundContent, phase) : null
}

// --- Screens -------------------------------------------------------------

function renderFatal(s: ClientApi): React.JSX.Element {
  return (
    <main className="app">
      <div className="game-card client-card">
        <CountdownCircle
          seconds={FATAL_COUNTDOWN_SECONDS}
          message={s.fatalError ?? ''}
          onComplete={() => {
            window.history.replaceState({}, '', '/client')
            s.clearFatalError()
          }}
        />
      </div>
    </main>
  )
}

function renderJoinFlow(s: ClientApi, banner: React.ReactNode, urlCode: string): React.JSX.Element {
  if (s.joining) {
    return (
      <main className="app">
        {banner}
        <LoadingComp />
      </main>
    )
  }
  return (
    <main className="app">
      {banner}
      <JoinScreen
        initialCode={s.creds?.roomCode || urlCode}
        error={s.joinError}
        onJoin={s.handleJoin}
      />
    </main>
  )
}

function renderLobby(s: ClientApi, banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <Waiting
        playerName={s.creds?.playerName ?? ''}
        roomCode={s.creds?.roomCode ?? ''}
        onLeave={s.handleLeaveRoom}
      />
    </main>
  )
}

function renderRoundIntro(s: ClientApi, banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <RoundIntro index={s.round?.index ?? s.roomState?.round ?? 1} total={s.round?.total ?? 0} />
    </main>
  )
}

function renderGameplay(
  s: ClientApi,
  banner: React.ReactNode,
  phase: MinigamePhase
): React.JSX.Element {
  const minigame = renderMinigame(s, phase)
  if (minigame) {
    const fullBleed = FULL_BLEED_MINIGAMES.has(s.roundContent?.type ?? '')
    return (
      <main className={fullBleed ? 'app app--minigame' : 'app'}>
        {banner}
        {minigame}
      </main>
    )
  }

  if (!s.question) {
    return (
      <main className="app">
        {banner}
        <div className="game-card client-card">
          <h2>Preparing next question…</h2>
        </div>
      </main>
    )
  }

  const myResult = s.reveal && s.playerId ? (s.reveal.playerAnswers[s.playerId] ?? null) : null
  return (
    <main className="app">
      {banner}
      <Answer
        question={s.question}
        selectedAnswerId={s.selectedAnswerId}
        phase={phase}
        result={myResult}
        correctAnswerIds={s.reveal?.correctAnswerIds ?? []}
        secondsRemaining={s.secondsRemaining}
        onAnswer={s.handleAnswer}
      />
    </main>
  )
}

function renderGameOver(s: ClientApi, banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <GameOver
        players={s.roomState?.players ?? []}
        finalScores={s.finalScores ?? {}}
        myPlayerId={s.playerId}
        onBackToMenu={s.handleLeaveRoom}
      />
    </main>
  )
}

function renderLeaderboard(s: ClientApi, banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <Leaderboard
        leaderboard={s.leaderboard}
        myPlayerId={s.playerId}
        players={s.roomState?.players ?? []}
      />
    </main>
  )
}

function renderLoading(banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <div className="game-card client-card">
        <h2>Loading…</h2>
      </div>
    </main>
  )
}

function ConnectionBanner({ s }: { s: ClientApi }): React.JSX.Element {
  const disconnected = s.status === 'closed'
  return (
    <>
      <ReconnectToast visible={disconnected && !s.kicked && !s.reconnectExhausted} />
      {disconnected && !s.kicked && s.reconnectExhausted ? (
        <div className="banner">Connection lost — reload the page to rejoin</div>
      ) : null}
    </>
  )
}

export function App(): React.JSX.Element {
  const s = useClientSocket()
  const [urlCode] = useState(readCodeFromUrl)

  useEffect(() => {
    const phase = s.roomState?.phase
    const inGame = s.joined && phase != null && phase !== 'lobby'
    document.body.classList.toggle('client-in-game', inGame)
    return () => document.body.classList.remove('client-in-game')
  }, [s.joined, s.roomState?.phase])

  const banner = <ConnectionBanner s={s} />

  if (s.fatalError) return renderFatal(s)
  if (!s.joined) return renderJoinFlow(s, banner, urlCode)

  const phase: GamePhase = s.roomState?.phase ?? 'lobby'

  if (phase === 'lobby') return renderLobby(s, banner)
  if (phase === 'round-intro') return renderRoundIntro(s, banner)
  if (phase === 'playing' || phase === 'reveal') {
    return renderGameplay(s, banner, phase === 'reveal' ? 'reveal' : 'playing')
  }
  if (phase === 'game-over' || s.finalScores !== null) return renderGameOver(s, banner)
  if (phase === 'leaderboard') return renderLeaderboard(s, banner)

  return renderLoading(banner)
}
