import { useClientSocket } from './hooks/useClientSocket'

/** The full surface returned by the client socket hook. */
export type ClientApi = ReturnType<typeof useClientSocket>
export type RoundContent = NonNullable<ClientApi['roundContent']>
export type MinigamePhase = 'playing' | 'reveal'
export type AnswerResult = NonNullable<ClientApi['reveal']>['playerAnswers'][string]
