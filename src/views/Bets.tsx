import { useState } from 'react'
import { BetOutcome } from '../components/EventCard'
import { COMP } from '../lib/comps'
import { formatKickoff, formatOdds, money } from '../lib/format'
import { cancelBet } from '../lib/game'
import { updateGame } from '../lib/store'
import type { Bet, GameState } from '../lib/types'

interface Props {
  state: GameState
  now: number
}

export function Bets({ state, now }: Props) {
  const [filter, setFilter] = useState<'open' | 'settled'>('open')
  const open = state.bets.filter((b) => b.status === 'pending').sort((a, b) => a.start.localeCompare(b.start))
  const settled = state.bets.filter((b) => b.status !== 'pending').sort((a, b) => b.start.localeCompare(a.start))
  const bets = filter === 'open' ? open : settled
  const format = state.settings.oddsFormat

  const row = (bet: Bet) => {
    const started = now >= Date.parse(bet.start)
    return (
      <article key={bet.id} className="card bet">
        <div className="bet-main">
          <div className="eyebrow">
            {COMP[bet.comp].name}
            {bet.round && ` · ${bet.round}`} · {formatKickoff(bet.start)}
          </div>
          <div className="bet-pick">
            {bet.selectionLabel} <span className="bet-odds">@ {formatOdds(bet.odds, format)}</span>
          </div>
          <div className="muted small">
            {bet.eventTitle}
            {bet.resultText && ` · ${bet.resultText}`}
          </div>
        </div>
        <div className="bet-side">
          <BetOutcome bet={bet} />
          <div className="small">
            <span className="muted">Stake</span> {money(bet.stake)}
          </div>
          {bet.status === 'pending' && (
            <div className="small">
              <span className="muted">Returns</span> {money(bet.stake * bet.odds)}
            </div>
          )}
          {bet.status === 'pending' && !started && (
            <button className="link danger" onClick={() => updateGame((s) => cancelBet(s, bet.id, Date.now()))}>
              Remove
            </button>
          )}
        </div>
      </article>
    )
  }

  return (
    <>
      <h1>My bets</h1>
      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={filter === 'open'} onClick={() => setFilter('open')}>
          Open ({open.length})
        </button>
        <button role="tab" aria-selected={filter === 'settled'} onClick={() => setFilter('settled')}>
          Settled ({settled.length})
        </button>
      </div>
      {bets.length === 0 && (
        <p className="empty">{filter === 'open' ? 'No open bets. Make this week’s picks to get started.' : 'Nothing settled yet. Results come in shortly after each event finishes.'}</p>
      )}
      <div className="events">{bets.map(row)}</div>
    </>
  )
}
