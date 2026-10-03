export type Comp = 'nfl' | 'epl' | 'ucl' | 'f1q' | 'f1r'

export type EventStatus = 'open' | 'live' | 'final' | 'void'

export interface Selection {
  id: string
  label: string
  short?: string
  sub?: string
  /** Spread and handicap bets only: the points or goals added to this side's score. */
  line?: number
  odds: number
  source?: string
}

export interface Market {
  id: string
  name: string
  selections: Selection[]
}

/** One bettable event from the feed built by scripts/fetch-data.mjs. */
export interface SimEvent {
  id: string
  comp: Comp
  start: string
  title: string
  round?: string
  status: EventStatus
  /** Present while the event is open; empty until a price is available. The first market is the default. */
  markets?: Market[]
  source?: string
  /** Present once final. A null winner (NFL tie, unknown 90-minute score) voids result bets. */
  result?: { winner: string | null; score: string; home?: number; away?: number }
}

export interface Feed {
  generatedAt: string
  events: SimEvent[]
}

export type BetStatus = 'pending' | 'won' | 'lost' | 'void'

/** A bet keeps its own copy of the event details so it reads correctly after the event leaves the feed. */
export interface Bet {
  id: string
  eventId: string
  comp: Comp
  week: number
  eventTitle: string
  round?: string
  start: string
  selectionId: string
  selectionLabel: string
  /** Spread and handicap bets only; locked with the odds, since lines move. */
  line?: number
  odds: number
  stake: number
  placedAt: string
  status: BetStatus
  settledAt?: string
  resultText?: string
}

export type OddsFormat = 'decimal' | 'fractional' | 'american'

export interface Settings {
  quotas: Record<Comp, number>
  defaultStake: number
  oddsFormat: OddsFormat
  startingBalance: number
}

export interface GameState {
  version: 1
  settings: Settings
  bets: Bet[]
  topUps: { at: string; amount: number }[]
  /** Picks needed for a full card, per week, frozen once the week has passed. */
  weekTargets: Record<number, number>
}
