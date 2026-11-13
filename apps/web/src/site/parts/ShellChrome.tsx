import { ArrowRight, ExternalLink, Globe, Menu, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export const LINKS = [
  ['Check Flight', '/lookup'],
  ['Live Radar Demo', '/demos'],
  ['Passenger Rights', '/method'],
  ['Airline Audits', '/case-studies'],
] as const

export function AirtruthLogoMark({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`airtruth-logomark ${className}`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="mark-bg" cx="50%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#141a28" />
          <stop offset="70%" stopColor="#080b12" />
          <stop offset="100%" stopColor="#040609" />
        </radialGradient>
        <linearGradient id="mark-radar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7567ff" />
          <stop offset="50%" stopColor="#3a2bff" />
          <stop offset="100%" stopColor="#2213d8" />
        </linearGradient>
        <linearGradient id="mark-wing-l" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e2e8f5" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="mark-wing-r" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="70%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#8896ab" />
        </linearGradient>
        <linearGradient id="mark-spine" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="30%" stopColor="#7366ff" />
          <stop offset="100%" stopColor="#3a2bff" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="45" height="45" rx="11" fill="url(#mark-bg)" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="16.5" stroke="url(#mark-radar)" strokeWidth="2.4" fill="none" opacity="0.95" />
      <circle cx="24" cy="24" r="11.8" stroke="rgba(255, 255, 255, 0.22)" strokeWidth="1" strokeDasharray="2 3" fill="none" />
      <line x1="24" y1="4.5" x2="24" y2="7.5" stroke="#7567ff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="40.5" x2="24" y2="43.5" stroke="#7567ff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="4.5" y1="24" x2="7.5" y2="24" stroke="#7567ff" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40.5" y1="24" x2="43.5" y2="24" stroke="#7567ff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 24 7.5 A 16.5 16.5 0 0 1 40.5 24" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity="0.85" />
      <path d="M 24 11 L 12 33 L 20 29 L 24 27.2 Z" fill="url(#mark-wing-l)" />
      <path d="M 24 11 L 36 33 L 28 29 L 24 27.2 Z" fill="url(#mark-wing-r)" />
      <path d="M 12 33 L 11 31.5 L 12.8 32 Z" fill="#7567ff" />
      <path d="M 36 33 L 37 31.5 L 35.2 32 Z" fill="#7567ff" />
      <path d="M 24 11 L 24.6 26.5 L 24 27.4 L 23.4 26.5 Z" fill="url(#mark-spine)" />
      <circle cx="24" cy="23.2" r="1.4" fill="#ffffff" />
      <circle cx="24" cy="23.2" r="3.2" stroke="#3a2bff" strokeWidth="0.8" fill="none" />
    </svg>
  )
}

export function Logo() {
  return (
    <a className="logo" href="/" aria-label="AIRTRUTH home">
      <AirtruthLogoMark size={28} />
      <span className="logo-text">AIRTRUTH</span>
    </a>
  )
}

export function Nav({ path }: { path: string }) {
  const [open, setOpen] = useState(false)
  const is = (h: string) => (h === '/' ? path === '/' : path.startsWith(h))
  return (
    <>
      <header className="nav">
        <div className="nav-in">
          <Logo />
          <nav className="nav-links" aria-label="Main">
            {LINKS.map(([label, href]) => (
              <a key={href} href={href} aria-current={is(href) ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
          <span className="sp" />
          <span className="label">ADS-B · METAR · EU261 / DOT / DGCA</span>
          <a className="btn sm nav-cta" href="/lookup">Check my flight</a>
          <button className="burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </header>
      {open && (
        <div className="sheet">
          {LINKS.map(([label, href]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
          <a href="/method" onClick={() => setOpen(false)}>Audit method</a>
          <a className="btn nav-cta" href="/lookup" onClick={() => setOpen(false)}>Check my flight</a>
        </div>
      )}
    </>
  )
}

export function Cols() {
  return (
    <div className="cols" aria-hidden="true">
      {Array.from({ length: 12 }, (_, i) => <i key={i} />)}
    </div>
  )
}

export function More({ href, label, children }: { href: string; label?: string; children?: ReactNode }) {
  return <a className="more" href={href}>{label ?? children ?? 'Read full audit'} <ArrowRight size={14} aria-hidden="true" /></a>
}

const FOOT: [string, [string, string][]][] = [
  ['Flight Audit', [['Check Flight / PNR', '/lookup'], ['Product overview', '/'], ['3-airline radar demo', '/demos'], ['Audit method', '/method']]],
  ['Carriers', [['IndiGo · DGCA', '/case-studies/indigo'], ['Delta · US DOT', '/case-studies/delta'], ['British Airways · EU261', '/case-studies/ba'], ['All audits', '/case-studies']]],
  ['Verification', [['Architecture', '/built-by'], ['Charter rules', '/docs/config-reference'], ['REST API schema', '/docs/api-reference'], ['Privacy & signing', '/privacy']]],
  ['Standards', [['EU Reg 261/2004', '/method'], ['US DOT 14 CFR §260', '/method'], ['Indian DGCA CAR §3', '/method']]],
]

export function Footer({ children }: { children?: ReactNode }) {
  return (
    <footer className="footer">
      <div className="footer-in">
        <div className="footer-brand">
          <Logo />
          <p>
            The Airline Delay &amp; Statutory Payout Engine. Cross-examines airline &ldquo;bad weather&rdquo; excuses against live ADS-B radar, METAR weather, runway logs, and crew duty records.
          </p>
          <a className="btn footer-cta" href="/lookup">
            Check my flight <ArrowRight size={15} />
          </a>
        </div>
        {FOOT.map(([head, items]) => (
          <nav key={head} aria-label={head}>
            <h2>{head}</h2>
            <ul>{items.map(([l, h]) => <li key={l}><a href={h}>{l}</a></li>)}</ul>
          </nav>
        ))}
      </div>
      {children}
      <div className="footer-base">
        <p className="footer-note">
          <strong>AIRTRUTH</strong> &middot; Carrier app replicas (IndiGo, Delta, British Airways) are concept telemetry sandboxes for statutory passenger rights verification under DGCA CAR &sect;3, EU261, and US DOT 14 CFR &sect;260.
        </p>

        <div className="footer-bottom-bar">
          <div className="footer-brand-legal">
            <span className="footer-copy">&copy; {new Date().getFullYear()} AIRTRUTH &middot; Open Aviation Intelligence</span>
            <div className="footer-legal-links">
              <a href="/privacy">Privacy &amp; Signing</a>
              <span className="footer-bullet">&bull;</span>
              <a href="/built-by">Architecture</a>
              <span className="footer-bullet">&bull;</span>
              <a href="/lookup">Flight Lookup</a>
            </div>
          </div>

          <div className="footer-creator-card">
            <span className="footer-creator-label">
              Architected &amp; Built by <strong className="creator-name">Anand Choubey</strong>
            </span>
            <div className="footer-creator-actions">
              <a
                href="https://anandchoubey.is-a.dev/"
                target="_blank"
                rel="noreferrer"
                className="footer-link-pill portfolio-pill"
                title="Visit Anand Choubey's Portfolio"
              >
                <Globe size={13} />
                <span>Portfolio</span>
                <ExternalLink size={11} className="ext-icon" />
              </a>
              <a
                href="https://github.com/isitanand"
                target="_blank"
                rel="noreferrer"
                className="footer-link-pill github-pill"
                title="View Anand Choubey on GitHub"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                <span>GitHub</span>
                <ExternalLink size={11} className="ext-icon" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
