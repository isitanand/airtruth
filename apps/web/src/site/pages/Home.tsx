import { ArrowRight, Plus } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { FAQ } from '../data/faq'
import insights from '../data/insights.json'
import { STUDIES, type Slug } from '../data/studies'
import { Grouped, HBars } from '../parts/AnalyticsCharts'
import { CodeBlock } from '../parts/Code'
import { DitherShader } from '../parts/DitherShader'
import { FlightLookup } from '../parts/FlightLookup'
import { FlightPreview } from '../parts/FlightPreview'
import { Reveal } from '../parts/Motion'
import { Photo } from '../parts/Photo'
import { Cols, More } from '../parts/ShellChrome'

const EASE = [0.16, 1, 0.3, 1] as const
const HEADLINE = insights.compare.headline

export function Home() {
  return (
    <main id="main">
      <Hero />
      <Marquees />
      <FlightLookup initialQuery="" id="audit" />
      <Problem />
      <PhotoBand
        base="tarmac-turnaround"
        alt="Commercial airliner docked at airport gate during turnaround at twilight"
        line="Your delay began four airports away."
        note="On the departure board it reads Bad Weather. On tail-number telemetry, aircraft VT-IFU was already 160 minutes behind after a crew FDTL timeout in Mumbai."
      />
      <Detectors />
      <PassengerAdvantage />
      <Grounded />
      <div className="night">
        <Policy />
        <Deck />
      </div>
      <Faq />
      <Close />
    </main>
  )
}

/* ---------- Hero ---------- */
function Hero() {
  const line = (text: string, i: number, cls = '') => (
    <span className="ln"><span className={`ln-rise ${cls}`} style={{ animationDelay: `${0.1 + i * 0.09}s` }}>{text}</span></span>
  )
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="frame">
        <Cols />
        <div className="hero-in">
          <h1 id="hero-title" className="display hero-title">
            {line("It isn't", 0)}
            {line('always the', 1)}
            {line('Weather.', 2, 'acc')}
          </h1>
          <div className="hero-rest">
            <p className="lead enter d3">
              Enter your flight number, date, or paste an airline delay message directly on this site. AIRTRUTH checks live airport
              weather, whether other planes took off cleanly, and pilot duty limits—then writes your compensation claim letter for free.
            </p>
            <div className="ctas enter d4">
              <a className="btn" href="#audit">Audit your flight now <ArrowRight size={16} aria-hidden="true" /></a>
              <a className="btn ghost" href="/demos">Try 3-airline radar demo</a>
            </div>
          </div>
          <div className="stage">
            <DitherShader cell={3} scale={200} bias={0.12} rise={0.3} />
            <FlightPreview />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Marquees ---------- */
const CHARTERS = [
  'EU Regulation 261/2004 (€600)',
  'UK261 Passenger Charter',
  'US DOT 14 CFR Part 260 ($650)',
  'India DGCA CAR Section 3 (₹10,000)',
  'IndiGo A320neo Domestic',
  'Delta Transcontinental Hub',
  'British Airways Long-Haul',
  'Flight Rights Claims Platforms',
  'Corporate Travel TMC Portals',
]
const FEEDS = [
  'ADS-B Mode-S 1090ES',
  'METAR / TAF Airport Weather',
  'FAA NAS Ground Delay Programs',
  'DGCA / AAI Slot Movement Logs',
  'Parallel Runway Departures',
  'Tail-Number 4-Leg Chaining',
  'Crew FDTL / FAR 117 Duty Caps',
  'SHA-256 Coordinate Sealing',
]

function Marquees() {
  const row = (items: string[], cls: string) => (
    <div className={`mq ${cls}`} aria-hidden="true">
      <div className="mq-track">{[...items, ...items].map((t, i) => <span key={i}>{t}<i /></span>)}</div>
    </div>
  )
  return (
    <section className="marquees" aria-label="Supported charters and telemetry streams">
      <p className="sr-only">Built for {CHARTERS.join(', ')}. Fuses {FEEDS.join(', ')}.</p>
      <div className="mq-label frame"><span>The Airline Delay &amp; Statutory Payout Engine</span></div>
      {row(CHARTERS, 'big')}
      {row(FEEDS, 'small rev')}
    </section>
  )
}

function PhotoBand({ base, alt, line, note }: { base: 'tarmac-turnaround' | 'flight-deck-weather'; alt: string; line: string; note: string }) {
  return (
    <section className="photoband" aria-label={alt}>
      <Photo base={base} alt={alt} />
      <div className="frame photoband-in">
        <Reveal kind="wipe"><p className="pb-line">{line}</p></Reveal>
        <p className="pb-note">{note}</p>
      </div>
    </section>
  )
}

/* ---------- Problem ---------- */
function Problem() {
  return (
    <section className="sec" id="problem" aria-labelledby="problem-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head wide">
            <h2 className="h2" id="problem-title">Airlines call almost every delay “Weather”. Radar shows the receipt.</h2>
            <p className="lead">{insights.auditTotal.toLocaleString('en-IN')} multi-hour disrupted flights across IndiGo, Delta, and British Airways, audited leg by leg against public ADS-B and runway logs.</p>
          </Reveal>
          <div className="problem-grid">
            <div className="stick">
              <Reveal className="chart" kind="wipe">
                <div className="chart-head"><div><h3>“Weather” excuses rebutted</h3><p>Share of exempted claims refuted by radar &amp; tail logs</p></div></div>
                <div className="brandbars">
                  {HEADLINE.map((b, i) => (
                    <div className="brandbar" key={b.slug}>
                      <span className="bb-name">{b.name}</span>
                      <span className="bb-track">
                        <motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: b.rebuttedShare / 100 }} viewport={{ once: true }} transition={{ duration: 1.3, ease: EASE, delay: 0.2 + i * 0.12 }} />
                      </span>
                      <span className="bb-num num">{b.rebuttedShare}<small>%</small></span>
                    </div>
                  ))}
                </div>
                <p className="chart-note"><b>{insights.detectors[0].share}%</b> of rebutted airline weather claims trace back to a 4-leg inbound tail-number chain delay starting hours earlier.</p>
              </Reveal>
              <Reveal className="chart hurts" kind="wipe" delay={0.15}>
                <div className="chart-head"><div><h3>Detector yield breakdown</h3><p>Which contradiction exposes the excuse first</p></div></div>
                <HBars rows={insights.detectors.map((d) => ({ label: d.label, value: d.share }))} max={45} />
                <a className="more" href="/case-studies">Inspect airline audits</a>
              </Reveal>
            </div>
            <Reveal className="chart" kind="wipe" delay={0.1}>
              <div className="chart-head"><div><h3>How the excuse breaks down</h3><p>Audit share by carrier across three compensation regimes</p></div></div>
              <Grouped rows={insights.categories} series={insights.carriers} />
              <p className="chart-foot">Derived from deterministic replay across DGCA CAR §3, US DOT 14 CFR §260, and EU261 scenarios. <a className="more" href="/method">Audit method</a></p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Detectors (6 cards) ---------- */
const stroke = { stroke: '#0b0f17', strokeWidth: 2, fill: 'none' }
const DETECTORS = [
  {
    n: '01 · TAIL-NUMBER CHAINING',
    h: '4-leg rotation slip',
    p: 'Traces the exact airframe tail (e.g. VT-IFU or N842DN) across its prior 4 flights before your gate opened.',
    says: 'VT-IFU slipped +145m in Mumbai 6h earlier. The aircraft was late long before Delhi cloud cover existed.',
    viz: (
      <svg viewBox="0 0 300 120">
        <line x1="20" y1="62" x2="280" y2="62" stroke="#d8d9e2" strokeWidth="2" />
        {[28, 108, 192, 272].map((x, idx) => (
          <g key={x}>
            <circle cx={x} cy="62" r={idx === 1 ? 8 : 6} fill={idx >= 1 ? '#3a2bff' : '#0b0f17'} />
            <text x={x - 16} y="42" fontSize="10" style={{ fontFamily: 'var(--mono)' }} fill={idx >= 1 ? '#3a2bff' : '#555c6a'}>
              {['BOM', 'AMD +145m', 'DEL +170m', 'BLR'][idx]}
            </text>
          </g>
        ))}
        <text x="20" y="96" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#0b0f17">TAIL VT-IFU · 4-SECTOR CASCADE</text>
      </svg>
    ),
  },
  {
    n: '02 · SELECTIVE WEATHER',
    h: '8 peer runway takeoffs',
    p: 'Proves adjacent jets departed the identical runway during the airline’s alleged “unflyable weather” window.',
    says: 'VIDP RWY 28 logged 8 clean departures under 6,000m VMC METAR while 6E-214 blamed storms.',
    viz: (
      <svg viewBox="0 0 300 120">
        <line x1="20" y1="78" x2="280" y2="78" {...stroke} />
        <line x1="20" y1="84" x2="280" y2="84" stroke="#d8d9e2" strokeDasharray="6 6" />
        {[36, 66, 96, 126, 156, 186, 216, 246].map((x) => (
          <rect key={x} x={x} y="34" width="12" height="36" fill="#3a2bff" opacity="0.88" />
        ))}
        <text x="20" y="22" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#3a2bff">8 DEPARTURES · IDENTICAL RWY 28</text>
        <text x="20" y="104" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#555c6a">METAR VMC 6000M · FLYABLE</text>
      </svg>
    ),
  },
  {
    n: '03 · CREW DUTY EXPIRY',
    h: 'FDTL / FAR 117 timeout',
    p: 'Flags cockpit & cabin crew exceeding statutory duty ceilings with zero standby reserve crew scheduled at base.',
    says: 'Flight deck hit 12.2h / 12.0h DGCA FDTL ceiling in Mumbai. Crew shortage is never extraordinary weather.',
    viz: (
      <svg viewBox="0 0 300 120">
        <rect x="24" y="42" width="210" height="16" fill="#e9eaef" />
        <rect x="24" y="42" width="252" height="16" fill="#3a2bff" />
        <line x1="234" y1="30" x2="234" y2="70" stroke="#c41e3a" strokeWidth="2" strokeDasharray="3 3" />
        <text x="24" y="28" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#0b0f17">LOGGED: 12.2H DUTY</text>
        <text x="172" y="88" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#c41e3a">FDTL CAP: 12.0H</text>
      </svg>
    ),
  },
  {
    n: '04 · FAA / DGCA SLOT AUDIT',
    h: 'Zero ATC Ground Delay',
    p: 'Cross-checks FAA NAS Advisories and Eurocontrol ATFM bulletins whenever an airline blames air-traffic flow control.',
    says: 'No FAA Ground Delay Program or airspace closure existed at KJFK between 10:00 and 15:00 UTC.',
    viz: (
      <svg viewBox="0 0 300 120">
        {['METAR', 'FAA GDP', 'EUROCTRL'].map((s, idx) => (
          <g key={s} transform={`translate(${18 + idx * 92} 32)`}>
            <rect width="84" height="54" fill="#fff" stroke="#d8d9e2" />
            <text x="8" y="20" fontSize="10" style={{ fontFamily: 'var(--mono)' }} fill="#555c6a">{s}</text>
            <text x="8" y="42" fontSize="12" fontWeight="700" style={{ fontFamily: 'var(--sans)' }} fill="#177245">CLEAR</text>
          </g>
        ))}
      </svg>
    ),
  },
  {
    n: '05 · TARMAC CONFINEMENT',
    h: 'Pushback to wheels-up',
    p: 'Measures door-close to takeoff duration on ADS-B ground squawk logs against US DOT 3-hour & UK261 rules.',
    says: 'G-EUUR held on Heathrow stand/taxiway 195 minutes with no gate return — breaching tarmac charter.',
    viz: (
      <svg viewBox="0 0 300 120">
        <line x1="20" y1="64" x2="280" y2="64" stroke="#d8d9e2" strokeWidth="2" />
        <line x1="20" y1="64" x2="245" y2="64" stroke="#c41e3a" strokeWidth="5" />
        <line x1="190" y1="36" x2="190" y2="92" stroke="#0b0f17" strokeDasharray="3 3" />
        <text x="20" y="34" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#c41e3a">DOOR CLOSED → 3H 15M HOLD</text>
        <text x="155" y="106" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#0b0f17">STATUTORY CAP 3H</text>
      </svg>
    ),
  },
  {
    n: '06 · SIGNED ADS-B PACKET',
    h: 'One-click legal docket',
    p: 'Bundles timestamped lat/lon/alt transponder pings, raw METAR, and statute citation into a SHA-256 JSON claim packet.',
    says: 'Packet AT-VTIFU sealed with 5 Mode-S coordinates & SHA-256 proof for immediate €600 / $650 / ₹10,000 filing.',
    viz: (
      <svg viewBox="0 0 300 120">
        <rect x="24" y="24" width="252" height="72" fill="#0b0f17" />
        <text x="36" y="46" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#b9b5ff">SHA256: adsb-sha256:8f9c2a...</text>
        <text x="36" y="64" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#8fe3c0">28.5562N 77.1000E ALT 0ft RWY28</text>
        <text x="36" y="82" fontSize="10.5" style={{ fontFamily: 'var(--mono)' }} fill="#fff">PAYOUT ELIGIBLE: ₹10,000 DGCA</text>
      </svg>
    ),
  },
]

function Detectors() {
  return (
    <section className="sec" id="product" aria-labelledby="causes-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head">
            <h2 className="h2" id="causes-title">Six detectors built for every airline exemption excuse.</h2>
            <p className="lead">When a carrier invokes extraordinary circumstances, AirTruth audits tail history, adjacent runways, METARs, and crew hours to surface legal proof.</p>
          </Reveal>
          <div className="cause-grid">
            {DETECTORS.map((c, i) => (
              <Reveal className="cause" key={c.n} kind="wipe" delay={(i % 3) * 0.1 + Math.floor(i / 3) * 0.08}>
                <span className="num-tag">{c.n}</span>
                <h3>{c.h}</h3>
                <p>{c.p}</p>
                <div className="viz" aria-hidden="true">{c.viz}</div>
                <p className="says"><b>AIRTRUTH PROVES</b>{c.says}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Passenger Advantage & Extraction Capabilities ---------- */
const PLATFORMS: [string, 'live' | 'next'][] = [
  ['Tail-Number 4-Leg Chaining', 'live'],
  ['Live NOAA METAR Weather Fetch', 'live'],
  ['Parallel Runway Departure Counter', 'live'],
  ['Crew FDTL / FAR 117 Duty Check', 'live'],
  ['PNR SMS Flight & Route Extractor', 'live'],
  ['Signed SHA-256 Claim Packet (.json)', 'live'],
  ['Pre-Filled Airline Demand Letter', 'live'],
  ['Official Regulator PDF Export', 'next'],
]

const THEMES = [
  { id: 'indigo', label: 'IndiGo', flight: 'indigo-crew-timeout', c: '#1b2b9c' },
  { id: 'delta', label: 'Delta', flight: 'delta-tail-chain', c: '#c41e3a' },
  { id: 'ba', label: 'British Airways', flight: 'ba-selective-weather', c: '#075aaa' },
  { id: 'neutral', label: 'Neutral', flight: 'indigo-selective-weather', c: '#111624' },
] as const

function useStudioSession(near: boolean) {
  const [sid, setSid] = useState<string | null>(null)
  useEffect(() => {
    if (!near) return
    Promise.all([
      import('../../widget/element'),
      fetch('/v1/demo/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ preset: 'signature' }) }).then((r) => r.json()),
    ])
      .then(async ([, s]) => {
        await fetch(`/v1/demo/sessions/${s.id}/advance`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ progress: 0.72 }) })
        setSid(s.id)
      })
      .catch(() => { })
  }, [near])
  return sid
}

function PassengerAdvantage() {
  const studio = useRef<HTMLDivElement>(null)
  const sid = useStudioSession(useInView(studio, { once: true, margin: '400px 0px' }))
  const [theme, setTheme] = useState<string>('indigo')
  const cur = THEMES.find((t) => t.id === theme) ?? THEMES[0]
  return (
    <section className="sec sdk-sec" id="compare" aria-labelledby="compare-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head wide">
            <h2 className="h2" id="compare-title">Trackers show <em>when</em> you landed. AIRTRUTH gives you the radar receipt.</h2>
            <p className="lead">Everything runs right on this website: paste your flight code or PNR SMS above, verify whether other jets departed the same runway cleanly, and download your own signed statutory demand packet—keep 100% of your payout.</p>
          </Reveal>
          <div className="contract" style={{ marginBottom: 48 }}>
            <Reveal><b>Flightradar24 / FlightAware</b><p>Show live map dots and raw delay minutes, but leave you on your own to look up METARs, prove selective weather lies, or cite EU261 / DGCA / US DOT law.</p></Reveal>
            <Reveal delay={0.06}><b>ExpertFlyer / Flighty</b><p>Paid pro tools surface internal airline GDS codes or FAA tower alerts—great for status, not built to output SHA-256 passenger claim packets or grievance letters.</p></Reveal>
            <Reveal delay={0.12}><b>AirHelp / Claims Agencies</b><p>Charge ~25–35%+ of your statutory payout to file paperwork. AIRTRUTH builds your exact radar contradiction docket and pre-written demand letter right here for zero fee.</p></Reveal>
          </div>
          <div className="sdk-grid">
            <Reveal className="studio" kind="scale">
              <DitherShader cell={3} scale={180} bias={-0.25} rise={0.6} alpha={0.45} />
              <div className="theme-pick" role="group" aria-label="Preview carrier theme">
                {THEMES.map((t) => (
                  <button key={t.id} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                    <i style={{ background: t.c }} />{t.label}
                  </button>
                ))}
              </div>
              <div className="studio-widget" ref={studio}>
                {sid ? (
                  <airtruth-flight session={sid} flight={cur.flight} variant="flight-card" theme={theme} />
                ) : (
                  <div className="answer"><div className="a-head"><span className="label">Loading live telemetry card…</span></div></div>
                )}
              </div>
              <p className="studio-cap">Inspect live passenger evidence cards across IndiGo, Delta, and British Airways.</p>
            </Reveal>
            <Reveal className="platforms" kind="right">
              <h3 className="h3">Extracted automatically from a single Flight No.</h3>
              <ul>
                {PLATFORMS.map(([n, st]) => (
                  <li key={n}><span>{n}</span><span className={`pill ${st}`}>{st === 'live' ? 'Active on site' : 'Roadmap'}</span></li>
                ))}
              </ul>
              <More href="/lookup" label="Open standalone Flight Lookup tool" />
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Grounded telemetry fusion ---------- */
const INS = [
  ['ADS-B Mode-S', 'Tail hex & 4 prior legs'],
  ['METAR / TAF', 'Visibility, ceiling, RVR'],
  ['Runway Slots', 'Parallel takeoff count'],
  ['FDTL & NAS', 'Crew hours & FAA GDP'],
]
const OUTS = [
  ['Passenger UI', '<airtruth-flight> card'],
  ['Signed Packet', 'SHA-256 ADS-B coordinates'],
  ['Claim Charter', 'EU261 · US DOT · DGCA'],
  ['Alert Webhooks', 'Ops & legal escalations'],
]

function Grounded() {
  const reduce = useReducedMotion()
  return (
    <section className="sec on-mist" aria-labelledby="grounded-title">
      <DitherShader cell={3} scale={240} bias={-0.18} rise={0.55} alpha={0.55} />
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head center">
            <h2 className="h2" id="grounded-title">Public radar beats airline boilerplate. Every time.</h2>
            <p className="lead">AirTruth fuses transponder history, airport meteorology, and parallel departures into one signed timeline before generating a passenger claim packet.</p>
          </Reveal>
          <div className="flow">
            <div className="flow-col">
              {INS.map(([b, l], i) => (
                <Reveal className="node" kind="left" key={b} delay={i * 0.08}><b>{b}</b><span className="label">{l}</span></Reveal>
              ))}
            </div>
            <div className="core">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                {[-30, -10, 10, 30].map((dy, i) => (
                  <g key={i}>
                    <path d={`M-20 ${50 + dy * 1.2} C 10 ${50 + dy}, 20 50, 30 50`} stroke="rgb(11 15 23 / .2)" fill="none" vectorEffect="non-scaling-stroke" />
                    <path d={`M70 50 C 80 50, 90 ${50 + dy}, 120 ${50 + dy * 1.2}`} stroke="rgb(11 15 23 / .2)" fill="none" vectorEffect="non-scaling-stroke" />
                    {!reduce && <motion.circle r="1.2" fill="#3a2bff" animate={{ cx: [-20, 30], cy: [50 + dy * 1.2, 50] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45, ease: 'easeInOut' }} />}
                    {!reduce && <motion.circle r="1.2" fill="#3a2bff" animate={{ cx: [70, 120], cy: [50, 50 + dy * 1.2] }} transition={{ duration: 1.8, repeat: Infinity, delay: 0.9 + i * 0.45, ease: 'easeInOut' }} />}
                  </g>
                ))}
              </svg>
              <div className="core-in"><span className="label">Fused Engine</span><b>AIRTRUTH</b><span className="label">detects · rebuts · seals</span></div>
            </div>
            <div className="flow-col">
              {OUTS.map(([b, l], i) => (
                <Reveal className="node" kind="right" key={b} delay={0.3 + i * 0.08}><b>{b}</b><span className="label">{l}</span></Reveal>
              ))}
            </div>
          </div>
          <div className="contract">
            <Reveal><b>Rebuts “Weather” with physics</b><p>Eight widebodies taking off from the same runway under VMC visibility is hard proof against extraordinary-weather denials.</p></Reveal>
            <Reveal delay={0.06}><b>4-leg aircraft memory</b><p>Tracks each registration tail back across prior hubs so morning mechanical or crew timeouts aren’t relabeled as evening weather.</p></Reveal>
            <Reveal delay={0.12}><b>Cryptographic coordinate receipts</b><p>Every packet seals ICAO24 hex, UTC timestamps, latitude/longitude, and altitude under deterministic SHA-256 verification.</p></Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Night band: policy + 3 carrier decks ---------- */
const POLICY_YAML = `# deterministic statutory charter rules
statutes:
  eu261:  { min_delay_min: 180, tiers_eur: [250, 400, 600] }
  us_dot: { min_delay_min: 180, auto_refund_usd: 650, tarmac_max_min: 180 }
  dgca:   { min_delay_min: 120, tiers_inr: [5000, 7500, 10000] }
rebuttal_detectors:
  tail_chain_lookback_legs: 4
  selective_weather_min_peer_takeoffs: 3
  crew_fdtl_overage_exempts_weather: true
signing:
  algorithm: adsb-sha256
`

function Policy() {
  return (
    <section className="sec" id="policy" aria-labelledby="policy-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head">
            <h2 className="h2" id="policy-title">Deterministic statute math. Signed coordinates, not guesses.</h2>
            <p className="lead">Compensation tiers, rebuttal thresholds, and regulatory charters are encoded as versioned policy. Once telemetry contradicts an excuse, the payout packet is automatic.</p>
          </Reveal>
          <div className="policy">
            <Reveal kind="wipe"><CodeBlock tabs={[{ label: 'statutes/charters.yaml', file: 'statutes/charters.yaml', lang: 'yaml', code: POLICY_YAML }]} /></Reveal>
            <div className="decisions">
              {[
                ['6E-214 · VT-IFU · ₹10,000 DGCA', 'Weather claim rebutted: Mumbai crew FDTL timeout 6h prior', '4-leg rotation chain slipped +170m + 8 peer departures off VIDP RWY 28.', 'auto', 'Rebutted'],
                ['DL-418 · N842DN · $650 US DOT §260', 'ATC flow excuse rebutted: Zero FAA Ground Delay Program', 'APU defect at BOS cascaded through ATL/ORD/DTW; FAR 117 timeout hit at JFK.', 'auto', 'Sealed'],
                ['BA-117 · G-XWBA · €600 EU261', 'Heathrow fog denial overturned: 8 jets departed RWY 27R', 'EGLL METAR 8000m VMC; Wallentin-Hermann extraordinary exemption invalid.', 'human', 'Filed'],
              ].map(([id, h, p, c, l], k) => (
                <Reveal className="decision" kind="right" key={id} delay={0.2 + k * 0.1}>
                  <div className="decision-top"><span className="label">{id}</span><span className={`chip ${c}`}>{l}</span></div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="guards">
            {[
              ['Exact tail ID always', 'Matches Mode-S ICAO24 hex so airlines cannot swap airframe narratives mid-claim.'],
              ['Simultaneous runway check', 'Proves peer aircraft departed safely on the same runway within minutes.'],
              ['Statute-grounded amounts', 'Computes €250/€400/€600, $650, or ₹5,000–₹10,000 strictly from statute distance & delay.'],
              ['Signed ADS-B receipt', 'Exports immutable coordinate hashes ready for AirSewa, US DOT, UK CAA, and EU NEB filing.'],
            ].map(([b, s]) => <div key={b}><b>{b}</b><span>{s}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  )
}

function Deck() {
  const slugs: Slug[] = ['indigo', 'delta', 'ba']
  return (
    <section className="sec" aria-labelledby="deck-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <Reveal className="sec-head wide">
            <h2 className="h2" id="deck-title">Three airlines. Three aviation regimes. One truth engine.</h2>
            <p className="lead">Explore synthetic live flight sandboxes and statutory audit breakdowns for IndiGo, Delta, and British Airways.</p>
          </Reveal>
          <div className="deck">
            {slugs.map((slug, i) => {
              const s = STUDIES[slug]
              return (
                <motion.a
                  key={slug}
                  className="case-card"
                  href={`/case-studies/${slug}`}
                  initial={{ opacity: 0, y: 40, rotate: i === 0 ? -1.5 : i === 2 ? 1.5 : 0 }}
                  whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                  viewport={{ once: true, margin: '-80px 0px' }}
                  transition={{ duration: 1, ease: EASE, delay: i * 0.1 }}
                >
                  <DitherShader className="" cell={3} scale={140} bias={-0.1} rise={0.5} alpha={0.9} />
                  <div className="top"><span className="label">Audit {String(i + 1).padStart(2, '0')}</span><span className="label">Read →</span></div>
                  <h3>{s.name}</h3>
                  <p className="kind">{s.regime}</p>
                  <div className="meter">
                    <span className="label"><span>Weather claims rebutted</span><span>{s.rebuttedShare}%</span></span>
                    <div className="segs">{Array.from({ length: 10 }, (_, k) => <i key={k} className={k < Math.round(s.rebuttedShare / 10) ? 'on' : ''} />)}</div>
                  </div>
                  <ul>
                    {s.claimCats.slice(0, 3).map(([cat, pct]) => (
                      <li key={cat}><span>{cat}</span><span>{pct}%</span></li>
                    ))}
                  </ul>
                </motion.a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- FAQ ---------- */
function Faq() {
  return (
    <section className="sec" id="faq" aria-labelledby="faq-title">
      <div className="frame"><Cols />
        <div className="sec-in faq">
          <Reveal className="faq-head">
            <h2 className="h2" id="faq-title">Questions passengers ask first.</h2>
            <p className="lead">Straight answers on how claims work. See the <a className="more" href="/method">verification method</a> for full statutory formulas.</p>
          </Reveal>
          <div className="faq-list">
            {FAQ.map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>
                  <span className="faq-n num">{String(i + 1).padStart(2, '0')}</span>
                  <span className="faq-q">{q}</span>
                  <Plus className="faq-x" size={20} aria-hidden="true" />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------- Close ---------- */
function Close() {
  return (
    <section className="close" aria-labelledby="close-title">
      <Photo className="close-photo" base="flight-deck-weather" alt="Rain on cockpit windshield looking out at runway approach lights" />
      <DitherShader color={[255, 255, 255]} cell={3} scale={200} bias={-0.25} rise={0.5} alpha={0.3} />
      <div className="frame">
        <div className="close-in">
          <h2 id="close-title">Prove the lie on radar before the gate closes.</h2>
          <div className="ctas">
            <a className="btn" href="/lookup">Check your flight now <ArrowRight size={16} aria-hidden="true" /></a>
            <a className="btn ghost" href="/demos">Try 3-airline radar demo</a>
          </div>
        </div>
      </div>
    </section>
  )
}
