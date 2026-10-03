const HOUR = 36e5
const WEEK = 7 * 24 * HOUR

// Game weeks run Tuesday 10:00 UTC to the next Tuesday. That keeps Monday
// Night Football (which ends early Tuesday UTC) with the rest of its NFL week,
// and puts a midweek Champions League round and the following weekend together.
const ANCHOR = Date.UTC(2024, 0, 2, 10)

export const weekOf = (time: number | string) => Math.floor(((typeof time === 'string' ? Date.parse(time) : time) - ANCHOR) / WEEK)

export const weekStart = (week: number) => ANCHOR + week * WEEK

const dayMonth = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })

/** "29 Sep – 5 Oct": the Tuesday the week opens to the Monday it closes. */
export function weekLabel(week: number) {
  const start = weekStart(week)
  return `${dayMonth.format(start)} – ${dayMonth.format(start + WEEK - 24 * HOUR)}`
}
