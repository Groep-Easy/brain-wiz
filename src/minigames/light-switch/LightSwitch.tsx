import { useState, type JSX } from 'react'
import type { Light, LightSwitch, LightSwitchGameProps } from './LightSwitch.types'
import './LightSwitch.css'

export function LightSwitchPuzzle({ puzzle }: LightSwitchGameProps): JSX.Element {
  const [lights, setLights] = useState<Light[]>(puzzle.lights)

  function handleSwitchClick(lightSwitch: LightSwitch): void {
    setLights((currentLights) =>
      currentLights.map((light) =>
        lightSwitch.affectedLights.includes(light.id) ? { ...light, isOn: !light.isOn } : light
      )
    )
  }

  function getLightPositions(lights: Light[]) {
    const spacing = 100
    const startX = 350 - ((lights.length - 1) * spacing) / 2

    return lights.map((light, index) => ({
      light,
      x: startX + index * spacing,
      y: 250,
    }))
  }

  function getSwitchPositions(switches: LightSwitch[]) {
    const centerX = 350
    const centerY = 250
    const radius = 180

    return switches.map((lightSwitch, index) => {
      const angle = (Math.PI * 2 * index) / switches.length

      return {
        lightSwitch,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    })
  }

  const lightPositions = getLightPositions(lights)
  const switchPositions = getSwitchPositions(puzzle.switches)

  return (
    <div className="light-switch-game">
      <div className="light-switch-board">
        {/* LIGHTS */}
        {lightPositions.map(({ light, x, y }) => (
          <div
            key={light.id}
            className={`light ${light.isOn ? 'light--on' : ''}`}
            style={{ left: x, top: y }}
          />
        ))}

        {/* SWITCHES */}
        {switchPositions.map(({ lightSwitch, x, y }) => (
          <button
            key={lightSwitch.id}
            className="switch"
            style={{ left: x, top: y }}
            onClick={() => handleSwitchClick(lightSwitch)}
            type="button"
          >
            S{lightSwitch.id}
          </button>
        ))}
      </div>

      {/* CONNECTIONS */}
      <svg className="connections" viewBox="0 0 700 500">
        {switchPositions.flatMap(({ lightSwitch, x, y }) =>
          lightSwitch.affectedLights.map((lightId) => {
            const target = lightPositions.find((l) => l.light.id === lightId)

            if (!target) return null

            return (
              <line
                key={`${lightSwitch.id}-${lightId}`}
                x1={x}
                y1={y}
                x2={target.x}
                y2={target.y}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}
