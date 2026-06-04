import { useRef, useState } from 'react'
import { PING } from '../../shared/events/socket-events'
import {
  buildWsUrl,
  parsePayload,
  rttNote,
  wsToHttp,
  type Direction,
  type LogEntry,
  type Status,
} from '../console/console-utils'

const DEFAULT_URL = 'ws://localhost:3000'

export function Question() {
  const [url, setUrl] = useState(DEFAULT_URL)
  const [status, setStatus] = useState<Status>('closed')
  const [log, setLog] = useState<LogEntry[]>([])
  const [eventName, setEventName] = useState<string>(PING)
  const [payload, setPayload] = useState('{}')
  const [code, setCode] = useState('')
  const [hostToken, setHostToken] = useState('')
  const socketRef = useRef<WebSocket | null>(null)
  const idRef = useRef(0)

  var gameCode = "12345"
  var theme = "Geography"
  var currentQuestion = "What is the highest building in the world?"
  var answers = ["Burj Khalifa", "Taipei 101", "One World Trade Center", "woidjiew"]
  var amountAnswers = 5
  var timer = 29

  function append(dir: Direction, text: string): void {
    idRef.current += 1
    const entry: LogEntry = {
      id: idRef.current,
      dir,
      text,
      time: new Date().toLocaleTimeString(),
    }
    setLog((prev) => [entry, ...prev])
  }

  function connect(target: string): void {
    socketRef.current?.close()
    append('info', `connecting to ${target}…`)
    setStatus('connecting')

    const socket = new WebSocket(target)
    socketRef.current = socket
    socket.onopen = (): void => {
      setStatus('open')
      append('info', 'connection open')
    }
    socket.onmessage = (event): void => {
      const raw = String(event.data)
      append('in', raw + rttNote(raw))
    }
    socket.onclose = (): void => {
      setStatus('closed')
      append('info', 'connection closed')
    }
    socket.onerror = (): void => {
      append('info', 'connection error')
    }
  }

  async function createRoom(): Promise<void> {
    try {
      const res = await fetch(`${wsToHttp(url)}/rooms`, { method: 'POST' })
      if (!res.ok) {
        append('info', `create room failed: HTTP ${res.status}`)
        return
      }
      const body = (await res.json()) as { code: string; hostToken: string }
      setCode(body.code)
      setHostToken(body.hostToken)
      append('info', `room created — code ${body.code}, hostToken ${body.hostToken}`)
    } catch (error) {
      append('info', `create room error: ${String(error)}`)
    }
  }

  function connectAsHost(): void {
    if (!code || !hostToken) {
      append('info', 'create a room first')
      return
    }
    connect(buildWsUrl(url, { role: 'host', code, hostToken }))
  }

  async function startGame(): Promise<void> {
    if (!code) {
      append('info', 'no room to start — create one first')
      return
    }
    try {
      const res = await fetch(`${wsToHttp(url)}/rooms/${code}/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ hostToken }),
      })
      if (!res.ok) {
        append('info', `start game failed: HTTP ${res.status}`)
        return
      }
      append('info', 'game started')
    } catch (error) {
      append('info', `start game error: ${String(error)}`)
    }
  }

  function getData(raw: string) {
    let rawData = JSON.parse(raw)
    append('in', raw + rttNote(raw))

    const {event, data} = rawData
    switch(event) {
      case 'roomCreated':
        setCode(data.code)
        setHostToken(data.hostToken)
        gameCode = data.gameCode
        break
      case 'theme':
        theme = data.theme
        break
      case 'question':
        currentQuestion = data.question
        break
      case 'answers':
        answers = data.answers
        break
      case 'amountAnswers':
        amountAnswers = data.amountAnswers
        break
      case 'timer':
        timer = data.timer
        break
    }
  }

  return (
    <main className="host-question-page">
      <div className="top">
        <div className="top-left"><p>Game code: {gameCode}</p></div>
        <div className="top-center">{theme} quiz</div>
        <div className="top-right">
          <button>Toggle sound</button>
          <button>Settings</button>
        </div>
      </div>
      <div className="question"><h1>{currentQuestion}</h1></div>
      <div className="image"><img></img></div>
      <div className="imageanswer"> </div>
      <div className="answers">
        <div className="answer answer1">{answers[0]}</div>
        <div className="answer answer2">{answers[1]}</div>
        <div className="answer answer3">{answers[2]}</div>
        <div className="answer answer4">{answers[3]}</div>
    </div>
      <div className="bottom">
        <p>{amountAnswers}</p>
        <p>{timer}s left!</p>
      </div>
    </main>
  )
}
