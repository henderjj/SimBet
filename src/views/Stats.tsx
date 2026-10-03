import { COMPS } from '../lib/comps'
import { formatOdds, money, percent, signedMoney } from '../lib/format'
import { balance, profit } from '../lib/game'
import { biggestWin, fullCardStreak, profitHistory, roi, streaks, tally, weeklySummaries, winRate } from '../lib/stats'
import type { Tally } from '../lib/stats'
import type { GameState } from '../lib/types'
import { weekLabel, weekOf } from '../lib/weeks'

interface Props {
  state: GameState
  now: number
}

const tone = (n: number) => (n > 0 ? 'win' : n < 0 ? 'loss' : '')
const record = (t: Tally) => `${t.won}–${t.lost}`
const rate = (t: Tally) => {
  const r = winRate(t)
  return r === null ? '—' : `${Math.round(r * 100)}%`
}

function Sparkline({ values }: { values: number[] }) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (i: number) => (i / (values.length - 1)) * 100
  const y = (v: number) => 38 - ((v - min) / span) * 36
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ')
  return (
    <svg className={`spark ${tone(values.at(-1)!)}`} viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Profit over time">
      <line x1="0" x2="100" y1={y(0)} y2={y(0)} className="spark-zero" />
      <path d={line} />
    </svg>
  )
}

export function Stats({ state, now }: Props) {
  const all = tally(state.bets)
  const run = streaks(state.bets)
  const weeks = weeklySummaries(state)
  const history = profitHistory(state.bets)
  const best = biggestWin(state.bets)
  const overallRoi = roi(all)
  const topUps = state.topUps.reduce((sum, t) => sum + t.amount, 0)
  const format = state.settings.oddsFormat

  return (
    <>
      <h1>Stats</h1>
      <div className="tiles">
        <div className="card tile">
          <span>Balance</span>
          <strong>{money(balance(state))}</strong>
          <small>
            Started with {money(state.settings.startingBalance)}
            {topUps > 0 && ` + ${money(topUps)} topped up`}
          </small>
        </div>
        <div className="card tile">
          <span>Profit / loss</span>
          <strong className={tone(all.profit)}>{signedMoney(all.profit)}</strong>
          <small>{overallRoi === null ? 'No settled bets yet' : `${percent(overallRoi)} return on stakes`}</small>
        </div>
        <div className="card tile">
          <span>Record</span>
          <strong>{record(all)}</strong>
          <small>
            {rate(all)} won{all.void > 0 && ` · ${all.void} void`}
            {all.pending > 0 && ` · ${all.pending} pending`}
          </small>
        </div>
        <div className="card tile">
          <span>Current streak</span>
          <strong className={tone(run.current)}>{run.current === 0 ? '—' : `${Math.abs(run.current)} ${run.current > 0 ? 'won' : 'lost'}`}</strong>
          <small>Best winning run: {run.bestWins}</small>
        </div>
        <div className="card tile">
          <span>Full-card streak</span>
          <strong>{fullCardStreak(weeks, weekOf(now))} wk</strong>
          <small>Weeks in a row with every pick made</small>
        </div>
        <div className="card tile">
          <span>Biggest win</span>
          <strong className={best ? 'win' : ''}>{best ? signedMoney(profit(best)) : '—'}</strong>
          <small>{best ? `${best.selectionLabel} @ ${formatOdds(best.odds, format)}` : 'Still to come'}</small>
        </div>
      </div>

      {history.length > 2 && (
        <section className="card">
          <h2>Profit over time</h2>
          <Sparkline values={history} />
        </section>
      )}

      <section className="card">
        <h2>By competition</h2>
        <table>
          <thead>
            <tr>
              <th>Competition</th>
              <th>W–L</th>
              <th>Won</th>
              <th>P/L</th>
            </tr>
          </thead>
          <tbody>
            {COMPS.map((c) => {
              const t = tally(state.bets.filter((b) => b.comp === c.id))
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{record(t)}</td>
                  <td>{rate(t)}</td>
                  <td className={tone(t.profit)}>{signedMoney(t.profit)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Week by week</h2>
        {weeks.length === 0 ? (
          <p className="muted small">Your weekly results will build up here.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Picks</th>
                <th>W–L</th>
                <th>P/L</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((w) => (
                <tr key={w.week}>
                  <td>{weekLabel(w.week)}</td>
                  <td>
                    {w.tally.picks}
                    {w.target !== undefined && `/${w.target}`}
                    {w.full && <span className="win"> ✓</span>}
                  </td>
                  <td>{record(w.tally)}</td>
                  <td className={tone(w.tally.profit)}>{signedMoney(w.tally.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}
