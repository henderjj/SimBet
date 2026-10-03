import { profit, returns } from './game'
import type { Bet, GameState } from './types'

export interface Tally {
  picks: number
  pending: number
  won: number
  lost: number
  void: number
  /** Stakes on decided (won or lost) bets. */
  staked: number
  profit: number
}

export function tally(bets: Bet[]): Tally {
  const out: Tally = { picks: 0, pending: 0, won: 0, lost: 0, void: 0, staked: 0, profit: 0 }
  for (const bet of bets) {
    out[bet.status]++
    if (bet.status !== 'void') out.picks++
    if (bet.status === 'won' || bet.status === 'lost') {
      out.staked += bet.stake
      out.profit += profit(bet)
    }
  }
  return out
}

export const winRate = (t: Tally) => (t.won + t.lost ? t.won / (t.won + t.lost) : null)
export const roi = (t: Tally) => (t.staked ? t.profit / t.staked : null)

const byStart = (a: Bet, b: Bet) => a.start.localeCompare(b.start) || a.placedAt.localeCompare(b.placedAt)

/** Won and lost bets in the order their events were played. */
export const decided = (bets: Bet[]) => bets.filter((b) => b.status === 'won' || b.status === 'lost').sort(byStart)

export interface Streaks {
  /** Positive for a run of wins, negative for a run of losses. */
  current: number
  bestWins: number
}

export function streaks(bets: Bet[]): Streaks {
  let current = 0
  let bestWins = 0
  for (const bet of decided(bets)) {
    const won = bet.status === 'won'
    current = won ? Math.max(current, 0) + 1 : Math.min(current, 0) - 1
    bestWins = Math.max(bestWins, current)
  }
  return { current, bestWins }
}

/** Running profit after each decided bet, starting from zero. */
export function profitHistory(bets: Bet[]) {
  let total = 0
  return [0, ...decided(bets).map((bet) => (total += profit(bet)))]
}

export interface WeekSummary {
  week: number
  tally: Tally
  /** Picks needed for a full card; undefined for weeks nothing was ever recorded for. */
  target?: number
  full: boolean
}

/** Every week with at least one bet, newest first. */
export function weeklySummaries(state: GameState): WeekSummary[] {
  const weeks = new Map<number, Bet[]>()
  for (const bet of state.bets) weeks.set(bet.week, [...(weeks.get(bet.week) ?? []), bet])
  return [...weeks]
    .sort(([a], [b]) => b - a)
    .map(([week, bets]) => {
      const t = tally(bets)
      const target = state.weekTargets[week]
      return { week, tally: t, target, full: target !== undefined && target > 0 && t.picks >= target }
    })
}

/** Consecutive full cards up to now. The current week joins the run once it's full, but doesn't break it before then. */
export function fullCardStreak(weeks: WeekSummary[], currentWeek: number) {
  const full = new Set(weeks.filter((w) => w.full).map((w) => w.week))
  let week = full.has(currentWeek) ? currentWeek : currentWeek - 1
  let run = 0
  while (full.has(week--)) run++
  return run
}

export const biggestWin = (bets: Bet[]) =>
  bets.filter((b) => b.status === 'won').reduce<Bet | null>((best, b) => (!best || returns(b) - b.stake > returns(best) - best.stake ? b : best), null)
