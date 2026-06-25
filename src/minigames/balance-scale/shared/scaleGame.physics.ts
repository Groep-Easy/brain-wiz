/**
 * @file scaleGame.physics.ts
 * @description Pure torque/balance math and on-screen geometry for the balance
 * scale. No sockets, database, browser APIs, or asset loading.
 */
import {
  DEGREES_PER_TORQUE,
  LEFT_SIDE,
  LEFT_SIDE_SIGN,
  MAX_VISUAL_ANGLE,
  MIN_VISUAL_ANGLE,
  PIVOT_X,
  RIGHT_SIDE_SIGN,
  SLOT_SIZE,
  WEIGHT_MATCH_EPSILON,
  type Side,
  type SideSign,
} from './scaleGame.constants.js'
import type { ItemOption, PlacedItem, ScaleSlotPosition } from './scaleGame.types.js'

export function sideSign(side: Side): SideSign {
  return side === LEFT_SIDE ? LEFT_SIDE_SIGN : RIGHT_SIDE_SIGN
}

export function torqueOf(item: PlacedItem): number {
  return sideSign(item.side) * item.slot * item.weight
}

export function totalTorque(items: PlacedItem[]): number {
  return items.reduce((sum, item) => sum + torqueOf(item), 0)
}

export function neededTorqueForBalance(items: PlacedItem[]): number {
  return -totalTorque(items)
}

export function requiredWeightForBalance(
  items: PlacedItem[],
  addTo: ScaleSlotPosition
): number | undefined {
  const torquePerWeight = sideSign(addTo.side) * addTo.slot
  if (torquePerWeight === 0) {
    return undefined
  }

  const requiredWeight = neededTorqueForBalance(items) / torquePerWeight
  return requiredWeight > 0 ? requiredWeight : undefined
}

export function getBalancingOptions(
  options: ItemOption[],
  items: PlacedItem[],
  addTo: ScaleSlotPosition
): ItemOption[] {
  const requiredWeight = requiredWeightForBalance(items, addTo)
  if (requiredWeight === undefined) {
    return []
  }

  return options.filter(
    (option) => Math.abs(option.weight - requiredWeight) <= WEIGHT_MATCH_EPSILON
  )
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function angleForItems(items: PlacedItem[]): number {
  return clamp(totalTorque(items) * DEGREES_PER_TORQUE, MIN_VISUAL_ANGLE, MAX_VISUAL_ANGLE)
}

export function getSlotX(side: Side, slot: number): number {
  return PIVOT_X + sideSign(side) * slot * SLOT_SIZE
}
