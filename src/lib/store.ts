import { useSyncExternalStore } from 'react'
import { DEFAULT_SETTINGS, newGame } from './game'
import type { GameState } from './types'

const KEY = 'simbet:v1'

/** Accepts anything shaped like a saved game, filling in settings added since it was saved. */
export function parseGame(raw: unknown): GameState | null {
  const data = raw as Partial<GameState> | null
  if (!data || data.version !== 1 || !Array.isArray(data.bets)) return null
  return {
    ...newGame(),
    ...data,
    settings: { ...DEFAULT_SETTINGS, ...data.settings, quotas: { ...DEFAULT_SETTINGS.quotas, ...data.settings?.quotas } },
  }
}

function load(): GameState {
  try {
    return parseGame(JSON.parse(localStorage.getItem(KEY) ?? 'null')) ?? newGame()
  } catch {
    return newGame()
  }
}

let state = load()
const listeners = new Set<() => void>()

function set(next: GameState, persist: boolean) {
  if (next === state) return
  state = next
  if (persist) localStorage.setItem(KEY, JSON.stringify(state))
  for (const listener of listeners) listener()
}

export const getGame = () => state

export const updateGame = (change: (state: GameState) => GameState) => set(change(state), true)

// Keep other open tabs and windows in step.
window.addEventListener('storage', (event) => {
  if (event.key === KEY) set(load(), false)
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const useGame = () => useSyncExternalStore(subscribe, getGame)
