import { describe, expect, it } from 'vitest'
import { formatOdds } from './format'
import { balance, betError, cancelBet, newGame, picksUsed, placeBet, settleBets, syncWeekTargets, weekProgress } from './game'
import { fullCardStreak, streaks, tally, weeklySummaries } from './stats'
import type { Comp, Feed, GameState, SimEvent } from './types'
import { weekOf, weekStart } from './weeks'

const HOUR = 36e5
// A Saturday afternoon, mid game week.
const NOW = Date.UTC(2026, 9, 3, 15)

function match(n: number, comp: Comp = 'epl', hoursAhead = 24): SimEvent {
  return {
    id: `${comp}:${n}`,
    comp,
    start: new Date(NOW + hoursAhead * HOUR).toISOString(),
    title: `Home ${n} v Away ${n}`,
    status: 'open',
    markets: [
      {
        id: 'result',
        name: 'Result',
        selections: [
          { id: 'home', label: `Home ${n}`, odds: 2.5 },
          { id: 'draw', label: 'Draw', odds: 3.4 },
          { id: 'away', label: `Away ${n}`, odds: 2.9 },
        ],
      },
    ],
  }
}

/** An NFL game where the home side is favoured by `points`. */
function nflGame(n: number, points: number): SimEvent {
  return {
    ...match(n, 'nfl'),
    markets: [
      {
        id: 'spread',
        name: 'Spread',
        selections: [
          { id: 'spread:away', label: `Away ${n}`, line: points, odds: 1.91 },
          { id: 'spread:home', label: `Home ${n}`, line: -points, odds: 1.91 },
        ],
      },
    ],
  }
}

const pick = (state: GameState, event: SimEvent, selection = 0, stake = 10) => placeBet(state, event, event.markets![0].selections[selection], stake, NOW)

const finished = (event: SimEvent, winner: string | null): SimEvent => ({ ...event, status: 'final', markets: undefined, result: { winner, score: '2–1' } })

const feedOf = (...events: SimEvent[]): Feed => ({ generatedAt: new Date(NOW).toISOString(), events })

describe('weeks', () => {
  it('start on Tuesday at 10:00 UTC', () => {
    const start = new Date(weekStart(weekOf(NOW)))
    expect(start.getUTCDay()).toBe(2)
    expect(start.getUTCHours()).toBe(10)
  })

  it('keep Monday Night Football with the Sunday games before it', () => {
    const sunday = Date.UTC(2026, 9, 4, 17)
    const mondayNight = Date.UTC(2026, 9, 6, 0, 15)
    const nextThursday = Date.UTC(2026, 9, 9, 0, 15)
    expect(weekOf(mondayNight)).toBe(weekOf(sunday))
    expect(weekOf(nextThursday)).toBe(weekOf(sunday) + 1)
  })
})

describe('placing bets', () => {
  it('takes the stake out of the balance until the bet settles', () => {
    const state = pick(newGame(), match(1), 0, 25)
    expect(balance(state)).toBe(975)
    expect(state.bets[0]).toMatchObject({ selectionId: 'home', odds: 2.5, stake: 25, status: 'pending' })
  })

  it('replaces an earlier bet on the same event instead of adding a second', () => {
    const event = match(1)
    const state = pick(pick(newGame(), event, 0, 25), event, 2, 40)
    expect(state.bets).toHaveLength(1)
    expect(state.bets[0]).toMatchObject({ selectionId: 'away', stake: 40 })
    expect(balance(state)).toBe(960)
  })

  it('enforces the weekly quota per competition', () => {
    let state = newGame()
    for (const n of [1, 2, 3]) state = pick(state, match(n))
    expect(betError(state, match(4), 10, NOW)).toMatch(/all 3 Premier League picks/)
    expect(betError(state, match(4, 'ucl'), 10, NOW)).toBeNull()
    // Changing an existing pick is still allowed once the card is full.
    expect(betError(state, match(2), 10, NOW)).toBeNull()
    // The quota is per week.
    expect(betError(state, match(5, 'epl', 24 * 7), 10, NOW)).toBeNull()
  })

  it('rejects stakes that are empty or more than the balance', () => {
    expect(betError(newGame(), match(1), 0, NOW)).toBe('Enter a stake.')
    expect(betError(newGame(), match(1), 1000.01, NOW)).toMatch(/Not enough balance/)
    expect(betError(newGame(), match(1), 1000, NOW)).toBeNull()
  })

  it('locks at kick-off', () => {
    const event = match(1, 'epl', 1)
    const afterKickOff = NOW + 2 * HOUR
    expect(betError(newGame(), event, 10, afterKickOff)).toMatch(/already started/)
    const state = pick(newGame(), event)
    expect(cancelBet(state, state.bets[0].id, afterKickOff)).toBe(state)
    expect(cancelBet(state, state.bets[0].id, NOW).bets).toHaveLength(0)
  })
})

describe('settling', () => {
  it('pays winners at the odds they were placed at', () => {
    const event = match(1)
    const state = settleBets(pick(newGame(), event, 0, 20), feedOf(finished(event, 'home')), NOW)
    expect(state.bets[0]).toMatchObject({ status: 'won', resultText: '2–1' })
    expect(balance(state)).toBe(1030)
  })

  it('keeps the stake on a losing bet', () => {
    const event = match(1)
    const state = settleBets(pick(newGame(), event, 0, 20), feedOf(finished(event, 'draw')), NOW)
    expect(state.bets[0].status).toBe('lost')
    expect(balance(state)).toBe(980)
  })

  it('voids bets when there is no winner or the event is postponed, and hands the pick back', () => {
    const tie = match(1, 'nfl')
    const postponed = match(2, 'nfl')
    let state = pick(pick(newGame(), tie), postponed)
    state = settleBets(state, feedOf(finished(tie, null), { ...postponed, status: 'void' }), NOW)
    expect(state.bets.map((b) => b.status)).toEqual(['void', 'void'])
    expect(balance(state)).toBe(1000)
    expect(picksUsed(state, 'nfl', weekOf(tie.start))).toBe(0)
  })

  it('leaves bets alone while the event is unfinished or missing from the feed', () => {
    const event = match(1)
    const state = pick(newGame(), event)
    expect(settleBets(state, feedOf({ ...event, status: 'live' }), NOW)).toBe(state)
    expect(settleBets(state, feedOf(), NOW)).toBe(state)
  })
})

describe('spread bets', () => {
  const final = (event: SimEvent, home: number, away: number): SimEvent => ({
    ...event,
    status: 'final',
    markets: undefined,
    result: { winner: home > away ? 'home' : home < away ? 'away' : null, score: `${away}–${home}`, home, away },
  })
  const AWAY = 0
  const HOME = 1
  const settled = (event: SimEvent, side: number, home: number, away: number) =>
    settleBets(pick(newGame(), event, side), feedOf(final(event, home, away)), NOW).bets[0]

  it('win when the favourite covers the line', () => {
    expect(settled(nflGame(1, 4.5), HOME, 27, 20)).toMatchObject({ status: 'won', selectionLabel: 'Home 1 −4.5', line: -4.5 })
    expect(settled(nflGame(1, 4.5), AWAY, 27, 20).status).toBe('lost')
  })

  it('go to the underdog when the favourite wins by less than the line', () => {
    expect(settled(nflGame(1, 4.5), HOME, 24, 21).status).toBe('lost')
    expect(settled(nflGame(1, 4.5), AWAY, 24, 21)).toMatchObject({ status: 'won', selectionLabel: 'Away 1 +4.5' })
  })

  it('are void when the margin lands exactly on the line', () => {
    expect(settled(nflGame(1, 3), HOME, 23, 20).status).toBe('void')
    expect(settled(nflGame(1, 3), AWAY, 23, 20).status).toBe('void')
  })

  it('still pay out on a tied game, which would void a moneyline bet', () => {
    expect(settled(nflGame(1, 4.5), AWAY, 20, 20).status).toBe('won')
    expect(settled(nflGame(1, 4.5), HOME, 20, 20).status).toBe('lost')
  })

  it('settle on the line the bet was placed at, not where it moved to', () => {
    const opened = nflGame(1, 2.5)
    const state = pick(newGame(), opened, HOME)
    // The line has since moved to 4.5, but the bet was struck at −2.5.
    const result = settleBets(state, feedOf(final(nflGame(1, 4.5), 24, 21)), NOW)
    expect(result.bets[0].status).toBe('won')
  })
})

describe('goal handicaps', () => {
  const handicap = (line: number): SimEvent => ({
    ...match(1),
    markets: [
      {
        id: 'spread',
        name: 'Handicap',
        selections: [
          { id: 'spread:home', label: 'Home 1', line, odds: 2.05 },
          { id: 'spread:away', label: 'Away 1', line: -line, odds: 1.65 },
        ],
      },
    ],
  })
  const settled = (event: SimEvent, side: number, home: number, away: number) => {
    const final: SimEvent = { ...event, status: 'final', markets: undefined, result: { winner: null, score: `${home}–${away}`, home, away } }
    return settleBets(pick(newGame(), event, side), feedOf(final), NOW).bets[0].status
  }
  const HOME = 0
  const AWAY = 1

  it('need a favourite on −1.5 to win by two', () => {
    expect(settled(handicap(-1.5), HOME, 2, 0)).toBe('won')
    expect(settled(handicap(-1.5), HOME, 2, 1)).toBe('lost')
    expect(settled(handicap(-1.5), AWAY, 2, 1)).toBe('won')
  })

  it('treat a draw as a win for the side given +0.5', () => {
    expect(settled(handicap(0.5), HOME, 1, 1)).toBe('won')
    expect(settled(handicap(0.5), AWAY, 1, 1)).toBe('lost')
  })

  it('are void when the 90-minute score is unknown', () => {
    const event = handicap(-0.5)
    const final: SimEvent = { ...event, status: 'final', markets: undefined, result: { winner: null, score: 'Regulation score unavailable' } }
    expect(settleBets(pick(newGame(), event, HOME), feedOf(final), NOW).bets[0].status).toBe('void')
  })
})

describe('weekly card', () => {
  it('targets the quota, or every event when there are fewer', () => {
    const feed = feedOf(match(1), match(2), match(3), match(4), match(5, 'f1r'))
    const progress = weekProgress(pick(newGame(), match(1)), feed, weekOf(NOW))
    expect(progress.find((p) => p.comp === 'epl')).toMatchObject({ picked: 1, target: 3 })
    expect(progress.find((p) => p.comp === 'f1r')).toMatchObject({ picked: 0, target: 1 })
    expect(progress.find((p) => p.comp === 'nfl')).toMatchObject({ target: 0 })
  })

  it('counts a week as full once every target is met, and builds a streak from full weeks', () => {
    const lastWeek = [match(1, 'epl', -24 * 7), match(2, 'f1r', -24 * 7)]
    const thisWeek = [match(3), match(4, 'f1r')]
    const week = weekOf(NOW)

    // Last week's card was filled before those events started.
    const then = NOW - 8 * 24 * HOUR
    let state = newGame()
    for (const e of lastWeek) state = placeBet(state, e, e.markets![0].selections[0], 10, then)
    state = syncWeekTargets(state, feedOf(...lastWeek), then)
    expect(state.weekTargets[week - 1]).toBe(2)

    state = pick(state, thisWeek[0])
    state = syncWeekTargets(state, feedOf(...lastWeek.map((e) => finished(e, 'home')), ...thisWeek), NOW)
    // Past weeks keep the target they ended with.
    expect(state.weekTargets).toMatchObject({ [week - 1]: 2, [week]: 2 })

    const partial = weeklySummaries(state)
    expect(partial.map((w) => w.full)).toEqual([false, true])
    expect(fullCardStreak(partial, week)).toBe(1)

    state = pick(state, thisWeek[1])
    expect(fullCardStreak(weeklySummaries(state), week)).toBe(2)
  })
})

describe('stats', () => {
  it('tallies results and tracks streaks in the order events were played', () => {
    const events = [match(1, 'epl', 1), match(2, 'epl', 2), match(3, 'epl', 3), match(4, 'nfl', 4)]
    let state = newGame()
    for (const e of events) state = pick(state, e, 0, 10)
    state = settleBets(state, feedOf(finished(events[0], 'away'), finished(events[1], 'home'), finished(events[2], 'home'), finished(events[3], null)), NOW)

    expect(tally(state.bets)).toMatchObject({ picks: 3, won: 2, lost: 1, void: 1, staked: 30, profit: 20 })
    expect(streaks(state.bets)).toEqual({ current: 2, bestWins: 2 })
  })
})

describe('odds formats', () => {
  it.each([
    [2.5, '2.50', '6/4', '+150'],
    [1.5, '1.50', '1/2', '−200'],
    [2, '2.00', 'Evens', '+100'],
    [2.38, '2.38', '11/8', '+138'],
    [101, '101.00', '100/1', '+10000'],
  ])('%f', (decimal, dec, frac, us) => {
    expect(formatOdds(decimal, 'decimal')).toBe(dec)
    expect(formatOdds(decimal, 'fractional')).toBe(frac)
    expect(formatOdds(decimal, 'american')).toBe(us)
  })
})
