/**
 * @file Game.tsx
 * @owner client-squad
 * @description Sliding-puzzle minigame, served at /game. The puzzle ships as a
 * standalone bundle (assets/sliding-puzzle) that must run as a classic <script>
 * — it reads `document.currentScript.src` at load time and React/ReactDOM off
 * `window`. So we load it lazily (only on this route) via Vite `?url` assets,
 * hand it the app's bundled React, and mount it into a container ref.
 */
import * as React from 'react'
import * as ReactDOMClient from 'react-dom/client'
import puzzleStyleUrl from '../assets/sliding-puzzle/sliding-puzzle.css?url'
import puzzleScriptUrl from '../assets/sliding-puzzle/sliding-puzzle.js?url'
import puzzleImageUrl from '../assets/sliding-puzzle/images/local-test-puzzle.svg?url'

function ensurePuzzleStyle(): void {
  if (document.querySelector('link[data-sliding-puzzle]')) {
    return
  }
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = puzzleStyleUrl
  link.dataset.slidingPuzzle = 'true'
  document.head.appendChild(link)
}

function loadPuzzleScript(): Promise<void> {
  if (window.BrainWizSlidingPuzzle) {
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = puzzleScriptUrl
    script.dataset.slidingPuzzle = 'true'
    script.addEventListener('load', () => resolve())
    script.addEventListener('error', () => reject(new Error('Failed to load sliding-puzzle bundle')))
    document.body.appendChild(script)
  })
}

export function Game(): React.JSX.Element {
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    let cancelled = false
    let root: SlidingPuzzleRoot | undefined

    // The puzzle bundle expects React/ReactDOM as globals; give it ours.
    window.React = React
    window.ReactDOM = ReactDOMClient
    ensurePuzzleStyle()

    loadPuzzleScript()
      .then(() => {
        if (cancelled || !containerRef.current) {
          return
        }
        root = window.BrainWizSlidingPuzzle?.mountSlidingPuzzleGame(containerRef.current, {
          imageUrl: puzzleImageUrl,
        })
      })
      .catch((error: unknown) => {
        console.error(error)
      })

    return () => {
      cancelled = true
      root?.unmount()
    }
  }, [])

  return <div ref={containerRef} className="game" />
}
