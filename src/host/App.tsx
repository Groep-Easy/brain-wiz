import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { RoundContentPayload, RoundRevealPayload } from '@brain-wiz/shared/types/index'
import { SetupLobby } from './components/SetupLobby'
import { Question } from './screens/Question'
import { LeaderBoard } from './components/LeaderBoard'
import { RoundIntro } from './screens/RoundIntro'
import { GameOver } from './screens/GameOver'
import { RoundMinigameSurface } from '@brain-wiz/minigames/components/RoundMinigameSurface'
import { CountdownCircle } from '@brain-wiz/shared/components/CountdownCircle'

import jazzMusic from '@brain-wiz/shared/SFX/jazz.mp3'
import leaderboardMusic from '@brain-wiz/shared/SFX/leaderboard.mp3'
import vaultRushMusic from '@brain-wiz/shared/SFX/vault-rush.mp3'

import { WelcomeScreen } from './screens/WelcomeScreen'
import { MuteButton } from '@brain-wiz/shared/components/MuteButton'
import { ConfirmDialog } from '@brain-wiz/shared/components/ConfirmDialog'
import './styles/welcome.css'
import { useHostSocket } from './hooks/useHostSocket'
import type { ActiveRoom } from './App.interfaces'

export function App(): React.JSX.Element {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const hostToken = sessionStorage.getItem(`hostToken_${roomCode}`)

  const h = useHostSocket(roomCode, hostToken)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState<boolean>(false)

  const handleCloseLobby = (): void => {
    setConfirmCloseOpen(true)
  }

  const performCloseLobby = (): void => {
    setConfirmCloseOpen(false)
    h.closeConnection()
    void navigate('/')
  }

  /** Narrow the connection to a fully-ready room, or null when not connected. */
  function activeRoom(): ActiveRoom | null {
    if (!h.roomState || h.status !== 'open' || !roomCode || !hostToken) return null
    return { code: roomCode, token: hostToken, room: h.roomState }
  }

  function renderFatal(): React.JSX.Element {
    return (
      <main className="app">
        <div className="welcome-screen">
          <div className="welcome-card">
            <CountdownCircle
              seconds={5}
              message={h.fatalError ?? ''}
              onComplete={async () => navigate('/')}
            />
          </div>
        </div>
      </main>
    )
  }

  function renderLobby(active: ActiveRoom): React.JSX.Element {
    return (
      <main className="app app--lobby">
        <audio id="bg-music" loop autoPlay src={jazzMusic} preload="auto"></audio>
        <SetupLobby
          roomCode={active.code}
          hostToken={active.token}
          players={active.room.players}
          gameFlow={active.room.gameFlow ?? []}
          onStartGame={h.handleStartGame}
          onCloseLobby={handleCloseLobby}
        />
      </main>
    )
  }

  function renderRoundIntro(active: ActiveRoom): React.JSX.Element {
    return (
      <RoundIntro
        index={h.round?.index ?? active.room.round}
        total={h.round?.total ?? 0}
        questionText={h.round?.questionText}
      />
    )
  }

  function renderGameplay(active: ActiveRoom, phase: 'playing' | 'reveal'): React.JSX.Element {
    if (h.roundContent) {
      const isVaultRushPlaying = h.roundContent.type === 'vault-rush' && phase === 'playing'

      return (
        <main className="app app--minigame">
          {isVaultRushPlaying ? (
            <audio id="vault-rush-music" loop autoPlay src={vaultRushMusic} preload="auto" />
          ) : null}

          {renderMinigame(h.roundContent, h.roundReveal, phase, h.secondsRemaining)}
        </main>
      )
    }

    if (!h.question) {
      return (
        <main className="app">
          <div className="welcome-screen">
            <div className="welcome-card">
              <p>Preparing next question…</p>
            </div>
          </div>
        </main>
      )
    }

    return (
      <Question
        gameCode={active.code}
        question={h.question}
        secondsRemaining={h.secondsRemaining}
        answeredCount={h.answeredCount}
        totalPlayers={h.totalPlayers}
        reveal={phase === 'reveal' ? h.reveal : null}
      />
    )
  }

  function renderGameOver(active: ActiveRoom): React.JSX.Element {
    return (
      <GameOver
        players={active.room.players}
        finalScores={h.finalScores || {}}
        onBackToMenu={handleCloseLobby}
      />
    )
  }

  function renderLeaderboard(active: ActiveRoom): React.JSX.Element {
    return (
      <main className="app app--solid">
        <audio id="leaderboard-music" autoPlay src={leaderboardMusic} preload="auto"></audio>
        <LeaderBoard
          leaderboard={h.leaderboard}
          roadmap={h.roadmap}
          players={active.room.players}
        />
      </main>
    )
  }

  function renderPhase(): React.JSX.Element {
    if (h.fatalError) return renderFatal()

    const active = activeRoom()
    if (!active) return <WelcomeScreen />

    const phase = active.room.phase

    if (phase === 'lobby') return renderLobby(active)
    if (phase === 'round-intro') return renderRoundIntro(active)

    if (phase === 'playing' || phase === 'reveal') {
      return renderGameplay(active, phase === 'reveal' ? 'reveal' : 'playing')
    }

    if (phase === 'game-over' || h.finalScores !== null) return renderGameOver(active)
    if (phase === 'leaderboard') return renderLeaderboard(active)

    return (
      <main className="app">
        <h1>Unknown Phase: {phase}</h1>
      </main>
    )
  }

  return (
    <>
      {renderPhase()}
      {h.roomState?.phase && h.roomState.phase !== 'lobby' && <MuteButton />}
      <ConfirmDialog
        open={confirmCloseOpen}
        title="Dissolve lobby?"
        message="This will close the room and disconnect all players."
        confirmLabel="Dissolve"
        cancelLabel="Cancel"
        danger
        onConfirm={performCloseLobby}
        onCancel={() => setConfirmCloseOpen(false)}
      />
    </>
  )
}

function renderMinigame(
  content: RoundContentPayload,
  reveal: RoundRevealPayload | null,
  phase: 'playing' | 'reveal',
  secondsRemaining?: number
): React.JSX.Element {
  if (
    content.type === 'balance-scale' ||
    content.type === 'sliding-puzzle' ||
    content.type === 'vault-rush'
  ) {
    return (
      <RoundMinigameSurface
        className={`host-minigame ${
          content.type === 'balance-scale'
            ? 'host-minigame--scale'
            : content.type === 'vault-rush'
              ? 'host-minigame--vault'
              : 'host-minigame--sliding'
        }`}
        content={content}
        mode="display"
        phase={phase}
        reveal={reveal}
        {...(secondsRemaining !== undefined ? { secondsRemaining } : {})}
      />
    )
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        <p>Preparing next round...</p>
      </div>
    </div>
  )
}
