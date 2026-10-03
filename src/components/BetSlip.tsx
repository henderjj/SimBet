import { useEffect, useRef, useState } from 'react'
import { COMP } from '../lib/comps'
import { formatKickoff, formatLine, formatOdds, money } from '../lib/format'
import { balance, betError, betOn, cancelBet, placeBet } from '../lib/game'
import { updateGame } from '../lib/store'
import type { GameState, Selection, SimEvent } from '../lib/types'

const QUICK_STAKES = [5, 10, 25, 50, 100]

interface Props {
  state: GameState
  event: SimEvent
  selection: Selection
  now: number
  onClose: () => void
}

export function BetSlip({ state, event, selection, now, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const existing = betOn(state, event.id)
  const available = balance(state) + (existing?.stake ?? 0)
  const [stakeText, setStakeText] = useState(() => String(existing?.stake ?? Math.min(state.settings.defaultStake, Math.floor(available))))

  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  const stake = Number(stakeText)
  const error = betError(state, event, stake, now)
  const format = state.settings.oddsFormat

  const confirm = () => {
    updateGame((s) => placeBet(s, event, selection, stake, Date.now()))
    onClose()
  }
  const remove = () => {
    if (existing) updateGame((s) => cancelBet(s, existing.id, Date.now()))
    onClose()
  }

  return (
    <dialog
      ref={dialog}
      className="slip"
      onClose={onClose}
      onClick={(e) => e.target === dialog.current && onClose()}
      aria-label="Bet slip"
    >
      <form
        className="slip-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (!error) confirm()
        }}
      >
        <div className="slip-head">
          <div>
            <div className="eyebrow">
              {COMP[event.comp].name}
              {event.round && ` · ${event.round}`} · {formatKickoff(event.start)}
            </div>
            <div className="slip-event">{event.title}</div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="slip-pick">
          <div>
            <div className="slip-pick-label">
              {selection.label}
              {selection.line !== undefined && ` ${formatLine(selection.line)}`}
            </div>
            <div className="muted small">{selection.line !== undefined ? (event.comp === 'nfl' ? 'Point spread' : 'Goal handicap') : event.comp === 'f1q' ? 'To take pole' : 'To win'}</div>
          </div>
          <div className="slip-odds">{formatOdds(selection.odds, format)}</div>
        </div>

        <label className="field">
          <span>Stake</span>
          <div className="stake-input">
            <span>£</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="any"
              value={stakeText}
              onChange={(e) => setStakeText(e.target.value)}
              autoFocus
            />
          </div>
        </label>
        <div className="chips">
          {QUICK_STAKES.filter((s) => s <= available).map((s) => (
            <button type="button" key={s} className="chip" aria-pressed={stake === s} onClick={() => setStakeText(String(s))}>
              £{s}
            </button>
          ))}
        </div>

        <dl className="slip-sums">
          <div>
            <dt>Returns</dt>
            <dd>{money(stake > 0 ? stake * selection.odds : 0)}</dd>
          </div>
          <div>
            <dt>Profit</dt>
            <dd className="win">{money(stake > 0 ? stake * (selection.odds - 1) : 0)}</dd>
          </div>
          <div>
            <dt>Available</dt>
            <dd>{money(available)}</dd>
          </div>
        </dl>

        {error && stakeText !== '' && <p className="error">{error}</p>}

        <div className="slip-actions">
          {existing && (
            <button type="button" className="button danger" onClick={remove}>
              Remove bet
            </button>
          )}
          <button type="submit" className="button primary" disabled={!!error}>
            {existing ? 'Update bet' : 'Place bet'}
          </button>
        </div>
        <p className="muted small center">Odds lock in when you place the bet. You can change or remove it until the event starts.</p>
      </form>
    </dialog>
  )
}
