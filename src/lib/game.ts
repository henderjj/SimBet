import { COMP, COMPS } from './comps'
import { formatLine } from './format'
import type { Bet, BetStatus, Comp, Feed, GameState, Selection, Settings, SimEvent } from './types'
import { weekOf } from './weeks'

export const DEFAULT_SETTINGS: Settings = {
  quotas: { nfl: 5, epl: 3, ucl: 3, f1q: 1, f1r: 1 },
  defaultStake: 10,
  oddsFormat: 'decimal',
  startingBalance: 1000,
}

export const newGame = (settings: Settings = DEFAULT_SETTINGS): GameState => ({
  version: 1,
  settings,
  bets: [],
  topUps: [],
  weekTargets: {},
})

const round2 = (n: number) => Math.round(n * 100) / 100
const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

/** What a settled bet pays back, stake included. */
export const returns = (bet: Bet) => round2(bet.status === 'won' ? bet.stake * bet.odds : bet.status === 'void' ? bet.stake : 0)

export const profit = (bet: Bet) => (bet.status === 'pending' ? 0 : round2(returns(bet) - bet.stake))

export function balance(state: GameState) {
  const moves = state.bets.map((bet) => (bet.status === 'pending' ? -bet.stake : profit(bet)))
  return round2(state.settings.startingBalance + sum(state.topUps.map((t) => t.amount)) + sum(moves))
}

// A voided bet hands its pick back, so it doesn't count towards the week's quota.
const counts = (bet: Bet) => bet.status !== 'void'

export const betOn = (state: GameState, eventId: string) => state.bets.find((bet) => bet.eventId === eventId && counts(bet))

export const picksUsed = (state: GameState, comp: Comp, week: number) =>
  state.bets.filter((bet) => bet.comp === comp && bet.week === week && counts(bet)).length

export const isOpen = (event: SimEvent, now: number) => event.status === 'open' && now < Date.parse(event.start)

/** Why this bet can't be placed, or null if it can. Replacing an existing bet on the same event is allowed. */
export function betError(state: GameState, event: SimEvent, stake: number, now: number): string | null {
  if (!isOpen(event, now)) return 'This event has already started.'
  if (!(stake > 0)) return 'Enter a stake.'
  const existing = betOn(state, event.id)
  if (stake > balance(state) + (existing?.stake ?? 0)) return 'Not enough balance for that stake.'
  const quota = state.settings.quotas[event.comp]
  if (!existing && picksUsed(state, event.comp, weekOf(event.start)) >= quota) {
    return `You've used all ${quota} ${COMP[event.comp].name} picks this week.`
  }
  return null
}

export function placeBet(state: GameState, event: SimEvent, selection: Selection, stake: number, now: number): GameState {
  const error = betError(state, event, stake, now)
  if (error) throw new Error(error)
  const bet: Bet = {
    id: `${event.id}@${now}`,
    eventId: event.id,
    comp: event.comp,
    week: weekOf(event.start),
    eventTitle: event.title,
    round: event.round,
    start: event.start,
    selectionId: selection.id,
    selectionLabel: selection.line === undefined ? selection.label : `${selection.label} ${formatLine(selection.line)}`,
    line: selection.line,
    odds: selection.odds,
    stake: round2(stake),
    placedAt: new Date(now).toISOString(),
    status: 'pending',
  }
  return { ...state, bets: [...state.bets.filter((b) => !(b.eventId === event.id && counts(b))), bet] }
}

/** Removes a bet and refunds it. Only possible until the event starts. */
export function cancelBet(state: GameState, betId: string, now: number): GameState {
  const bet = state.bets.find((b) => b.id === betId)
  if (!bet || bet.status !== 'pending' || now >= Date.parse(bet.start)) return state
  return { ...state, bets: state.bets.filter((b) => b.id !== betId) }
}

type Result = NonNullable<SimEvent['result']>

function outcome(bet: Bet, result: Result): BetStatus {
  if (bet.line === undefined) return result.winner === null ? 'void' : result.winner === bet.selectionId ? 'won' : 'lost'
  // Spread or handicap: add the line to the backed side's score. Landing exactly on the line is a push.
  if (result.home === undefined || result.away === undefined) return 'void'
  const margin = bet.selectionId.endsWith(':home') ? result.home - result.away : result.away - result.home
  const covered = margin + bet.line
  return covered > 0 ? 'won' : covered < 0 ? 'lost' : 'void'
}

/** Settles every pending bet whose event has a result. Returns the same object if nothing changed. */
export function settleBets(state: GameState, feed: Feed, now: number): GameState {
  const events = new Map(feed.events.map((e) => [e.id, e]))
  const settledAt = new Date(now).toISOString()
  let changed = false
  const bets = state.bets.map((bet): Bet => {
    const event = bet.status === 'pending' ? events.get(bet.eventId) : undefined
    if (event?.status === 'void') {
      changed = true
      return { ...bet, status: 'void', settledAt, resultText: 'Postponed or cancelled' }
    }
    if (event?.status !== 'final' || !event.result) return bet
    changed = true
    return { ...bet, status: outcome(bet, event.result), settledAt, resultText: event.result.score }
  })
  return changed ? { ...state, bets } : state
}

export interface CompProgress {
  comp: Comp
  picked: number
  quota: number
  /** Picks needed this week: the quota, or fewer if there aren't that many events. */
  target: number
}

export function weekProgress(state: GameState, feed: Feed, week: number): CompProgress[] {
  return COMPS.map(({ id }) => {
    const available = feed.events.filter((e) => e.comp === id && e.status !== 'void' && weekOf(e.start) === week).length
    const quota = state.settings.quotas[id]
    return { comp: id, picked: picksUsed(state, id, week), quota, target: Math.min(quota, available) }
  })
}

/**
 * Records how many picks make a full card for the current and upcoming weeks.
 * Older weeks keep the target they ended with, since their events drop out of
 * the feed over time.
 */
export function syncWeekTargets(state: GameState, feed: Feed, now: number): GameState {
  const current = weekOf(now)
  const weeks = new Set(feed.events.map((e) => weekOf(e.start)).filter((week) => week >= current))
  const weekTargets = { ...state.weekTargets }
  let changed = false
  for (const week of weeks) {
    const target = sum(weekProgress(state, feed, week).map((p) => p.target))
    if (weekTargets[week] !== target) {
      weekTargets[week] = target
      changed = true
    }
  }
  return changed ? { ...state, weekTargets } : state
}
