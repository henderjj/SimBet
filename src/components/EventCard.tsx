import { useState } from 'react'
import { formatKickoff, formatLine, formatOdds, money, signedMoney } from '../lib/format'
import { isOpen, profit } from '../lib/game'
import type { Bet, OddsFormat, Selection, SimEvent } from '../lib/types'

const DRIVERS_SHOWN = 8

interface Props {
  event: SimEvent
  bet?: Bet
  /** Which market to show when the event offers several; defaults to the first. */
  marketId?: string
  /** The week's quota for this competition is used up and this event isn't one of the picks. */
  quotaFull: boolean
  now: number
  format: OddsFormat
  onPick: (event: SimEvent, selection: Selection) => void
}

export function BetOutcome({ bet }: { bet: Bet }) {
  if (bet.status === 'won') return <span className="badge win">Won {signedMoney(profit(bet))}</span>
  if (bet.status === 'lost') return <span className="badge loss">Lost {signedMoney(profit(bet))}</span>
  if (bet.status === 'void') return <span className="badge">Void · stake returned</span>
  return <span className="badge pending">Pending</span>
}

export function EventCard({ event, bet, marketId, quotaFull, now, format, onPick }: Props) {
  const [showAll, setShowAll] = useState(false)
  const isF1 = event.comp === 'f1q' || event.comp === 'f1r'
  const open = isOpen(event, now)
  const market = event.markets?.find((m) => m.id === marketId) ?? event.markets?.[0]
  const selections = market?.selections ?? []

  const status =
    event.status === 'final' ? (
      <span className="badge">{isF1 ? `Winner: ${event.result?.score}` : `FT ${event.result?.score}`}</span>
    ) : event.status === 'void' ? (
      <span className="badge">Postponed</span>
    ) : !open ? (
      <span className="badge live">In play</span>
    ) : null

  // Keep a picked long shot visible without making the user expand the list.
  const pickedIndex = selections.findIndex((s) => s.id === bet?.selectionId)
  const collapsed = isF1 && !showAll && selections.length > DRIVERS_SHOWN && pickedIndex < DRIVERS_SHOWN
  const visible = collapsed ? selections.slice(0, DRIVERS_SHOWN) : selections

  return (
    <article className={`card event${bet ? ' has-bet' : ''}`}>
      <div className="event-head">
        <span className="muted small">{formatKickoff(event.start)}</span>
        {status}
      </div>
      {(isF1 || !open || !selections.length) && <div className="event-title">{event.title}</div>}

      {open && selections.length > 0 && (
        <>
          <div className={`odds ${isF1 ? 'odds-grid' : `odds-${selections.length}`}`}>
            {visible.map((s) => {
              const picked = bet?.selectionId === s.id
              return (
                <button
                  key={s.id}
                  className="odd"
                  aria-pressed={picked}
                  disabled={quotaFull}
                  onClick={() => onPick(event, s)}
                >
                  <span className="odd-label">
                    {s.label}
                    {s.sub && <small>{s.sub}</small>}
                  </span>
                  {s.line !== undefined && <span className="odd-line">{formatLine(picked && bet?.line !== undefined ? bet.line : s.line)}</span>}
                  <span className="odd-price">{formatOdds(picked && bet ? bet.odds : s.odds, format)}</span>
                  {picked && bet && <span className="odd-stake">{money(bet.stake)} staked</span>}
                </button>
              )
            })}
          </div>
          {isF1 && selections.length > DRIVERS_SHOWN && pickedIndex < DRIVERS_SHOWN && (
            <button className="link" onClick={() => setShowAll(!showAll)}>
              {showAll ? 'Show fewer' : `Show all ${selections.length} drivers`}
            </button>
          )}
        </>
      )}

      {open && !selections.length && <p className="muted small">No odds yet — they usually appear a few days before the start.</p>}

      {bet && (!open || pickedIndex < 0) && (
        <div className="event-bet">
          <span>
            <strong>{bet.selectionLabel}</strong> @ {formatOdds(bet.odds, format)} · {money(bet.stake)}
          </span>
          <BetOutcome bet={bet} />
        </div>
      )}
    </article>
  )
}
