import type { JSX } from 'react'
import { CONFIG } from '../shared/bonkAirGame.js'
import './BonkAirRules.css'

interface ScoreRule {
  icon: string
  label: string
  points: string
}

const SCORE_RULES: ScoreRule[] = [
  { icon: '🛬', label: 'Aircraft reaches its target (landed / routed)', points: `+${CONFIG.PTS_DONE}` },
  { icon: '⭐', label: 'Star collected along the way', points: `+${CONFIG.PTS_STAR}` },
  { icon: '🏆', label: 'Perfect: every aircraft arrived, no incidents', points: `+${CONFIG.PTS_PERFECT}` },
  { icon: '⏱️', label: 'Finish early (TAKE OFF): per second left', points: `+${CONFIG.EARLY_PER_SECOND} (max +${CONFIG.EARLY_MAX})` },
]

const PENALTY_RULES: ScoreRule[] = [
  { icon: '⚠️', label: 'Two aircraft too close together', points: `−${CONFIG.SEP_PENALTY}` },
  { icon: '🌩️', label: 'Flew through a storm — aircraft crashed', points: '−' },
  { icon: '🚫', label: 'Entered a no-fly zone — intercepted', points: '−' },
]

/**
 * Host-screen scoring legend for Bonk Air. Shown while players are routing their
 * aircraft so spectators understand what earns and loses points.
 */
export function BonkAirRules(): JSX.Element {
  return (
    <aside className="bonk-air-rules">
      <h2 className="bonk-air-rules__title">Sector Control — how to score</h2>
      <div className="bonk-air-rules__group bonk-air-rules__group--plus">
        <h3>Points</h3>
        <ul>
          {SCORE_RULES.map((rule) => (
            <li key={rule.label}>
              <span className="bonk-air-rules__icon">{rule.icon}</span>
              <span className="bonk-air-rules__label">{rule.label}</span>
              <span className="bonk-air-rules__points bonk-air-rules__points--plus">{rule.points}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bonk-air-rules__group bonk-air-rules__group--minus">
        <h3>Penalties</h3>
        <ul>
          {PENALTY_RULES.map((rule) => (
            <li key={rule.label}>
              <span className="bonk-air-rules__icon">{rule.icon}</span>
              <span className="bonk-air-rules__label">{rule.label}</span>
              <span className="bonk-air-rules__points bonk-air-rules__points--minus">{rule.points}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
