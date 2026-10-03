import type { Comp } from './types'

export interface CompInfo {
  id: Comp
  name: string
  short: string
  /** Competitions sharing a group are shown under one heading. */
  group: string
}

export const COMPS: CompInfo[] = [
  { id: 'nfl', name: 'NFL', short: 'NFL', group: 'NFL' },
  { id: 'epl', name: 'Premier League', short: 'EPL', group: 'Premier League' },
  { id: 'ucl', name: 'Champions League', short: 'UCL', group: 'Champions League' },
  { id: 'f1q', name: 'F1 Qualifying', short: 'F1 Quali', group: 'Formula 1' },
  { id: 'f1r', name: 'F1 Race', short: 'F1 Race', group: 'Formula 1' },
]

export const COMP: Record<Comp, CompInfo> = Object.fromEntries(COMPS.map((c) => [c.id, c])) as Record<Comp, CompInfo>

export const GROUPS = [...new Set(COMPS.map((c) => c.group))]
