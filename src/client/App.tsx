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
import type { AnswerResult, ClientApi, MinigamePhase, RoundContent } from './App.types'

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
function isBonkFlushWindow(
  phase: GamePhase | undefined,
  roundSubmitted: boolean,
  secondsRemaining: number
): boolean {
  return phase === 'playing' && !roundSubmitted && secondsRemaining > 0 && secondsRemaining <= 1
}

function getBonkPoints(s: ClientApi): number {
  return s.roundReveal?.playerResults?.[s.playerId ?? '']?.pointsAwarded ?? 0
}

function BonkAirScorecardOverlay({
  phase,
  replayDone,
  points,
}: {
  phase: MinigamePhase
  replayDone: boolean
  points: number
}): React.JSX.Element | null {
  if (phase !== 'reveal' || !replayDone) return null
  return (
    <div className="bonk-air-scorecard-overlay">
      <BonkAirScorecard points={points} />
    </div>
  )
}

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

  const submitRef = useRef(s.handleRoundSubmit)
  submitRef.current = s.handleRoundSubmit

  const roomPhase = s.roomState?.phase
  const { roundSubmitted, secondsRemaining } = s
  useEffect(() => {
    if (isBonkFlushWindow(roomPhase, roundSubmitted, secondsRemaining)) {
      submitRef.current(bonkPlanRef.current ?? { solution: {} })
    }
  }, [secondsRemaining, roundSubmitted, roomPhase])

  const puzzle = roundContent.publicState as BonkAirPuzzle
  const points = getBonkPoints(s)

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
      <BonkAirScorecardOverlay phase={phase} replayDone={bonkReplayDone} points={points} />
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
  'bonk-air': (s, roundContent, phase) => (
    <BonkAirMinigame s={s} roundContent={roundContent} phase={phase} />
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

function renderMinigameShell(
  s: ClientApi,
  banner: React.ReactNode,
  minigame: React.JSX.Element
): React.JSX.Element {
  const fullBleed = FULL_BLEED_MINIGAMES.has(s.roundContent?.type ?? '')
  return (
    <main className={fullBleed ? 'app app--minigame' : 'app'}>
      {banner}
      {minigame}
    </main>
  )
}

function renderPreparingQuestion(banner: React.ReactNode): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <div className="game-card client-card">
        <h2>Preparing next question…</h2>
      </div>
    </main>
  )
}

function getMyAnswerResult(s: ClientApi): AnswerResult | null {
  if (!s.reveal || !s.playerId) return null
  return s.reveal.playerAnswers[s.playerId] ?? null
}

function renderAnswerScreen(
  s: ClientApi,
  banner: React.ReactNode,
  phase: MinigamePhase,
  question: NonNullable<ClientApi['question']>
): React.JSX.Element {
  return (
    <main className="app">
      {banner}
      <Answer
        question={question}
        selectedAnswerId={s.selectedAnswerId}
        phase={phase}
        result={getMyAnswerResult(s)}
        correctAnswerIds={s.reveal?.correctAnswerIds ?? []}
        secondsRemaining={s.secondsRemaining}
        onAnswer={s.handleAnswer}
      />
    </main>
  )
}

function renderGameplay(
  s: ClientApi,
  banner: React.ReactNode,
  phase: MinigamePhase
): React.JSX.Element {
  const minigame = renderMinigame(s, phase)
  if (minigame) return renderMinigameShell(s, banner, minigame)
  if (!s.question) return renderPreparingQuestion(banner)
  return renderAnswerScreen(s, banner, phase, s.question)
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

function renderJoinedPhase(
  s: ClientApi,
  banner: React.ReactNode,
  phase: GamePhase
): React.JSX.Element {
  if (phase === 'lobby') return renderLobby(s, banner)
  if (phase === 'round-intro') return renderRoundIntro(s, banner)
  if (phase === 'playing' || phase === 'reveal') {
    return renderGameplay(s, banner, phase === 'reveal' ? 'reveal' : 'playing')
  }
  if (phase === 'game-over' || s.finalScores !== null) return renderGameOver(s, banner)
  if (phase === 'leaderboard') return renderLeaderboard(s, banner)
  return renderLoading(banner)
}

function renderApp(s: ClientApi, banner: React.ReactNode, urlCode: string): React.JSX.Element {
  if (s.fatalError) return renderFatal(s)
  if (!s.joined) return renderJoinFlow(s, banner, urlCode)
  const phase: GamePhase = s.roomState?.phase ?? 'lobby'
  return renderJoinedPhase(s, banner, phase)
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
  return renderApp(s, banner, urlCode)
}
