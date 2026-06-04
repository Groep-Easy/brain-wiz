import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import {
  BEAM_HALF_WIDTH,
  PIVOT_COLOR,
  PIVOT_X,
  PIVOT_Y,
  SVG_HEIGHT,
  SVG_WIDTH,
  angleForItems,
  getDisplayedItems,
  getSlotX,
  type PlacedItem,
} from '../shared/scaleGame.js'
import { ANSWERING_SCALE_PHASE, type Side } from '../shared/scaleGame.constants.js'
import type {
  BalanceScaleProps,
  ItemCardProps,
  ItemLayout,
  QuestionLayout,
  QuestionMarkerProps,
} from './BalanceScale.types.js'
import './BalanceScale.css'

const CARD_Y = PIVOT_Y - 84
const CARD_WIDTH = 86
const CARD_HEIGHT = 78
const CARD_RADIUS = 8
const FOOT_BASE_Y = 430
const FOOT_HALF_WIDTH = 86
const FOOT_BASE_HALF_WIDTH = 150

export function BalanceScale({
  puzzle,
  phase,
  debugPivot = false,
}: BalanceScaleProps): JSX.Element {
  const [angle, setAngle] = useState(0)
  const previousPuzzleId = useRef<string | null>(null)
  const displayedItems = useMemo(() => getDisplayedItems(puzzle, phase), [phase, puzzle])
  const itemLayouts = useMemo(
    () =>
      getItemLayouts(displayedItems, phase === ANSWERING_SCALE_PHASE ? puzzle.addTo : undefined),
    [displayedItems, phase, puzzle.addTo]
  )
  const questionLayout = useMemo(
    () =>
      getQuestionLayout(displayedItems, phase === ANSWERING_SCALE_PHASE ? puzzle.addTo : undefined),
    [displayedItems, phase, puzzle.addTo]
  )
  const targetAngle = useMemo(() => angleForItems(displayedItems), [displayedItems])

  useEffect(() => {
    const isNewPuzzle = previousPuzzleId.current !== puzzle.id
    previousPuzzleId.current = puzzle.id

    if (!isNewPuzzle) {
      setAngle(targetAngle)
      return undefined
    }

    setAngle(0)
    const animationFrame = window.requestAnimationFrame(() => {
      setAngle(angleForItems(puzzle.placed))
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
    }
  }, [puzzle.id, puzzle.placed, targetAngle])

  return (
    <div className="balance-scale">
      <svg
        aria-label="Balance scale"
        className="balance-scale__svg"
        role="img"
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
      >
        <g className="balance-scale__foot">
          <path
            className="balance-scale__fulcrum"
            d={[
              `M ${PIVOT_X} ${PIVOT_Y}`,
              `L ${PIVOT_X - FOOT_HALF_WIDTH} ${FOOT_BASE_Y}`,
              `L ${PIVOT_X + FOOT_HALF_WIDTH} ${FOOT_BASE_Y}`,
              'Z',
            ].join(' ')}
          />
          <rect
            className="balance-scale__base"
            height="18"
            rx="9"
            width={FOOT_BASE_HALF_WIDTH * 2}
            x={PIVOT_X - FOOT_BASE_HALF_WIDTH}
            y={FOOT_BASE_Y - 4}
          />
          <circle
            className="balance-scale__foot-marker"
            cx={PIVOT_X}
            cy={PIVOT_Y}
            fill={PIVOT_COLOR}
            r="8"
          />
        </g>

        <g
          className="balance-scale__rotating-group"
          style={{
            transform: `rotate(${angle}deg)`,
            transformBox: 'view-box',
            transformOrigin: `${PIVOT_X}px ${PIVOT_Y}px`,
          }}
        >
          <line
            className="balance-scale__beam"
            x1={PIVOT_X - BEAM_HALF_WIDTH}
            x2={PIVOT_X + BEAM_HALF_WIDTH}
            y1={PIVOT_Y}
            y2={PIVOT_Y}
          />
          <circle
            className="balance-scale__beam-pivot-ring"
            cx={PIVOT_X}
            cy={PIVOT_Y}
            fill="none"
            r="18"
            stroke={PIVOT_COLOR}
          />

          {itemLayouts.map((layout) => (
            <ItemCard
              angle={angle}
              item={layout.item}
              key={layout.key}
              stackOffsetX={layout.stackOffsetX}
            />
          ))}

          {questionLayout ? (
            <QuestionMarker
              angle={angle}
              side={questionLayout.side}
              slot={questionLayout.slot}
              stackOffsetX={questionLayout.stackOffsetX}
            />
          ) : null}
        </g>

        {debugPivot ? (
          <g className="balance-scale__pivot-debug" pointerEvents="none">
            <line x1={PIVOT_X - 30} x2={PIVOT_X + 30} y1={PIVOT_Y} y2={PIVOT_Y} />
            <line x1={PIVOT_X} x2={PIVOT_X} y1={PIVOT_Y - 30} y2={PIVOT_Y + 30} />
          </g>
        ) : null}
      </svg>
    </div>
  )
}

function ItemCard({ item, angle, stackOffsetX }: ItemCardProps): JSX.Element {
  const slotX = getSlotX(item.side, item.slot)

  return (
    <g className="balance-scale__item" transform={`translate(${slotX} ${CARD_Y})`}>
      <title>{`${item.label}, weight ${item.weight}`}</title>
      <line className="balance-scale__item-connector" x1="0" x2={stackOffsetX} y1="84" y2="44" />
      <g transform={`translate(${stackOffsetX} 0) rotate(${-angle})`}>
        <g
          className={
            item.isNew
              ? 'balance-scale__item-card balance-scale__item-card--new'
              : 'balance-scale__item-card'
          }
        >
          <rect
            className="balance-scale__item-card-bg"
            height={CARD_HEIGHT}
            rx={CARD_RADIUS}
            width={CARD_WIDTH}
            x={-CARD_WIDTH / 2}
            y={-CARD_HEIGHT / 2}
          />
          <text className="balance-scale__item-emoji" dominantBaseline="middle" x="0" y="-11">
            {item.emoji}
          </text>
          <text className="balance-scale__item-label" dominantBaseline="middle" x="0" y="20">
            {item.label}
          </text>
        </g>
      </g>
    </g>
  )
}

function QuestionMarker({ side, slot, angle, stackOffsetX }: QuestionMarkerProps): JSX.Element {
  const slotX = getSlotX(side, slot)

  return (
    <g className="balance-scale__question" transform={`translate(${slotX} ${CARD_Y})`}>
      <line className="balance-scale__item-connector" x1="0" x2={stackOffsetX} y1="84" y2="44" />
      <g transform={`translate(${stackOffsetX} 0) rotate(${-angle})`}>
        <rect
          className="balance-scale__question-bg"
          height={CARD_HEIGHT}
          rx={CARD_RADIUS}
          width={CARD_WIDTH}
          x={-CARD_WIDTH / 2}
          y={-CARD_HEIGHT / 2}
        />
        <text className="balance-scale__question-mark" dominantBaseline="middle" x="0" y="1">
          ?
        </text>
      </g>
    </g>
  )
}

function getItemLayouts(
  items: PlacedItem[],
  questionSlot?: { side: Side; slot: number }
): ItemLayout[] {
  const slotCounts = getSlotCounts(items, questionSlot)
  const seenSlotCounts = new Map<string, number>()

  return items.map((item, index) => {
    const slotKey = getSlotKey(item.side, item.slot)
    const occurrenceIndex = seenSlotCounts.get(slotKey) ?? 0
    seenSlotCounts.set(slotKey, occurrenceIndex + 1)

    return {
      item,
      key: `${item.id}-${item.side}-${item.slot}-${item.isNew ? 'new' : 'placed'}-${index}`,
      stackOffsetX: getStackOffsetX(occurrenceIndex, slotCounts.get(slotKey) ?? 1),
    }
  })
}

function getQuestionLayout(
  items: PlacedItem[],
  questionSlot?: { side: Side; slot: number }
): QuestionLayout | undefined {
  if (!questionSlot) {
    return undefined
  }

  const slotCounts = getSlotCounts(items, questionSlot)
  const slotKey = getSlotKey(questionSlot.side, questionSlot.slot)
  const occurrenceIndex = items.filter(
    (item) => getSlotKey(item.side, item.slot) === slotKey
  ).length

  return {
    side: questionSlot.side,
    slot: questionSlot.slot,
    stackOffsetX: getStackOffsetX(occurrenceIndex, slotCounts.get(slotKey) ?? 1),
  }
}

function getSlotCounts(
  items: PlacedItem[],
  questionSlot?: { side: Side; slot: number }
): Map<string, number> {
  const slotCounts = new Map<string, number>()

  items.forEach((item) => {
    const slotKey = getSlotKey(item.side, item.slot)
    slotCounts.set(slotKey, (slotCounts.get(slotKey) ?? 0) + 1)
  })

  if (questionSlot) {
    const questionSlotKey = getSlotKey(questionSlot.side, questionSlot.slot)
    slotCounts.set(questionSlotKey, (slotCounts.get(questionSlotKey) ?? 0) + 1)
  }

  return slotCounts
}

function getSlotKey(side: Side, slot: number): string {
  return `${side}-${slot}`
}

function getStackOffsetX(occurrenceIndex: number, totalCount: number): number {
  const stackGap = 58
  return (occurrenceIndex - (totalCount - 1) / 2) * stackGap
}
