import type { ItemStack, ScaleEquation } from '../shared/scaleGame.js'
import './BalanceScale.css'

interface ScaleEquationCluesProps {
  equations: ScaleEquation[]
}

export function ScaleEquationClues({ equations }: ScaleEquationCluesProps): React.JSX.Element | null {
  if (equations.length === 0) {
    return null
  }

  return (
    <div className="balance-scale-equations" aria-label="Balance equations">
      {equations.map((equation) => (
        <div className="balance-scale-equations__equation" key={equation.id}>
          <EquationSide stacks={equation.left} />
          <span className="balance-scale-equations__equals">=</span>
          <EquationSide stacks={equation.right} />
        </div>
      ))}
    </div>
  )
}

function EquationSide({ stacks }: { stacks: ItemStack[] }): React.JSX.Element {
  return (
    <span className="balance-scale-equations__side">
      {stacks.map((stack) => (
        <span
          className="balance-scale-equations__stack"
          key={`${stack.item.id}-${stack.count}`}
        >
          <span className="balance-scale-equations__count">{formatCount(stack.count)}</span>
          <span className="balance-scale-equations__emoji">{stack.item.emoji}</span>
          <span>{pluralize(stack.item.label, stack.count)}</span>
        </span>
      ))}
    </span>
  )
}

function formatCount(count: number): string {
  return count.toString()
}

function pluralize(label: string, count: number): string {
  return count === 1 ? label : `${label}s`
}
