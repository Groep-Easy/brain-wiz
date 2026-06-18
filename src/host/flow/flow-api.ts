/**
 * @file flow-api.ts
 * @owner host-squad
 * @description HTTP client for the server-owned game flow: the building-block
 * catalog (`GET /flow/blocks`) and a room's flow (read via RoomState, written
 * via PUT/randomize). All calls degrade gracefully so the editor keeps working
 * if the backend is briefly unreachable.
 */
import { PALETTE, nextUid } from './palette'
import type { BlockDef, BlockKind, FlowItem, StoredFlowItem } from './types'

import { getBackendWsUrl, getBackendHttpUrl } from '@brain-wiz/shared/utils/env'

/** Base URL of the backend HTTP API, derived from the WS URL like App.tsx does. */
const BACKEND_HTTP_URL = getBackendHttpUrl(getBackendWsUrl(import.meta.env.VITE_WS_URL))

/** Add per-instance uids so a server flow can be edited/rendered locally. */
export function toFlowItems(items: StoredFlowItem[]): FlowItem[] {
  return items.map((it) => ({ uid: nextUid(), blockId: it.blockId, questions: it.questions }))
}

/** Strip client-only uids before sending a flow to the server. */
export function toStoredFlow(flow: FlowItem[]): StoredFlowItem[] {
  return flow.map(({ blockId, questions }) => ({ blockId, questions }))
}

/**
 * Fetch the building-block catalog the server actually offers (themes that have
 * questions + implemented mini-games). Falls back to the hardcoded PALETTE if
 * the backend is unreachable, so the editor still works offline.
 */
export async function fetchCatalog(): Promise<BlockDef[]> {
  try {
    const res = await fetch(`${BACKEND_HTTP_URL}/flow/blocks`)
    if (!res.ok) return PALETTE
    const dtos = (await res.json()) as Array<{
      id: string
      kind: BlockKind
      label: string
      icon: string
    }>
    if (!Array.isArray(dtos) || dtos.length === 0) return PALETTE
    return dtos.map((d) => ({ id: d.id, label: d.label, kind: d.kind, icon: d.icon }))
  } catch {
    return PALETTE
  }
}

/** Fetch a room's server-owned flow (via its RoomState). Returns [] on failure. */
export async function fetchRoomFlow(code: string): Promise<FlowItem[]> {
  try {
    const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${code}`)
    if (!res.ok) return []
    const state = (await res.json()) as { gameFlow?: StoredFlowItem[] }
    return toFlowItems(state.gameFlow ?? [])
  } catch {
    return []
  }
}

/** Persist a room's flow on the server. Returns true on success. */
export async function storeRoomFlow(
  code: string,
  hostToken: string,
  flow: FlowItem[]
): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${code}/flow`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostToken, flow: toStoredFlow(flow) }),
    })
    return res.ok
  } catch {
    return false
  }
}

/** Ask the server to randomize + store a room's flow. Returns the new flow. */
export async function randomizeRoomFlow(
  code: string,
  hostToken: string,
  size?: number
): Promise<FlowItem[]> {
  const res = await fetch(`${BACKEND_HTTP_URL}/rooms/${code}/flow/randomize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostToken, size }),
  })
  if (!res.ok) throw new Error(`randomize failed: ${res.status}`)
  const body = (await res.json()) as { flow: StoredFlowItem[] }
  return toFlowItems(body.flow ?? [])
}
