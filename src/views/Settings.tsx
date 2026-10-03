import { useRef } from 'react'
import { COMPS } from '../lib/comps'
import { formatOdds, money, timeAgo } from '../lib/format'
import { newGame } from '../lib/game'
import { parseGame, updateGame } from '../lib/store'
import type { Feed, GameState, OddsFormat, Settings as GameSettings } from '../lib/types'

interface Props {
  state: GameState
  feed: Feed | null
  feedError: boolean
  now: number
  onReload: () => void
}

const TOP_UP = 500
const ODDS_FORMATS: OddsFormat[] = ['decimal', 'fractional', 'american']

const change = (patch: Partial<GameSettings>) => updateGame((s) => ({ ...s, settings: { ...s.settings, ...patch } }))

export function Settings({ state, feed, feedError, now, onReload }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const { settings } = state

  const exportGame = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `simbet-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importGame = async (file: File) => {
    let game: GameState | null = null
    try {
      game = parseGame(JSON.parse(await file.text()))
    } catch {
      // Not JSON; reported below.
    }
    if (!game) return alert('That file isn’t a SimBet backup.')
    const imported = game
    if (confirm(`Replace everything on this device with the backup (${imported.bets.length} bets)?`)) updateGame(() => imported)
  }

  return (
    <>
      <h1>Settings</h1>

      <section className="card">
        <h2>Picks per week</h2>
        <p className="muted small">How many bets you can place in each competition per game week (Tuesday to Monday).</p>
        {COMPS.map((c) => {
          const value = settings.quotas[c.id]
          const set = (n: number) => change({ quotas: { ...settings.quotas, [c.id]: Math.max(0, Math.min(20, n)) } })
          return (
            <div key={c.id} className="setting">
              <span>{c.name}</span>
              <div className="stepper">
                <button onClick={() => set(value - 1)} disabled={value <= 0} aria-label={`Fewer ${c.name} picks`}>
                  −
                </button>
                <output>{value}</output>
                <button onClick={() => set(value + 1)} disabled={value >= 20} aria-label={`More ${c.name} picks`}>
                  +
                </button>
              </div>
            </div>
          )
        })}
      </section>

      <section className="card">
        <h2>Betting</h2>
        <label className="setting">
          <span>Default stake</span>
          <div className="stake-input compact">
            <span>£</span>
            <input
              type="number"
              inputMode="decimal"
              min="1"
              value={settings.defaultStake}
              onChange={(e) => change({ defaultStake: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        </label>
        <div className="setting">
          <span>Odds format</span>
          <div className="segmented compact">
            {ODDS_FORMATS.map((f) => (
              <button key={f} aria-pressed={settings.oddsFormat === f} onClick={() => change({ oddsFormat: f })}>
                {formatOdds(2.5, f)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Bankroll</h2>
        <div className="setting">
          <span>
            Top up
            <small className="muted">Adds {money(TOP_UP)} of play money. Top-ups are shown in your stats.</small>
          </span>
          <button
            className="button"
            onClick={() => updateGame((s) => ({ ...s, topUps: [...s.topUps, { at: new Date().toISOString(), amount: TOP_UP }] }))}
          >
            Add {money(TOP_UP)}
          </button>
        </div>
        <div className="setting">
          <span>
            Start over
            <small className="muted">Clears every bet and resets the balance to {money(settings.startingBalance)}.</small>
          </span>
          <button
            className="button danger"
            onClick={() => confirm('Delete all bets and history on this device and start again?') && updateGame((s) => newGame(s.settings))}
          >
            Reset
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="muted small">Bets are stored on this device only. Export a backup to move them to another device or keep them safe.</p>
        <div className="row">
          <button className="button" onClick={exportGame}>
            Export
          </button>
          <button className="button" onClick={() => fileInput.current?.click()}>
            Import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importGame(file)
              e.target.value = ''
            }}
          />
        </div>
      </section>

      <section className="card">
        <h2>Odds and results</h2>
        <p className="muted small">
          {feed ? `Last updated ${timeAgo(feed.generatedAt, now)}.` : 'Not loaded yet.'}
          {feedError && ' The latest refresh failed — you may be offline.'}
        </p>
        <p className="muted small">
          NFL, Premier League and Champions League fixtures, results and DraftKings prices come from ESPN. F1 prices are taken from the Kalshi and
          Polymarket exchanges, and F1 results from the Jolpica API. Football bets, including handicaps, settle on the
          90-minute score. NFL bets include overtime; a tied moneyline bet, or a spread that lands exactly on the line, is void.
        </p>
        <button className="button" onClick={onReload}>
          Refresh now
        </button>
      </section>
    </>
  )
}
