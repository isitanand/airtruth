import type { FlightView } from '../widget/types'

export function AirframeMap({ view, accent }: { view: FlightView | null; accent: string }) {
  const origin = view?.origin_icao || 'VIDP'
  const dest = view?.dest_icao || 'VOBL'
  const tail = view?.tail_number || 'VT-IFU'
  const rw = view?.runway_ops
  const metar = view?.metar
  const flash = Boolean(view?.radar_flash)
  const rebutted = view?.excuse_state === 'rebutted'

  return (
    <div className={`air-map${flash ? ' flashing' : ''}`} role="img" aria-label={`ADS-B radar telemetry map for ${tail}`}>
      <svg viewBox="0 0 360 190" className="air-svg">
        <defs>
          <radialGradient id="sweepGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rebutted ? '#c8102e' : accent} stopOpacity="0.28" />
            <stop offset="100%" stopColor={rebutted ? '#c8102e' : accent} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="360" height="190" fill="#0b0f17" />
        {/* Range rings & crosshairs */}
        <g stroke="rgba(255,255,255,0.08)" fill="none" strokeWidth="1">
          <circle cx="180" cy="95" r="36" />
          <circle cx="180" cy="95" r="72" />
          <circle cx="180" cy="95" r="110" />
          <line x1="0" y1="95" x2="360" y2="95" strokeDasharray="3 4" />
          <line x1="180" y1="0" x2="180" y2="190" strokeDasharray="3 4" />
        </g>
        {flash && <circle cx="180" cy="95" r="95" fill="url(#sweepGrad)" />}
        {/* Active runway vector + parallel departure pips */}
        <line x1="48" y1="138" x2="312" y2="52" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeDasharray="5 4" />
        <path d="M56 136 Q180 42 304 56" fill="none" stroke={accent} strokeWidth="2.4" />
        {/* Parallel departing flights proving flyable runway */}
        {(rw?.sample_flights ?? ['AI-502', 'UK-811', 'QP-1102', '6E-631']).slice(0, 4).map((f, i) => {
          const cx = 115 + i * 48
          const cy = 118 - i * 18
          return (
            <g key={f} transform={`translate(${cx}, ${cy})`}>
              <circle r="3.2" fill="#2ee59d" />
              <text x="6" y="3" fill="#8fa0b5" fontSize="8.5" style={{ fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>{f}</text>
            </g>
          )
        })}
        {/* Origin & Dest waypoints */}
        <g transform="translate(56,136)">
          <circle r="5" fill="#ffffff" stroke={accent} strokeWidth="2.5" />
          <text x="-8" y="18" fill="#f3f4f2" fontSize="11" fontWeight="700" style={{ fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>{origin}</text>
        </g>
        <g transform="translate(304,56)">
          <circle r="5" fill="#ffffff" stroke="#8be0b8" strokeWidth="2" />
          <text x="-12" y="-10" fill="#f3f4f2" fontSize="11" fontWeight="700" style={{ fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>{dest}</text>
        </g>
        {/* Tracked aircraft blip */}
        <g transform="translate(96,120)">
          {rebutted && <circle r="15" fill="none" stroke="#ff5c72" strokeWidth="1.5" strokeDasharray="3 2" />}
          <circle r="6" fill={rebutted ? '#ff5c72' : accent} />
          <text x="10" y="-6" fill="#ffffff" fontSize="10" fontWeight="700" style={{ fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>{tail}</text>
          <text x="10" y="6" fill="#9ea8ba" fontSize="8.5" style={{ fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace" }}>HEX {view?.icao24 ?? '800E94'}</text>
        </g>
      </svg>
      <div className="air-telemetry">
        <span><b>METAR</b> {metar?.station ?? origin} · {metar?.flyable ? 'VMC FLYABLE' : 'IMC'} ({metar?.visibility_m ?? 6000}m)</span>
        <span><b>RWY</b> {rw?.runway ?? 'RWY 27'} · {rw?.other_departures_count ?? 8} departures active</span>
      </div>
    </div>
  )
}

