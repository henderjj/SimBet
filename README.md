# SimBet

A play-money betting game: make a set number of picks each week at real odds and track how you do. Installable as a PWA on phone and desktop.

- **Competitions:** NFL, Premier League, Champions League, F1 qualifying and F1 race.
- **Bets:** single bets only — NFL point spread or moneyline, football match result (with the draw) or goal handicap, F1 race winner and pole position.
- **Weekly card:** 5 NFL, 3 Premier League, 3 Champions League, 1 F1 qualifying and 1 F1 race pick per game week by default (adjustable in Settings). A game week runs Tuesday to Monday.
- **Bankroll:** £1,000 of play money to start. Odds lock when a bet is placed; bets can be changed or removed until the event starts.

## Running it

```bash
npm install
npm run data   # fetch fixtures, odds and results into public/data/events.json
npm run dev
```

`npm test` runs the game-logic tests and `npm run build` produces the static site in `dist/`.

## How it works

There is no backend. `scripts/fetch-data.mjs` pulls everything from public feeds that need no API key and writes one JSON file, which the app loads:

| Data | Source |
| --- | --- |
| NFL, Premier League, Champions League fixtures, results, moneyline, spread and handicap odds (DraftKings) | ESPN scoreboard API |
| F1 calendar, race winners and pole sitters | Jolpica (Ergast) API |
| F1 race-winner and pole-position prices | Kalshi and Polymarket exchanges |

Bets, settings and history live in the browser's `localStorage`, so each device has its own game. Settings → Backup exports and imports the whole game as a file.

Settlement rules: football bets, handicaps included, settle on the 90-minute score; NFL bets include overtime, and a tied moneyline bet or a spread that lands exactly on the line is void (stake returned), as is any bet on a postponed event; F1 pole is the fastest qualifier. A spread or handicap bet keeps the line and odds it was placed at.

F1 prices come from exchange order books rather than a bookmaker: a tight book is taken at the asking price, a wide one at the midpoint, and a driver with no real market isn't offered. Pole-position markets are often thin until the day before qualifying, so some drivers may be missing early on.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and deploys the site on every push to `main` and every 30 minutes, fetching fresh odds and results each time.

1. Push this repo to GitHub.
2. In the repo's Settings → Pages, set **Source** to **GitHub Actions**.
3. Open the site on each device and install it (browser menu → *Install app* / *Add to Home Screen*).

GitHub pauses scheduled workflows after 60 days without a commit and emails a warning first; re-enable it from the Actions tab if that happens.
