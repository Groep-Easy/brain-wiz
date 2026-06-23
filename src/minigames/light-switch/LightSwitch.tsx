import { useEffect, useState, useRef, type JSX } from 'react'
import type { Light, LightSwitch, LightSwitchGameProps } from './LightSwitch.types'
import './LightSwitch.css'

export function LightSwitchPuzzlePuzzle({ puzzle }: LightSwitchGameProps): JSX.Element {
  const boardRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = boardRef.current
    if (!el) return

    const updateSize = () => {
      setSize({
        width: el.clientWidth,
        height: el.clientHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(el)

    return () => observer.disconnect()
  }, [])

  // LIGHTS ---------------------------------------------------------------------------------------
  const [lights, setLights] = useState<Light[]>(puzzle.lights)

  function getLightPositions(lights: Light[], size: { width: number; height: number }) {
    const isPortrait = size.height > size.width
    const numberLights = lights.length
    if (isPortrait) {
      const centerY = size.height / 2
      const spacing = size.width / (numberLights + 1)

      return lights.map((light, index) => ({
        light,
        x: spacing * (index + 1),
        y: centerY,
      }))
    } else {
      const centerX = size.width / 2
      const spacing = size.height / (numberLights + 1)

      return lights.map((light, index) => ({
        light,
        x: centerX,
        y: spacing * (index + 1),
      }))
    }
  }

  const lightPositions = getLightPositions(lights, size)

  // SWITCHES -------------------------------------------------------------------------------------
  function handleSwitchClick(lightSwitch: LightSwitch): void {
    setLights((currentLights) =>
      currentLights.map((light) =>
        lightSwitch.affectedLights.includes(light.id) ? { ...light, isOn: !light.isOn } : light
      )
    )
  }

  function getSwitchPositions(switches: LightSwitch[], size: { width: number; height: number }) {
    const isPortrait = size.height > size.width
    const numberSwitches = switches.length

    const offset = 0.2
    const halfSwitches = Math.ceil(numberSwitches / 2)

    if (isPortrait) {
      const topY = size.height * offset
      const bottomY = size.height * (1 - offset)
      const spacing = size.width / (halfSwitches + 1)

      return switches.map((lightSwitch, index) => ({
        lightSwitch,
        x: spacing * (Math.floor(index / 2) + 1),
        y: index % 2 === 0 ? topY : bottomY,
      }))
    } else {
      const leftX = size.width * offset
      const rightX = size.width * (1 - offset)
      const spacing = size.height / (halfSwitches + 1)

      return switches.map((lightSwitch, index) => ({
        lightSwitch,
        x: index % 2 === 0 ? leftX : rightX,
        y: spacing * (Math.floor(index / 2) + 1),
      }))
    }
  }

  const switchPositions = getSwitchPositions(puzzle.switches, size)

  // CONNECTIONS ----------------------------------------------------------------------------------
  const lightMap = new Map(lightPositions.map(({ light, x, y }) => [light.id, { x, y }]))

  function getCurvePath(x1: number, y1: number, x2: number, y2: number) {
    const midX = (x1 + x2) / 2

    const tension = 0.6
    const dy = (y2 - y1) * tension

    const cx1 = midX
    const cy1 = y1 + dy

    const cx2 = midX
    const cy2 = y2 - dy

    return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`
  }

  return (
    <div className="light-switch-game" ref={boardRef}>
      {lightPositions.map(({ light, x, y }) => (
        <div
          key={light.id}
          className={`light ${light.isOn ? 'light--on' : ''}`}
          style={{ left: x, top: y }}
        />
      ))}

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

      <svg className="connections" viewBox={`0 0 ${size.width} ${size.height}`}>
        {switchPositions.flatMap(({ lightSwitch, x: sx, y: sy }) =>
          lightSwitch.affectedLights.map((lightId) => {
            const target = lightMap.get(lightId)
            if (!target) return null

            const d = getCurvePath(sx, sy, target.x, target.y)

            return (
              <path
                key={`${lightSwitch.id}-${lightId}`}
                d={d}
                fill="none"
                stroke="black"
                strokeWidth={2}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}
