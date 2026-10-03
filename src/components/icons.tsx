import type { ReactNode } from 'react'

const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)

export const PicksIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
  </Icon>
)

export const BetsIcon = () => (
  <Icon>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9.5 8h5M9.5 12h5" />
  </Icon>
)

export const StatsIcon = () => (
  <Icon>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Icon>
)

export const SettingsIcon = () => (
  <Icon>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Icon>
)

export const Logo = () => (
  <svg viewBox="0 0 512 512" width="26" height="26" aria-hidden="true">
    <circle cx="256" cy="256" r="200" fill="none" stroke="var(--accent)" strokeWidth="56" strokeDasharray="78.5 78.5" strokeDashoffset="39" />
    <path d="M176 262l54 54 106-124" fill="none" stroke="var(--accent)" strokeWidth="52" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
