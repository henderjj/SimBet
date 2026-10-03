// Builds public/data/events.json: fixtures, odds and results for every
// competition the app offers. All sources are public and need no API key.
//
//   ESPN scoreboard   NFL / EPL / UCL fixtures, results, DraftKings moneylines
//   Jolpica (Ergast)  F1 calendar, race winners, pole sitters
//   Kalshi/Polymarket F1 race-winner and pole-position prices
import { mkdir, writeFile } from 'node:fs/promises'

const ESPN = 'https://site.api.espn.com/apis/site/v2/sports'
const JOLPICA = 'https://api.jolpi.ca/ergast/f1'
const KALSHI = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET = 'https://gamma-api.polymarket.com'
const POLYMARKET_F1_TAG = 435

const OUT_DIR = new URL('../public/data/', import.meta.url)
const DAY = 864e5
const now = Date.now()
// Results are kept long enough to settle bets on a device that hasn't been
// opened for a while; fixtures far enough ahead to cover next game week.
const windowStart = now - 60 * DAY
const windowEnd = now + 16 * DAY

async function getJson(url, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'simbet-data/1.0' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch (err) {
      if (i >= attempts) throw new Error(`${url}: ${err.message}`)
      await new Promise((r) => setTimeout(r, 1500 * i))
    }
  }
}

const inWindow = (iso) => {
  const t = Date.parse(iso)
  return t >= windowStart && t <= windowEnd
}

const round2 = (n) => Math.round(n * 100) / 100

// ---------------------------------------------------------------- ESPN ----

const LEAGUES = [
  // The spread is the standard NFL bet, so it leads; in football it sits behind the match result.
  { comp: 'nfl', path: 'football/nfl', draw: false, spread: 'Spread', spreadFirst: true },
  { comp: 'epl', path: 'soccer/eng.1', draw: true, spread: 'Handicap' },
  { comp: 'ucl', path: 'soccer/uefa.champions', draw: true, spread: 'Handicap' },
]

const VOID_STATUSES = new Set(['STATUS_POSTPONED', 'STATUS_CANCELED', 'STATUS_ABANDONED', 'STATUS_FORFEIT'])
const EXTRA_TIME_STATUSES = new Set(['STATUS_FINAL_AET', 'STATUS_FINAL_PEN'])

// American moneyline ("+170", "-298", "EVEN") → decimal odds.
function americanToDecimal(value) {
  if (value == null) return null
  if (String(value).toUpperCase().startsWith('EV')) return 2
  const n = Number(value)
  if (!Number.isFinite(n) || n === 0) return null
  return round2(n > 0 ? 1 + n / 100 : 1 + 100 / -n)
}

function moneyline(odds, side) {
  const fallback = side === 'draw' ? odds?.drawOdds?.moneyLine : odds?.[`${side}TeamOdds`]?.moneyLine
  return americanToDecimal(odds?.moneyline?.[side]?.close?.odds ?? fallback)
}

// A spread or goal-handicap line ("+4.5", "-1.5", "PK") → what is added to that side's score.
function spreadLine(value) {
  if (/^(pk|pick|ev)/i.test(String(value))) return 0
  const n = Number(value)
  return value != null && value !== '' && Number.isFinite(n) ? n : null
}

function spreadMarket(name, odds, sides, names) {
  const selections = sides.map((side) => ({
    id: `spread:${side}`,
    ...names(side),
    line: spreadLine(odds?.pointSpread?.[side]?.close?.line),
    odds: americanToDecimal(odds?.pointSpread?.[side]?.close?.odds),
  }))
  const [a, b] = selections
  // Only offer it when both sides are priced on the same line.
  const complete = selections.every((s) => s.odds && s.line !== null) && a.line === -b.line
  return { id: 'spread', name, selections: complete ? selections : [] }
}

// A 1X2 bet settles on 90 minutes, but ESPN's score for a match that went to
// extra time includes it. Rebuild the regulation score from the scoring plays,
// and give up (null → bets are voided) if they don't add up to the final score.
async function regulationScore(event, league, home, away) {
  const day = event.date.slice(0, 10).replaceAll('-', '')
  const board = await getJson(`${ESPN}/${league.path}/scoreboard?dates=${day}`)
  const details = board.events?.find((e) => e.id === event.id)?.competitions[0].details
  if (!details) return null
  const goals = details.filter((d) => d.scoringPlay && !d.shootout)
  const count = (teamId, list) => list.filter((d) => d.team?.id === teamId).length
  if (count(home.team.id, goals) !== Number(home.score) || count(away.team.id, goals) !== Number(away.score)) return null
  const regulation = goals.filter((d) => parseInt(d.clock?.displayValue, 10) <= 90)
  return [count(home.team.id, regulation), count(away.team.id, regulation)]
}

async function espnEvent(event, league) {
  const competition = event.competitions[0]
  const home = competition.competitors.find((c) => c.homeAway === 'home')
  const away = competition.competitors.find((c) => c.homeAway === 'away')
  const type = event.status.type
  const status = VOID_STATUSES.has(type.name)
    ? 'void'
    : type.state === 'pre'
      ? 'open'
      : type.completed
        ? 'final'
        : 'live'

  // Soccer reads "Home v Away"; NFL reads "Away @ Home".
  const sides = league.draw ? ['home', 'draw', 'away'] : ['away', 'home']
  const team = { home, away }
  const out = {
    id: `${league.comp}:${event.id}`,
    comp: league.comp,
    start: new Date(event.date).toISOString(),
    title: league.draw
      ? `${home.team.displayName} v ${away.team.displayName}`
      : `${away.team.displayName} @ ${home.team.displayName}`,
    status,
  }
  if (league.comp === 'nfl' && event.week?.number) {
    out.round = { 1: 'Preseason', 3: 'Playoffs' }[event.season?.type] ?? `Week ${event.week.number}`
  }

  if (status === 'open') {
    const odds = competition.odds?.[0]
    const names = (side) => ({
      label: side === 'draw' ? 'Draw' : team[side].team.displayName,
      short: side === 'draw' ? 'Draw' : team[side].team.abbreviation,
    })
    const result = sides.map((side) => ({ id: side, ...names(side), odds: moneyline(odds, side) }))
    const markets = [
      { id: 'result', name: league.draw ? 'Result' : 'Moneyline', selections: result.every((s) => s.odds) ? result : [] },
      spreadMarket(
        league.spread,
        odds,
        sides.filter((side) => side !== 'draw'),
        names,
      ),
    ]
    // The first market listed is the one the app shows by default.
    if (league.spreadFirst) markets.reverse()
    out.markets = markets.filter((market) => market.selections.length)
    if (out.markets.length) out.source = odds.provider?.name
  }

  if (status === 'final') {
    let score = [Number(home.score), Number(away.score)]
    let note
    if (EXTRA_TIME_STATUSES.has(type.name)) {
      score = await regulationScore(event, league, home, away)
      note = '90 mins'
    }
    if (!score) {
      out.result = { winner: null, score: 'Regulation score unavailable' }
    } else {
      const [h, a] = score
      const winner = h > a ? 'home' : h < a ? 'away' : league.draw ? 'draw' : null
      const text = league.draw ? `${h}–${a}` : `${a}–${h}`
      out.result = { winner, score: note ? `${text} (${note})` : text, home: h, away: a }
    }
  }
  return out
}

async function fetchLeague(league) {
  // The scoreboard rejects arbitrary date ranges but accepts a whole year.
  const years = new Set([new Date(windowStart).getUTCFullYear(), new Date(windowEnd).getUTCFullYear()])
  const events = new Map()
  for (const year of years) {
    const board = await getJson(`${ESPN}/${league.path}/scoreboard?dates=${year}&limit=1000`)
    for (const e of board.events ?? []) if (inWindow(e.date)) events.set(e.id, e)
  }
  return Promise.all([...events.values()].map((e) => espnEvent(e, league)))
}

// ------------------------------------------------------------------ F1 ----

// Sources spell drivers differently ("Carlos Sainz Jr.", "Andrea Kimi
// Antonelli", "Hülkenberg"), so everything is keyed on the bare surname.
function driverKey(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\bjr\.?$/, '')
    .trim()
    .split(/\s+/)
    .at(-1)
}

const sessionIso = (s) => (s?.date ? new Date(`${s.date}T${s.time ?? '12:00:00Z'}`).toISOString() : null)

// Turns a yes-contract order book into an implied probability. A tight book
// is taken at the ask (what a bet would really cost); a wide one at the
// midpoint, since a lone resting ask says little; an empty one not at all.
const MAX_SPREAD = 0.2
function quote(bid, ask) {
  const spread = ask - bid
  if (!(ask > 0 && ask < 1) || !(spread <= MAX_SPREAD)) return null
  return { price: spread <= 0.05 ? ask : (bid + ask) / 2, spread }
}

// Each source returns [{ at: ms the market refers to, prices: Map<driverKey, {price, spread, name}> }].
async function kalshiMarkets(series) {
  const data = await getJson(`${KALSHI}/events?series_ticker=${series}&status=open&with_nested_markets=true&limit=20`)
  return (data.events ?? []).map((event) => {
    const prices = new Map()
    for (const m of event.markets ?? []) {
      const q = m.status === 'active' && quote(Number(m.yes_bid_dollars), Number(m.yes_ask_dollars))
      if (q) prices.set(driverKey(m.yes_sub_title), { ...q, name: m.yes_sub_title })
    }
    return { source: 'Kalshi', at: Date.parse(event.markets?.[0]?.expected_expiration_time), prices }
  })
}

async function polymarketMarkets() {
  const events = await getJson(`${POLYMARKET}/events?tag_id=${POLYMARKET_F1_TAG}&closed=false&limit=100`)
  const out = { race: [], pole: [] }
  for (const event of events) {
    const match = /^f1-(?!.*sprint).+-grand-prix-(winner|driver-pole-position)-(\d{4}-\d{2}-\d{2})$/.exec(event.slug)
    if (!match) continue
    const prices = new Map()
    for (const m of event.markets ?? []) {
      const q = m.active && !m.closed && quote(Number(m.bestBid ?? 0), Number(m.bestAsk))
      if (q) prices.set(driverKey(m.groupItemTitle), { ...q, name: m.groupItemTitle })
    }
    // The slug only carries a date; midday keeps it within reach of any session time.
    out[match[1] === 'winner' ? 'race' : 'pole'].push({ source: 'Polymarket', at: Date.parse(`${match[2]}T12:00:00Z`), prices })
  }
  return out
}

async function f1Markets() {
  const sources = await Promise.allSettled([kalshiMarkets('KXF1RACE'), kalshiMarkets('KXF1POLE'), polymarketMarkets()])
  for (const s of sources) if (s.status === 'rejected') console.warn(`F1 odds source failed: ${s.reason.message}`)
  const [kalshiRace, kalshiPole, poly] = sources.map((s) => (s.status === 'fulfilled' ? s.value : null))
  return {
    race: [...(kalshiRace ?? []), ...(poly?.race ?? [])],
    pole: [...(kalshiPole ?? []), ...(poly?.pole ?? [])],
  }
}

// One price per driver across every market that refers to this session,
// preferring whichever source has the tightest book.
function f1Selections(markets, sessionStart, drivers) {
  const best = new Map()
  for (const market of markets) {
    if (!(Math.abs(market.at - sessionStart) < 1.5 * DAY)) continue
    for (const [key, q] of market.prices) {
      const held = best.get(key)
      if (!held || q.spread < held.spread || (q.spread === held.spread && q.price < held.price)) best.set(key, { ...q, source: market.source })
    }
  }
  return [...best]
    .map(([key, price]) => ({
      id: key,
      label: drivers.get(key)?.name ?? price.name,
      sub: drivers.get(key)?.team,
      odds: round2(1 / price.price),
      source: price.source,
    }))
    .sort((a, b) => a.odds - b.odds || a.label.localeCompare(b.label))
}

async function firstPlaceByRound(path, listKey) {
  const data = await getJson(`${JOLPICA}/current/${path}/1.json?limit=100`)
  const out = new Map()
  for (const race of data.MRData.RaceTable.Races) {
    const driver = race[listKey]?.[0]?.Driver
    if (driver) out.set(race.round, { winner: driverKey(driver.familyName), score: `${driver.givenName} ${driver.familyName}` })
  }
  return out
}

async function fetchF1() {
  const [schedule, standings, winners, poles, markets] = await Promise.all([
    getJson(`${JOLPICA}/current.json?limit=100`),
    getJson(`${JOLPICA}/current/driverStandings.json?limit=100`),
    firstPlaceByRound('results', 'Results'),
    firstPlaceByRound('qualifying', 'QualifyingResults'),
    f1Markets(),
  ])

  const drivers = new Map()
  for (const s of standings.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? []) {
    drivers.set(driverKey(s.Driver.familyName), {
      name: `${s.Driver.givenName} ${s.Driver.familyName}`,
      team: s.Constructors.at(-1)?.name,
    })
  }

  const events = []
  for (const race of schedule.MRData.RaceTable.Races) {
    const name = race.raceName.replace(/ in .+$/, '').replace('Grand Prix', 'GP')
    const sessions = [
      { comp: 'f1q', label: 'Qualifying', start: sessionIso(race.Qualifying), result: poles.get(race.round), markets: markets.pole },
      { comp: 'f1r', label: 'Race', start: sessionIso(race), result: winners.get(race.round), markets: markets.race },
    ]
    for (const s of sessions) {
      if (!s.start || !inWindow(s.start)) continue
      const start = Date.parse(s.start)
      const event = {
        id: `${s.comp}:${race.season}-${race.round}`,
        comp: s.comp,
        start: s.start,
        title: `${name} · ${s.label}`,
        round: `Round ${race.round}`,
        // A session with no classification a week on never happened.
        status: s.result ? 'final' : now < start ? 'open' : now > start + 7 * DAY ? 'void' : 'live',
      }
      if (event.status === 'final') event.result = s.result
      if (event.status === 'open') {
        const selections = f1Selections(s.markets, start, drivers)
        event.markets = selections.length ? [{ id: 'result', name: s.comp === 'f1q' ? 'Pole position' : 'Race winner', selections }] : []
        const sources = [...new Set(selections.map((x) => x.source))]
        if (sources.length) event.source = sources.join(' / ')
      }
      events.push(event)
    }
  }
  return events
}

// ---------------------------------------------------------------- main ----

async function main() {
  const groups = await Promise.all([...LEAGUES.map(fetchLeague), fetchF1()])
  const events = groups.flat().sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))

  await mkdir(OUT_DIR, { recursive: true })
  await writeFile(new URL('events.json', OUT_DIR), JSON.stringify({ generatedAt: new Date(now).toISOString(), events }))

  for (const comp of ['nfl', 'epl', 'ucl', 'f1q', 'f1r']) {
    const list = events.filter((e) => e.comp === comp)
    const open = list.filter((e) => e.status === 'open')
    const priced = open.filter((e) => e.markets.length)
    console.log(`${comp.padEnd(4)} ${String(list.length).padStart(4)} events, ${open.length} open (${priced.length} with odds)`)
  }
}

await main()
