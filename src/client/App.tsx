import { useEffect, useState } from 'react'
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
import { useClientSocket } from './hooks/useClientSocket'

function readCodeFromUrl(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('code')?.toUpperCase() ?? ''
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

  const disconnected = s.status === 'closed'
  const banner = (
    <>
      <ReconnectToast visible={disconnected && !s.kicked && !s.reconnectExhausted} />
      {disconnected && !s.kicked && s.reconnectExhausted ? (
        <div className="banner">Connection lost — reload the page to rejoin</div>
      ) : null}
    </>
  )

  function renderMinigame(phase: 'playing' | 'reveal'): React.JSX.Element | null {
    const { roundContent, roundReveal } = s
    if (!roundContent) return null

    if (roundContent.type === 'balance-scale') {
      const solution = roundReveal?.publicSolution as { correctOptionId?: string } | undefined

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

    if (roundContent.type === 'sliding-puzzle') {
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

    if (roundContent.type === 'vault-rush') {
      const solution = roundReveal?.publicSolution as { code?: string } | undefined
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

    if (roundContent.type === 'wordle') {
      const answer = (roundContent.publicState as { answer?: string }).answer ?? ''
      return (
        <MinigameDynamicGrid
          type="wordle"
          answer={answer}
          onSubmit={s.handleRoundSubmit}
          submitted={s.roundSubmitted}
          phase={phase === 'reveal' ? 'reveal' : 'playing'}
        />
      )
    }

    return null
  }

  function renderFatal(): React.JSX.Element {
    return (
      <main className="app">
        <div className="game-card client-card">
          <CountdownCircle
            seconds={5}
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

  function renderJoinFlow(): React.JSX.Element {
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

  function renderLobby(): React.JSX.Element {
    return (
      <main className="app">
        {banner}
        <Waiting playerName={s.creds?.playerName ?? ''} roomCode={s.creds?.roomCode ?? ''} />
      </main>
    )
  }

  function renderRoundIntro(): React.JSX.Element {
    return (
      <main className="app">
        {banner}
        <RoundIntro index={s.round?.index ?? s.roomState?.round ?? 1} total={s.round?.total ?? 0} />
      </main>
    )
  }

  function renderGameplay(phase: 'playing' | 'reveal'): React.JSX.Element {
    const minigame = renderMinigame(phase)
    if (minigame) {
      const isFullBleed =
        s.roundContent?.type === 'sliding-puzzle' ||
        s.roundContent?.type === 'vault-rush' ||
        s.roundContent?.type === 'wordle'
      return (
        <main className={isFullBleed ? 'app app--minigame' : 'app'}>
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

  function renderGameOver(): React.JSX.Element {
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

  function renderLeaderboard(): React.JSX.Element {
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

  if (s.fatalError) return renderFatal()
  if (!s.joined) return renderJoinFlow()

  const phase: GamePhase = s.roomState?.phase ?? 'lobby'

  if (phase === 'lobby') return renderLobby()
  if (phase === 'round-intro') return renderRoundIntro()
  if (phase === 'playing' || phase === 'reveal') {
    return renderGameplay(phase === 'reveal' ? 'reveal' : 'playing')
  }
  if (phase === 'game-over' || s.finalScores !== null) return renderGameOver()
  if (phase === 'leaderboard') return renderLeaderboard()

  return (
    <main className="app">
      {banner}
      <div className="game-card client-card">
        <h2>Loading…</h2>
      </div>
    </main>
  )
}
