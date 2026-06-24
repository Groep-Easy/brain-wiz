/**
 * @file scaleGame.equations.ts
 * @description Builds the visual "equations" shown alongside a balance-scale
 * puzzle (how many base items equal the heavier ones).
 */
import type { ItemOption, ScaleEquation } from './scaleGame.types.js'

/**
 * One visual equation: `count` base items on the left balance the given items
 * (each used once) on the right. The id lists the right-hand item ids.
 */
function balanceEquation(baseItem: ItemOption, rightItems: ItemOption[]): ScaleEquation {
  const rightWeight = rightItems.reduce((sum, item) => sum + item.weight, 0)
  const rightIds = rightItems.map((item) => item.id).join('-')
  return {
    id: `${rightIds}-equals-${baseItem.id}`,
    left: [{ item: baseItem, count: rightWeight / baseItem.weight }],
    right: rightItems.map((item) => ({ item, count: 1 })),
  }
}

function sortByWeight(items: ItemOption[]): ItemOption[] {
  return [...items].sort((first, second) => first.weight - second.weight)
}

export function createMinimumEquations(items: ItemOption[]): ScaleEquation[] {
  const sortedItems = sortByWeight(items)
  const [baseItem] = sortedItems
  if (!baseItem) {
    return []
  }
  return sortedItems.slice(1).map((item) => balanceEquation(baseItem, [item]))
}

export function createEasyEquations(items: ItemOption[]): ScaleEquation[] {
  const [baseItem, mediumItem, heavyItem] = sortByWeight(items)
  if (!baseItem || !mediumItem || !heavyItem) {
    return createMinimumEquations(items)
  }
  return [
    balanceEquation(baseItem, [mediumItem]),
    balanceEquation(baseItem, [mediumItem, heavyItem]),
  ]
}

export function createHardEquations(items: ItemOption[]): ScaleEquation[] {
  const [baseItem, secondItem, thirdItem, fourthItem] = sortByWeight(items)
  if (!baseItem || !secondItem || !thirdItem || !fourthItem) {
    return createMinimumEquations(items)
  }
  return [
    balanceEquation(baseItem, [secondItem]),
    balanceEquation(baseItem, [secondItem, thirdItem]),
    balanceEquation(baseItem, [secondItem, thirdItem, fourthItem]),
  ]
}
