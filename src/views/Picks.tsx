import { useState } from 'react'
import { BetSlip } from '../components/BetSlip'
import { EventCard } from '../components/EventCard'
import { COMP, COMPS, GROUPS } from '../lib/comps'
import { betOn, weekProgress } from '../lib/game'
import type { Feed, GameState, Selection, SimEvent } from '../lib/types'
import { weekLabel, weekOf } from '../lib/weeks'

interface Props {
  state: GameState
  feed: Feed | null
  feedError: boolean
  now: number
}

const weekName = (week: number, current: number) =>
  week === current ? 'This week' : week === current + 1 ? 'Next week' : week === current - 1 ? 'Last week' : weekLabel(week)

export function Picks({ state, feed, feedError, now }: Props) {
  const current = weekOf(now)
  const [week, setWeek] = useState(current)
  const [slip, setSlip] = useState<{ event: SimEvent; selection: Selection } | null>(null)
  // The market being browsed in each group, where events offer more than one (e.g. NFL spread or moneyline).
  const [marketChoice, setMarketChoice] = useState<Record<string, string>>({})

  if (!feed) {
    return <p className="empty">{feedError ? 'Couldn’t load fixtures and odds. Check your connection and try again.' : 'Loading fixtures and odds…'}</p>
  }

  const feedWeeks = feed.events.map((e) => weekOf(e.start))
  const firstWeek = Math.min(current, ...feedWeeks)
  const lastWeek = Math.max(current, ...feedWeeks)
  const events = feed.events.filter((e) => weekOf(e.start) === week)
  const progress = weekProgress(state, feed, week)
  const picked = progress.reduce((sum, p) => sum + p.picked, 0)
  const target = progress.reduce((sum, p) => sum + p.target, 0)

  return (
    <>
      <div className="week-nav">
        <button className="icon-button" onClick={() => setWeek(week - 1)} disabled={week <= firstWeek} aria-label="Previous week">
          ‹
        </button>
        <div className="week-title">
          <h1>{weekName(week, current)}</h1>
          {weekName(week, current) !== weekLabel(week) && <span className="muted small">{weekLabel(week)}</span>}
        </div>
        <button className="icon-button" onClick={() => setWeek(week + 1)} disabled={week >= lastWeek} aria-label="Next week">
          ›
        </button>
      </div>

      <section className="card progress" aria-label="Picks this week">
        <div className="progress-head">
          <span>
            <strong>{picked}</strong> of {target} picks made
          </span>
          {target > 0 && picked >= target && <span className="badge win">Full card</span>}
        </div>
        <div className="bar">
          <div style={{ width: `${target ? Math.min(100, (picked / target) * 100) : 0}%` }} />
        </div>
        <div className="progress-comps">
          {progress.map((p) => (
            <div key={p.comp} className={`progress-comp${p.target === 0 ? ' off' : p.picked >= p.target ? ' done' : ''}`}>
              <span>{COMP[p.comp].short}</span>
              <strong>{p.target === 0 ? '—' : `${p.picked}/${p.target}`}</strong>
            </div>
          ))}
        </div>
      </section>

      {GROUPS.map((group) => {
        const comps = COMPS.filter((c) => c.group === group)
        const groupEvents = events.filter((e) => COMP[e.comp].group === group)
        const round = [...new Set(groupEvents.map((e) => e.round).filter(Boolean))].join(' / ')
        const markets = new Map(groupEvents.flatMap((e) => e.markets ?? []).map((m) => [m.id, m.name]))
        const marketId = marketChoice[group] ?? [...markets.keys()][0]
        const sources = [...new Set(groupEvents.flatMap((e) => e.source?.split(' / ') ?? []))].join(' / ')
        return (
          <section key={group} className="group">
            <div className="group-head">
              <h2>
                {group}
                {round && <span className="muted"> · {round}</span>}
              </h2>
              <div className="group-pills">
                {comps.map((c) => {
                  const p = progress.find((x) => x.comp === c.id)!
                  if (!p.target) return null
                  return (
                    <span key={c.id} className={`pill${p.picked >= p.target ? ' done' : ''}`}>
                      {comps.length > 1 && `${c.short.replace('F1 ', '')} `}
                      {p.picked}/{p.target}
                    </span>
                  )
                })}
              </div>
            </div>
            {groupEvents.length === 0 && <p className="muted small group-empty">No fixtures this week.</p>}
            {markets.size > 1 && (
              <div className="segmented compact" role="group" aria-label={`${group} bet type`}>
                {[...markets].map(([id, name]) => (
                  <button key={id} aria-pressed={marketId === id} onClick={() => setMarketChoice({ ...marketChoice, [group]: id })}>
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="events">
              {groupEvents.map((event) => {
                const active = betOn(state, event.id)
                const p = progress.find((x) => x.comp === event.comp)!
                return (
                  <EventCard
                    key={event.id}
                    event={event}
                    bet={active ?? state.bets.find((b) => b.eventId === event.id)}
                    marketId={marketId}
                    quotaFull={!active && p.picked >= p.quota}
                    now={now}
                    format={state.settings.oddsFormat}
                    onPick={(e, selection) => setSlip({ event: e, selection })}
                  />
                )
              })}
            </div>
            {sources && <p className="muted small source">Odds: {sources}</p>}
          </section>
        )
      })}

      {slip && <BetSlip state={state} event={slip.event} selection={slip.selection} now={now} onClose={() => setSlip(null)} />}
    </>
  )
}
