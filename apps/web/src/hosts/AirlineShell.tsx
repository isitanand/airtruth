import { Clock3, Luggage, MapPin, Plane, Radar, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { ConceptLabel } from '../shared/ConceptLabel'
import { useFlight, useSession } from '../shared/demo'
import '../widget/element'
import { AirframeMap } from './AirframeMap'
import './hosts.css'

export type CarrierId = 'indigo' | 'delta' | 'ba'

interface CarrierConfig {
  id: CarrierId
  name: string
  tagline: string
  accent: string
  headerBg: string
  headerText: string
  pillBg: string
  defaultFlight: string
  flights: { key: string; label: string }[]
  statuteBadge: string
}

const CARRIERS: Record<CarrierId, CarrierConfig> = {
  indigo: {
    id: 'indigo',
    name: 'IndiGo',
    tagline: '6E Live Flight Status',
    accent: '#001b94',
    headerBg: '#001b94',
    headerText: '#ffffff',
    pillBg: '#2f54eb',
    defaultFlight: 'indigo-crew-timeout',
    flights: [
      { key: 'indigo-crew-timeout', label: '6E-214 · DEL→BLR' },
      { key: 'indigo-selective-weather', label: '6E-509 · BOM→HYD' },
    ],
    statuteBadge: 'DGCA CAR §3 Verified',
  },
  delta: {
    id: 'delta',
    name: 'Delta',
    tagline: 'Fly Delta · Trip Tracker',
    accent: '#c8102e',
    headerBg: '#0c1b33',
    headerText: '#ffffff',
    pillBg: '#c8102e',
    defaultFlight: 'delta-tail-chain',
    flights: [
      { key: 'delta-tail-chain', label: 'DL-418 · JFK→LAX' },
      { key: 'delta-crew-reserve', label: 'DL-902 · ATL→SFO' },
    ],
    statuteBadge: 'US DOT 14 CFR §260',
  },
  ba: {
    id: 'ba',
    name: 'British Airways',
    tagline: 'Manage My Booking · Live',
    accent: '#075aaa',
    headerBg: '#0f204b',
    headerText: '#ffffff',
    pillBg: '#c8102e',
    defaultFlight: 'ba-selective-weather',
    flights: [
      { key: 'ba-selective-weather', label: 'BA-117 · LHR→JFK' },
      { key: 'ba-tarmac-hold', label: 'BA-308 · LHR→CDG' },
    ],
    statuteBadge: 'EU261 / UK261 Art. 5',
  },
}

export function AirlineHostApp({ carrier }: { carrier: CarrierId }) {
  const cfg = CARRIERS[carrier]
  const session = useSession()
  const urlFlight = typeof window !== 'undefined' ? new URLSearchParams(location.search).get('flight') : null
  const [flightKey, setFlightKey] = useState(
    urlFlight && cfg.flights.some((f) => f.key === urlFlight) ? urlFlight : cfg.defaultFlight,
  )
  const v = useFlight(session, flightKey)

  const legs = v?.rotation_legs ?? []

  return (
    <div className={`host-shell theme-${carrier}`}>
      <ConceptLabel brand={cfg.name} className="concept-banner" />
      <header className="carrier-bar" style={{ background: cfg.headerBg, color: cfg.headerText }}>
        <div className="carrier-top">
          <div className="carrier-mark">
            <Plane size={18} />
            <strong>{cfg.name}</strong>
          </div>
          <span className="statute-pill" style={{ background: cfg.pillBg }}>{cfg.statuteBadge}</span>
        </div>
        <p className="carrier-sub">{cfg.tagline}</p>
        <div className="flight-switch" role="tablist" aria-label="Select carrier flight">
          {cfg.flights.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={flightKey === f.key}
              onClick={() => setFlightKey(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <main className="host-main">
        <section className="flight-hero-card">
          <div className="flight-row-top">
            <div>
              <span className="eyebrow">Aircraft Tail {v?.tail_number ?? '···'} · {v?.aircraft_type ?? 'A321neo'}</span>
              <h1>{v?.route ?? cfg.flights[0].label.split('·')[1]}</h1>
            </div>
            <div className="delay-chip">
              <Clock3 size={13} />
              <span>{v && v.delay_minutes > 0 ? `+${Math.floor(v.delay_minutes / 60)}h ${v.delay_minutes % 60}m` : 'On time'}</span>
            </div>
          </div>
          <div className="gate-strip">
            <span><MapPin size={13} /> Gate {v?.eta.gate ?? 'B42'}</span>
            <span><Luggage size={13} /> {v?.flight_code ?? '6E-214'}</span>
            <span><Radar size={13} /> ADS-B {v?.icao24 ?? '800E94'}</span>
          </div>
        </section>

        <AirframeMap view={v} accent={cfg.accent} />

        {legs.length > 0 && (
          <section className="rotation-card" aria-label="Tail-number inbound rotation chain">
            <div className="rotation-head">
              <strong>Prior Airframe Legs ({legs.length})</strong>
              <span>{v?.tail_number}</span>
            </div>
            <ol className="rotation-list">
              {legs.map((leg) => (
                <li key={leg.leg_index} className={leg.delay_min >= 45 ? 'late' : ''}>
                  <span className="leg-code">{leg.flight_code}</span>
                  <span className="leg-route">{leg.route}</span>
                  <span className="leg-delay">+{leg.delay_min}m</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {session ? (
          <airtruth-flight session={session} flight={flightKey} variant="flight-card" theme={carrier} />
        ) : (
          <p className="waiting">Connecting to live AirTruth flight session…</p>
        )}

        <footer className="host-foot">
          <ShieldCheck size={14} />
          <span>Embedded via <code>&lt;airtruth-flight theme="{carrier}"&gt;</code> SDK</span>
        </footer>
      </main>
    </div>
  )
}

