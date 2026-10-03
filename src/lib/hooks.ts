import { useCallback, useEffect, useState } from 'react'
import type { Feed } from './types'

const FEED_URL = `${import.meta.env.BASE_URL}data/events.json`
const REFRESH_MS = 5 * 60_000

/** The odds and results feed, refreshed periodically and whenever the app comes back to the foreground. */
export function useFeed() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState(false)

  const reload = useCallback(async () => {
    try {
      const response = await fetch(FEED_URL, { cache: 'no-cache' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setFeed(await response.json())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    reload()
    const timer = setInterval(reload, REFRESH_MS)
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  return { feed, error, reload }
}

/** The current time, ticking often enough for events to lock at kick-off. */
export function useNow(intervalMs = 20_000) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
