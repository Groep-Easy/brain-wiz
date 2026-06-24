const STANDARD_SIZE = 120

function faceColorFor(color: string): string {
  const hex = color.trim().replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (full.length !== 6) return 'black'
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return 'black'
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return brightness < 0.5 ? 'white' : 'black'
}

interface CharacterPreviewProps {
  color?: string
  faceId?: number
  size?: number
}

export function CharacterPreview({
  color = '#eab308',
  faceId = 0,
  size = STANDARD_SIZE,
}: CharacterPreviewProps): React.JSX.Element {
  const fc = faceColorFor(color)
  let face
  switch (faceId) {
    case 1:
      face = (
        <>
          <circle cx="45" cy="50" r="4" fill={fc} />
          <circle cx="75" cy="50" r="4" fill={fc} />

          <circle cx="60" cy="78" r="8" stroke={fc} strokeWidth="3" fill="none" />
        </>
      )
      break

    case 2:
      face = (
        <>
          <line x1="40" y1="50" x2="50" y2="50" stroke={fc} strokeWidth="3" />

          <line x1="70" y1="50" x2="80" y2="50" stroke={fc} strokeWidth="3" />

          <line x1="45" y1="78" x2="75" y2="78" stroke={fc} strokeWidth="3" />
        </>
      )
      break

    case 3:
      face = (
        <>
          <rect x="37" y="45" width="16" height="10" fill={fc} />

          <rect x="67" y="45" width="16" height="10" fill={fc} />

          <line x1="53" y1="50" x2="67" y2="50" stroke={fc} strokeWidth="2" />

          <path d="M45 75 Q60 90 75 75" stroke={fc} strokeWidth="3" fill="none" />
        </>
      )
      break

    default:
      face = (
        <>
          <circle cx="45" cy="50" r="4" fill={fc} />
          <circle cx="75" cy="50" r="4" fill={fc} />

          <path d="M45 75 Q60 90 75 75" stroke={fc} strokeWidth="3" fill="none" />
        </>
      )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }} className="character">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={size / 3} fill={color} />
        <g transform={`scale(${size / STANDARD_SIZE})`}>{face}</g>
      </svg>
    </div>
  )
}
