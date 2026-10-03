import type { OddsFormat } from './types'

const gbp = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })

export const money = (n: number) => gbp.format(n)

export const signedMoney = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + gbp.format(Math.abs(n))

export const percent = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n * 100).toFixed(1)}%`

// The prices UK bookmakers actually quote, so 2.38 reads as 11/8 rather than 69/50.
const FRACTIONS = (
  '1/100 1/50 1/33 1/25 1/20 1/16 1/14 1/12 1/10 1/9 1/8 2/15 1/7 2/13 1/6 2/11 1/5 2/9 1/4 2/7 3/10 1/3 4/11 2/5 4/9 1/2 ' +
  '8/15 4/7 8/13 4/6 8/11 4/5 5/6 10/11 1/1 11/10 6/5 5/4 11/8 6/4 13/8 7/4 15/8 2/1 9/4 5/2 11/4 3/1 10/3 7/2 4/1 9/2 5/1 ' +
  '11/2 6/1 13/2 7/1 15/2 8/1 9/1 10/1 11/1 12/1 14/1 16/1 18/1 20/1 22/1 25/1 28/1 33/1 40/1 50/1 66/1 80/1 100/1'
)
  .split(' ')
  .map((text) => {
    const [num, den] = text.split('/').map(Number)
    return { text: text === '1/1' ? 'Evens' : text, value: num / den }
  })

function fractional(decimal: number) {
  const target = decimal - 1
  if (target > 110) return `${Math.round(target)}/1`
  return FRACTIONS.reduce((best, f) => (Math.abs(f.value - target) < Math.abs(best.value - target) ? f : best)).text
}

function american(decimal: number) {
  return decimal >= 2 ? `+${Math.round((decimal - 1) * 100)}` : `−${Math.round(100 / (decimal - 1))}`
}

export function formatOdds(decimal: number, format: OddsFormat) {
  if (format === 'fractional') return fractional(decimal)
  if (format === 'american') return american(decimal)
  return decimal.toFixed(2)
}

/** A spread line as bookmakers write it: "+4.5", "−7", or "PK" for a pick'em. */
export const formatLine = (line: number) => (line > 0 ? `+${line}` : line < 0 ? `−${-line}` : 'PK')

const kickoff = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const shortDate = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const clock = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

export const formatKickoff = (iso: string) => kickoff.format(new Date(iso))
export const formatDate = (iso: string) => shortDate.format(new Date(iso))
export const formatTime = (iso: string) => clock.format(new Date(iso))

export function timeAgo(iso: string, now: number) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 6e4))
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  return hours < 24 ? `${hours} hr ago` : `${Math.round(hours / 24)} days ago`
}
