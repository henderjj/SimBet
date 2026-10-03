import { useEffect, useState } from 'react'
import { BetsIcon, Logo, PicksIcon, SettingsIcon, StatsIcon } from './components/icons'
import { money, signedMoney } from './lib/format'
import { balance, profit, settleBets, syncWeekTargets } from './lib/game'
import { useFeed, useNow } from './lib/hooks'
import { getGame, updateGame, useGame } from './lib/store'
import { Bets } from './views/Bets'
import { Picks } from './views/Picks'
import { Settings } from './views/Settings'
import { Stats } from './views/Stats'

const TABS = [
  { id: 'picks', label: 'Picks', icon: <PicksIcon /> },
  { id: 'bets', label: 'My bets', icon: <BetsIcon /> },
  { id: 'stats', label: 'Stats', icon: <StatsIcon /> },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
] as const

type Tab = (typeof TABS)[number]['id']

export function App() {
  const state = useGame()
  const { feed, error, reload } = useFeed()
  const now = useNow()
  const [tab, setTab] = useState<Tab>('picks')
  const [notice, setNotice] = useState<string | null>(null)

  // Each fresh feed may carry results for pending bets.
  useEffect(() => {
    if (!feed) return
    const before = new Set(getGame().bets.filter((b) => b.status === 'pending').map((b) => b.id))
    updateGame((s) => syncWeekTargets(settleBets(s, feed, Date.now()), feed, Date.now()))
    const settled = getGame().bets.filter((b) => b.status !== 'pending' && before.has(b.id))
    if (settled.length) {
      const total = settled.reduce((sum, b) => sum + profit(b), 0)
      setNotice(`${settled.length} bet${settled.length > 1 ? 's' : ''} settled: ${signedMoney(total)}`)
    }
  }, [feed])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])

  const pending = state.bets.filter((b) => b.status === 'pending').length

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <Logo />
          <span>SimBet</span>
        </div>
        <div className="balance">
          <span>Balance</span>
          <strong>{money(balance(state))}</strong>
        </div>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.icon}
            <span>{t.label}</span>
            {t.id === 'bets' && pending > 0 && <span className="tab-count">{pending}</span>}
          </button>
        ))}
      </nav>

      <main className="view">
        {tab === 'picks' && <Picks state={state} feed={feed} feedError={error} now={now} />}
        {tab === 'bets' && <Bets state={state} now={now} />}
        {tab === 'stats' && <Stats state={state} now={now} />}
        {tab === 'settings' && <Settings state={state} feed={feed} feedError={error} now={now} onReload={reload} />}
      </main>

      {notice && (
        <button className="toast" role="status" onClick={() => setNotice(null)}>
          {notice}
        </button>
      )}
    </div>
  )
}
