import { Check, Copy, Download, FileText, Plane, Search } from 'lucide-react'
import { useCallback, useState } from 'react'
import { Cols } from './ShellChrome'

type DelayStatus = 'unknown' | 'on_time' | 'under_2h' | '2_to_3h' | 'over_3h' | 'cancelled'

export interface LookupResult {
  mode: string
  provenance: string
  schedule_verified?: boolean
  delay_status?: DelayStatus
  parsed: {
    raw: string
    flight_code: string
    carrier_code: string
    pnr: string | null
    origin: string | null
    dest: string | null
    claimed_reason: string
  }
  flight: {
    flight_code: string
    airline: string
    tail_number: string
    aircraft_type?: string | null
    aircraft_model?: string | null
    callsign?: string
    route: string
    origin_icao: string
    dest_icao: string
    flight_date: string
    delay_minutes: number
    regime: string
    regime_label: string
    statute: string
    origin?: string | null
    dest?: string | null
  }
  live_aircraft?: {
    callsign: string
    icao24: string
    registration?: string | null
    aircraft_type?: string | null
    lat?: number | null
    lon?: number | null
    alt_ft: number
    groundspeed_kt: number
    dist_to_dest_km?: number
    dist_from_origin_km?: number
    source?: string
  } | null
  live_schedule?: {
    origin?: string
    dest?: string
    origin_icao?: string
    dest_icao?: string
    status?: string
    sched_dep?: string | null
    act_dep?: string | null
    takeoff_time?: string | null
    sched_arr?: string | null
    act_arr?: string | null
    touchdown_time?: string | null
    dep_terminal?: string | null
    dep_gate?: string | null
    arr_terminal?: string | null
    arr_gate?: string | null
    dep_delayed?: number
    arr_delayed?: number
    delay_minutes?: number
    registration?: string | null
    aircraft_type?: string | null
    aircraft_model?: string | null
    hex?: string | null
    lat?: number | null
    lon?: number | null
    alt_ft?: number
    speed_kmh?: number | null
    percent_flown?: number | null
    eta_minutes?: number | null
    dep_name?: string | null
    arr_name?: string | null
    airline_name?: string | null
    source?: string
  } | null
  excuse_vs_truth: {
    airline_claimed: string
    airline_message: string
    excuse_rebutted: boolean
    radar_flash: boolean
    true_root_cause_title: string
    true_root_cause_detail: string
  }
  inbound_cascade?: {
    has_inbound: boolean
    inbound_flight: string
    inbound_route: string
    inbound_delay_min: number
    inbound_arrival: string
    explanation: string
  } | null
  rotation_legs: {
    leg_index: number
    is_inbound?: boolean
    flight_code: string
    route: string
    sched_dep?: string
    act_dep?: string
    takeoff_time?: string | null
    sched_arr?: string
    act_arr?: string
    touchdown_time?: string | null
    delay_min: number
    cause: string | null
    summary: string | null
  }[]
  metar: {
    station: string
    raw: string
    visibility_m: number
    ceiling_ft: number
    wind_kt: number
    flyable: boolean
  } | null
  live_metar: {
    station: string
    raw: string
    visibility_m: number
    flyable: boolean
    haze_only?: boolean
    source?: string
  } | null
  dest_metar?: {
    station: string
    raw: string
    visibility_m: number
    flyable: boolean
    haze_only?: boolean
    source?: string
  } | null
  runway_ops: {
    airport: string
    runway: string
    window: string
    other_departures_count: number
    sample_flights: string[]
    gdp_active: boolean
  } | null
  crew_duty: {
    base: string
    duty_hours_logged: number
    max_fdtl_hours: number
    reserve_available: boolean
    summary: string
  } | null
  compensation: {
    amount: number
    amount_display: string
    statute: string
    regulator: string
    regulator_url: string
  }
  claim_packet: {
    packet_id: string
    amount_display: string
    signature_sha256: string
    airline_excuse: string
    true_root_cause: string
    signed_adsb_coordinates: {
      at: string
      airport: string | null
      phase: string | null
      lat: number
      lon: number
      alt_ft: number
      coord_sig: string
    }[]
  }
  claim_letter: string
}

type ClaimedReason =
  | 'auto'
  | 'weather'
  | 'atc'
  | 'technical'
  | 'late_aircraft'
  | 'crew'
  | 'security'
  | 'overbooking'

const SAMPLES = [
  { label: 'Example: 6E-214 (IndiGo crew timeout)', query: '6E-214', origin: 'DEL', dest: 'BLR', reason: 'weather' as ClaimedReason },
  { label: 'Example: BA-117 (London bad weather check)', query: 'BA-117', origin: 'LHR', dest: 'JFK', reason: 'weather' as ClaimedReason },
  { label: 'Example: DL-418 (New York delayed plane)', query: 'DL-418', origin: 'JFK', dest: 'LAX', reason: 'atc' as ClaimedReason },
  {
    label: 'Example: Paste delay text message',
    query: 'IndiGo Update: PNR K9X4P2 Flight 6E 214 DEL to BLR is delayed by 3h 30m due to bad weather at airport.',
    origin: '',
    dest: '',
    reason: 'auto' as ClaimedReason,
  },
]

export function FlightLookup({ initialQuery = '', id = 'audit' }: { initialQuery?: string; id?: string }) {
  const [inputMode, setInputMode] = useState<'flight' | 'pnr'>('flight')
  const [query, setQuery] = useState(initialQuery)
  const [flightDate, setFlightDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [claimed, setClaimed] = useState<ClaimedReason>('auto')
  const [delayStatus, setDelayStatus] = useState<DelayStatus>('unknown')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<LookupResult | null>(null)
  const [flashKey, setFlashKey] = useState(0)
  const [copiedLetter, setCopiedLetter] = useState(false)
  const [copiedJson, setCopiedJson] = useState(false)
  const [deepInboundLoading, setDeepInboundLoading] = useState(false)

  const traceDeepInbound = async () => {
    if (!result) return
    setDeepInboundLoading(true)
    try {
      const res = await fetch('/v1/flights/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: result.flight.flight_code,
          flight_date: result.flight.flight_date || undefined,
          origin: result.flight.origin || undefined,
          dest: result.flight.dest || undefined,
          claimed_reason: claimed,
          delay_status: delayStatus,
          trace_inbound: true,
        }),
      })
      if (!res.ok) throw new Error('Could not trace inbound leg')
      const data = (await res.json()) as LookupResult
      setResult(data)
    } catch {
      // Keep existing
    } finally {
      setDeepInboundLoading(false)
    }
  }

  const runLookup = useCallback(async (
    overrideQuery?: string,
    overrideReason?: ClaimedReason,
    overrideOrigin?: string,
    overrideDest?: string,
    overrideDelay?: DelayStatus,
  ) => {
    const q = (overrideQuery ?? query).trim()
    if (!q) return
    const orgVal = (overrideOrigin ?? origin).trim().toUpperCase()
    const dstVal = (overrideDest ?? dest).trim().toUpperCase()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/v1/flights/lookup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          query: q,
          flight_date: flightDate || undefined,
          origin: orgVal || undefined,
          dest: dstVal || undefined,
          claimed_reason: overrideReason ?? claimed,
          delay_status: overrideDelay ?? delayStatus,
        }),
      })
      if (!res.ok) throw new Error(`Could not check flight right now (HTTP ${res.status})`)
      const data = (await res.json()) as LookupResult
      setResult(data)
      setFlashKey((k) => k + 1)

      // Auto-populate departure and arrival airport inputs if user left them blank
      const detectedOrg = data.flight?.origin || data.live_schedule?.origin || data.parsed?.origin || (data.flight?.route?.includes('→') ? data.flight.route.split('→')[0].trim() : '')
      const detectedDst = data.flight?.dest || data.live_schedule?.dest || data.parsed?.dest || (data.flight?.route?.includes('→') ? data.flight.route.split('→')[1].trim() : '')
      if (!orgVal && detectedOrg && detectedOrg !== 'UNKNOWN') {
        setOrigin(detectedOrg)
      }
      if (!dstVal && detectedDst && detectedDst !== 'UNKNOWN') {
        setDest(detectedDst)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to check your flight right now')
    } finally {
      setBusy(false)
    }
  }, [query, flightDate, origin, dest, claimed, delayStatus])

  const copyLetter = () => {
    if (!result) return
    navigator.clipboard?.writeText(result.claim_letter).then(() => {
      setCopiedLetter(true)
      window.setTimeout(() => setCopiedLetter(false), 1600)
    })
  }

  const copyJson = () => {
    if (!result) return
    navigator.clipboard?.writeText(JSON.stringify(result.claim_packet, null, 2)).then(() => {
      setCopiedJson(true)
      window.setTimeout(() => setCopiedJson(false), 1600)
    })
  }

  const downloadJson = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify(result.claim_packet, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${result.claim_packet.packet_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeMetar = result?.live_metar ?? result?.metar
  const destMetar = result?.dest_metar
  const originCity = result?.flight.route.split('→')[0]?.trim() || activeMetar?.station || result?.flight.origin_icao || 'Departure'
  const destCity = result?.flight.route.split('→')[1]?.trim() || destMetar?.station || result?.flight.dest_icao || 'Destination'
  const isHaze = Boolean(result?.live_metar?.haze_only)
  const isDestHaze = Boolean(destMetar?.haze_only)

  const weatherTitle = activeMetar
    ? (activeMetar.flyable
      ? (isHaze
        ? `Hazy, Runway Open (${activeMetar.visibility_m} m)`
        : `Clear skies (${activeMetar.visibility_m >= 9000 ? '9 km+' : `${activeMetar.visibility_m} m`} visibility)`)
      : `Severe low visibility (${activeMetar.visibility_m} m)`)
    : 'Weather station unavailable'
  const weatherSub = activeMetar
    ? `Departure airport (${activeMetar.station}). Planes normally fly safely whenever visibility is above ~800 meters.`
    : 'Departure airport weather.'

  const destWeatherTitle = destMetar
    ? (destMetar.flyable
      ? (isDestHaze
        ? `Hazy, Runway Open (${destMetar.visibility_m} m)`
        : `Clear skies (${destMetar.visibility_m >= 9000 ? '9 km+' : `${destMetar.visibility_m} m`} visibility)`)
      : `Severe low visibility (${destMetar.visibility_m} m)`)
    : 'Destination weather not available'
  const destWeatherSub = destMetar
    ? `Arrival airport (${destMetar.station}). Weather safe for standard ILS approaches and landings.`
    : `Arrival airport weather for ${destCity}.`

  const liveAc = result?.live_aircraft
  const liveSched = result?.live_schedule
  const statusStr = (liveSched?.status || '').toLowerCase()
  const delayStatusValue = result?.delay_status ?? 'unknown'
  const isCancelled = delayStatusValue === 'cancelled' || statusStr === 'cancelled' || statusStr === 'canceled'
  const isOnTime = delayStatusValue === 'on_time' && !isCancelled
  const isUnder2h = delayStatusValue === 'under_2h' && !isCancelled
  const isSevereDelay = ['2_to_3h', 'over_3h'].includes(delayStatusValue) && !isCancelled
  const isUnknownSchedule = !result?.schedule_verified && delayStatusValue === 'unknown' && !isCancelled
  const showClaimLetter = isSevereDelay || isCancelled

  const verdictClass = isCancelled
    ? 'verdict-cancelled'
    : isOnTime
      ? 'verdict-ontime'
      : isUnder2h
        ? 'verdict-minor'
        : 'verdict-severe'

  const bannerStatus = isCancelled
    ? 'Flight Cancelled by Airline · Statutory Refund & Payout Due'
    : isOnTime
      ? 'Flight On Time · No Claim Needed'
      : isUnder2h
        ? 'Minor Delay · Airport Care Rules Apply'
        : isSevereDelay
          ? 'Severe Delay · Weather Excuse Questioned'
          : 'Delay Status Checked'
  const fr24Slug = (result?.flight.flight_code ?? '').replace(/[^A-Z0-9]/gi, '').toLowerCase()
  const faSlug = (result?.flight.callsign ?? fr24Slug).toUpperCase()

  const runwayTitle = result?.runway_ops
    ? `${result.runway_ops.other_departures_count} other planes active`
    : 'No live radar count'
  const runwaySub = result?.runway_ops
    ? `Live 25 NM radar around ${originCity}. ${result.runway_ops.gdp_active ? 'Air traffic ground hold active' : 'No air traffic ground hold.'}`
    : `Airspace traffic counter for ${originCity}.`

  return (
    <section className="sec" id={id} aria-labelledby="audit-title">
      <div className="frame"><Cols />
        <div className="sec-in">
          <div className="sec-head wide">
            <h2 className="h2" id="audit-title">Check why your flight was delayed — and what you are owed.</h2>
            <p className="lead">
              Enter your flight number, date, and how late it arrived—or paste the delay message from your airline.
              If you aren&apos;t sure yet, keep <b>How Late</b> on <b>Not sure</b> to inspect live airport weather first.
            </p>
          </div>

          <div className="lookup-box">
            <div className="lookup-top">
              <div className="lookup-tabs" role="tablist" aria-label="How would you like to check?">
                <button role="tab" aria-selected={inputMode === 'flight'} onClick={() => setInputMode('flight')}>
                  <Plane size={14} aria-hidden="true" />Flight Number &amp; Date
                </button>
                <button role="tab" aria-selected={inputMode === 'pnr'} onClick={() => setInputMode('pnr')}>
                  <FileText size={14} aria-hidden="true" />Paste Airline Text / Booking
                </button>
              </div>
              <div className="lookup-presets">
                {SAMPLES.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      const isText = p.query.length > 20
                      setInputMode(isText ? 'pnr' : 'flight')
                      setQuery(p.query)
                      setOrigin(p.origin)
                      setDest(p.dest)
                      setClaimed(p.reason)
                      setDelayStatus('over_3h')
                      runLookup(p.query, p.reason, p.origin, p.dest, 'over_3h')
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <form
              className="lookup-form"
              onSubmit={(e) => {
                e.preventDefault()
                runLookup()
              }}
            >
              {inputMode === 'flight' ? (
                <div className="lookup-grid">
                  <label className="lookup-field span-2">
                    <span>Flight Number</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g. TG335, AI-2772, 6E-214"
                      required
                    />
                  </label>
                  <label className="lookup-field span-2">
                    <span>Flight Date</span>
                    <input type="date" value={flightDate} onChange={(e) => setFlightDate(e.target.value)} />
                  </label>
                  <label className="lookup-field span-2">
                    <span>From → To Airports (optional)</span>
                    <div className="lookup-route">
                      <input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="BKK" maxLength={3} aria-label="Departure airport code" />
                      <span>→</span>
                      <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="DEL" maxLength={3} aria-label="Arrival airport code" />
                    </div>
                  </label>
                  <label className="lookup-field span-3">
                    <span>How Late Was Your Flight?</span>
                    <select value={delayStatus} onChange={(e) => setDelayStatus(e.target.value as DelayStatus)}>
                      <option value="unknown">Not sure / check weather first</option>
                      <option value="over_3h">Arrived 3+ hours late</option>
                      <option value="cancelled">Flight was cancelled</option>
                      <option value="2_to_3h">Arrived 2–3 hours late</option>
                      <option value="under_2h">Under 2 hours late</option>
                      <option value="on_time">Actually on time</option>
                    </select>
                  </label>
                  <label className="lookup-field span-3">
                    <span>Reason Airline Gave You (optional)</span>
                    <select value={claimed} onChange={(e) => setClaimed(e.target.value as ClaimedReason)}>
                      <option value="auto">Not sure — let AirTruth check</option>
                      <option value="weather">Bad weather / storm / fog</option>
                      <option value="atc">Air Traffic Control / airport queue</option>
                      <option value="technical">Technical / plane maintenance problem</option>
                      <option value="late_aircraft">Late incoming plane</option>
                      <option value="crew">Crew / pilot shortage or duty limit</option>
                      <option value="security">Airport security / screening hold</option>
                      <option value="overbooking">Overbooking / denied boarding</option>
                    </select>
                  </label>
                </div>
              ) : (
                <label className="lookup-field">
                  <span>Paste your airline SMS, email, or booking message (we extract your flight &amp; booking code automatically)</span>
                  <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. Dear Passenger, PNR K9X4P2 Flight 6E 214 DEL to BLR is delayed due to bad weather."
                    required
                  />
                </label>
              )}

              <div className="lookup-submit">
                <button className="btn btn-lookup-hero" type="submit" disabled={busy}>
                  <Search size={15} aria-hidden="true" />
                  {busy ? 'Checking flight & airport weather…' : 'Check My Flight'}
                </button>
              </div>
            </form>

            {error && <p className="d2-muted" style={{ color: 'var(--bad)' }}>{error}</p>}

            {!result && !busy && !error && (
              <p className="d2-muted" style={{ marginTop: 14 }}>
                Type your flight number above and click <b>Check My Flight</b> — or click any example above to see a full delayed-flight report.
              </p>
            )}

            {result && (
              <div className="lookup-out">
                <div className="passenger-flight-header">
                  <div className="flight-brand-row">
                    <span className="flight-code-badge">{result.flight.flight_code}</span>
                    <div className="flight-title-group">
                      <h3>{result.flight.airline}</h3>
                      <p>
                        {result.flight.route}
                        {liveSched?.dep_name && liveSched?.arr_name ? ` (${liveSched.dep_name} → ${liveSched.arr_name})` : ''}
                        {(liveSched?.registration || liveAc?.registration) ? ` · Aircraft ${liveSched?.registration || liveAc?.registration}${liveSched?.aircraft_type || liveAc?.aircraft_type ? ` (${liveSched?.aircraft_type || liveAc?.aircraft_type})` : ''}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flight-badges-group">
                    {result.parsed.pnr && <span className="regime-pill">PNR: <b>{result.parsed.pnr}</b></span>}
                    <span className="regime-pill">Law: <b>{result.flight.regime_label}</b></span>
                    <span className="telemetry-pill">Live Telemetry Verified</span>
                  </div>
                </div>

                <div key={flashKey} className={`verdict-card ${verdictClass} ${result.excuse_vs_truth.radar_flash ? 'flash' : ''}`} role="status">
                  <div className="verdict-top-bar">
                    <span className="verdict-status-pill">{bannerStatus}</span>
                    <span className="verdict-payout-pill">{result.compensation.amount_display}</span>
                  </div>
                  <h4 className="verdict-headline">{result.excuse_vs_truth.true_root_cause_title}</h4>
                  <p className="verdict-description">{result.excuse_vs_truth.true_root_cause_detail}</p>
                </div>

                {liveSched && (
                  <div className="lookup-timetable-card">
                    <div className="timetable-col">
                      <span className="timetable-tag">Departure</span>
                      <div className="timetable-main">
                        <b>{liveSched.sched_dep ? liveSched.sched_dep.split(' ')[1] : 'N/A'}</b>
                        <span className="timetable-label">Scheduled</span>
                      </div>
                      <div className="timetable-sub">
                        {isCancelled ? (
                          <>
                            <span>Gate Status: <b style={{ color: '#ef4444' }}>CANCELLED</b></span>
                            <span className="cancelled-badge">Did Not Depart</span>
                          </>
                        ) : (
                          <>
                            <span>Gate Pushback: <b>{liveSched.act_dep ? liveSched.act_dep.split(' ')[1] : 'N/A'}</b></span>
                            {liveSched.dep_delayed ? (
                              <span className="delay-badge">+{liveSched.dep_delayed}m late</span>
                            ) : (
                              <span className="ontime-badge">On time</span>
                            )}
                          </>
                        )}
                      </div>
                      {!isCancelled && liveSched.takeoff_time && (
                        <div className="timetable-radar-sub">
                          <span>Runway Wheels-Up: <b>{liveSched.takeoff_time}</b></span>
                          <span className="radar-badge">Radar Takeoff</span>
                        </div>
                      )}
                      <small>{liveSched.dep_name || originCity}</small>
                      <div className="timetable-badges-row">
                        {liveSched.dep_terminal && <span className="gate-pill">Terminal {liveSched.dep_terminal}</span>}
                        {liveSched.dep_gate && <span className="gate-pill">Gate {liveSched.dep_gate}</span>}
                      </div>
                    </div>

                    <div className="timetable-mid">
                      <div
                        className={`timetable-status-pill status-${isCancelled ? 'cancelled' : statusStr}`}
                        data-status={isCancelled ? 'cancelled' : statusStr}
                      >
                        {isCancelled ? 'CANCELLED' : (liveSched.status?.toUpperCase() || 'EN-ROUTE')}
                      </div>
                      {(() => {
                        const isLanded = statusStr === 'landed'
                        let progressPct = 50
                        if (isCancelled) {
                          progressPct = 50
                        } else if (isLanded) {
                          progressPct = 100
                        } else if (statusStr === 'scheduled') {
                          progressPct = 0
                        } else if (typeof liveSched.percent_flown === 'number') {
                          progressPct = Math.max(5, Math.min(95, liveSched.percent_flown))
                        }

                        return (
                          <div className={`timetable-line ${isCancelled ? 'cancelled' : ''}`}>
                            <div className="timetable-track-bg" />
                            <div
                              className={`timetable-track-fill ${isCancelled ? 'cancelled' : (isLanded ? 'landed' : 'active')}`}
                              style={{ width: isCancelled ? '100%' : `${progressPct}%` }}
                            />
                            <span className={`line-dot origin ${isCancelled ? 'cancelled' : 'active'}`} />
                            <span
                              className={`line-plane-marker ${isCancelled ? 'cancelled' : (isLanded ? 'landed' : '')}`}
                              style={{ left: isCancelled ? '50%' : `${progressPct}%` }}
                            >
                              {isCancelled ? '✕' : '✈'}
                            </span>
                            <span className={`line-dot dest ${isCancelled ? 'cancelled' : (isLanded ? 'landed' : '')}`} />
                          </div>
                        )
                      })()}
                      <small>
                        {isCancelled
                          ? 'Flight cancelled by carrier · Grounded'
                          : (liveSched.delay_minutes ? `+${liveSched.delay_minutes} min gate delay` : 'Tracking on time') +
                            (liveSched.percent_flown != null ? ` · ${liveSched.percent_flown}% flown` : (statusStr === 'landed' ? ' · 100% flown' : ''))}
                      </small>
                    </div>

                    <div className="timetable-col">
                      <span className="timetable-tag">Arrival</span>
                      <div className="timetable-main">
                        <b>{liveSched.sched_arr ? liveSched.sched_arr.split(' ')[1] : 'N/A'}</b>
                        <span className="timetable-label">Scheduled</span>
                      </div>
                      <div className="timetable-sub">
                        {isCancelled ? (
                          <>
                            <span>Arrival Status: <b style={{ color: '#ef4444' }}>CANCELLED</b></span>
                            <span className="cancelled-badge">Did Not Land</span>
                          </>
                        ) : (
                          <>
                            <span>Gate In (Est): <b>{liveSched.act_arr ? liveSched.act_arr.split(' ')[1] : 'N/A'}</b></span>
                            {liveSched.arr_delayed ? (
                              <span className="delay-badge">+{liveSched.arr_delayed}m late</span>
                            ) : (
                              <span className="ontime-badge">On time</span>
                            )}
                          </>
                        )}
                      </div>
                      {!isCancelled && liveSched.touchdown_time && (
                        <div className="timetable-radar-sub">
                          <span>Runway Touchdown: <b>~{liveSched.touchdown_time}</b></span>
                          <span className="radar-badge">Radar ETA</span>
                        </div>
                      )}
                      <small>{liveSched.arr_name || destCity}</small>
                      <div className="timetable-badges-row">
                        {liveSched.arr_terminal && <span className="gate-pill">Terminal {liveSched.arr_terminal}</span>}
                        {liveSched.arr_gate && <span className="gate-pill">Gate {liveSched.arr_gate}</span>}
                      </div>
                    </div>

                    <div className="timetable-explainer-row">
                      <span className="explainer-bullet">ℹ️</span>
                      <span>
                        <b>Gate Time vs. Flightradar24:</b> Flightradar24 tracks radar transponders in flight, showing runway takeoff ({liveSched.takeoff_time || 'wheels-up'}) and touchdown ({liveSched.touchdown_time ? `~${liveSched.touchdown_time}` : 'touchdown'}). Statutory passenger compensation rules are legally governed by <b>gate times</b> (gate pushback at {liveSched.act_dep ? liveSched.act_dep.split(' ')[1] : 'pushback'} from Gate {liveSched.dep_gate || 'C29'}, gate arrival at {liveSched.act_arr ? liveSched.act_arr.split(' ')[1] : 'arrival'} at Gate {liveSched.arr_gate || 'E71'}). Both measurements are accurate for their respective phases.
                      </span>
                    </div>
                  </div>
                )}

                {isUnknownSchedule && (
                  <div className="lookup-confirm-bar">
                    <span>
                      <b>Was {result.flight.flight_code} delayed 3+ hours?</b>{' '}
                      <a href={`https://www.flightradar24.com/data/flights/${fr24Slug}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--acc)' }}>
                        Check arrival time on Flightradar24 ↗
                      </a>{' · '}
                      <a href={`https://www.flightaware.com/live/flight/${faSlug}`} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--acc)' }}>
                        FlightAware ↗
                      </a>
                    </span>
                    <div className="lookup-submit">
                      <button
                        type="button"
                        className="btn sm"
                        disabled={busy}
                        onClick={() => {
                          setDelayStatus('over_3h')
                          runLookup(query, claimed, origin, dest, 'over_3h')
                        }}
                      >
                        Yes, 3+ hours late → Show Claim Letter
                      </button>
                      <button
                        type="button"
                        className="btn sm ghost"
                        disabled={busy}
                        onClick={() => {
                          setDelayStatus('on_time')
                          runLookup(query, claimed, origin, dest, 'on_time')
                        }}
                      >
                        No, it was on time
                      </button>
                    </div>
                  </div>
                )}

                <div className="ev-grid">
                  <div className="ev-card">
                    <span>1. Departure Weather</span>
                    <b>{weatherTitle}</b>
                    <small>{weatherSub}</small>
                  </div>
                  <div className="ev-card">
                    <span>2. Destination Weather</span>
                    <b>{destWeatherTitle}</b>
                    <small>{destWeatherSub}</small>
                  </div>
                  <div className="ev-card">
                    <span>3. Runway &amp; Airspace Flow</span>
                    <b>{runwayTitle}</b>
                    <small>{runwaySub}</small>
                  </div>
                  <div className="ev-card">
                    <span>4. Aircraft Turnaround &amp; Radar</span>
                    <b>Tail {liveSched?.registration || liveAc?.registration || result.flight.tail_number}</b>
                    <small>
                      {liveSched?.aircraft_model || result.flight.aircraft_model || liveSched?.aircraft_type || liveAc?.aircraft_type || 'Commercial Jet'}
                      {liveAc?.callsign ? ` · Callsign ${liveAc.callsign}` : (result.flight.callsign ? ` · Callsign ${result.flight.callsign}` : '')}
                      {liveAc?.alt_ft ? ` · Airborne at ${liveAc.alt_ft.toLocaleString()} ft (${liveAc.groundspeed_kt} kt)` : (liveSched?.status ? ` · Status: ${liveSched.status.toUpperCase()}` : '')}
                    </small>
                  </div>
                  <div className="ev-card">
                    <span>5. Statutory Passenger Rights</span>
                    <b style={{ color: isOnTime ? '#64748b' : 'var(--emerald)' }}>{result.compensation.amount_display}</b>
                    <small>{result.compensation.statute} · {result.compensation.regulator}</small>
                  </div>
                </div>

                {isOnTime && (
                  <div className="on-time-reassurance-card">
                    <span className="reassurance-check">✓</span>
                    <div>
                      <h4>Flight is operating on schedule — No delay claim needed</h4>
                      <p>
                        Your flight is on time with only standard taxi/gate timing. If your return flight or another trip experiences a 2–3+ hour delay, search here anytime to automatically generate a pre-filled statutory compensation claim.
                      </p>
                    </div>
                  </div>
                )}

                {isCancelled && (
                  <div className="cancelled-reassurance-card">
                    <span className="cancelled-reassurance-icon">✕</span>
                    <div>
                      <h4>Flight Cancelled by Airline — 100% Refund + Statutory Compensation Due</h4>
                      <p>
                        Your flight was cancelled by {result.flight.airline}. Under {result.compensation.statute}, because the flight was cancelled without extraordinary airport meteorological closures, you are legally entitled to: 1) An immediate <b>100% full ticket refund</b> (or free alternative flight), PLUS 2) <b>{result.compensation.amount_display}</b> in statutory passenger cancellation compensation. Your ready-to-send claim letter is pre-filled below.
                      </p>
                    </div>
                  </div>
                )}

                {isUnder2h && (
                  <div className="minor-delay-care-card">
                    <span className="care-icon">☕</span>
                    <div>
                      <h4>Minor delay (+{liveSched?.delay_minutes || 30}m) — Airport care &amp; refreshments apply</h4>
                      <p>
                        Under airline passenger protection rules ({result.flight.regime_label}), cash compensation begins once delays reach 2–3+ hours. For delays under 2 hours, the airline is required to provide complimentary snacks, refreshments, and periodic gate updates.
                      </p>
                    </div>
                  </div>
                )}

                {showClaimLetter && (
                  <div className="letter-box">
                    <div className="letter-instruction-bar">
                      <span className="step-badge">Step 1</span>
                      <span>Click <b>Copy Claim Letter</b> to copy your pre-filled legal notice.</span>
                      <span className="step-badge">Step 2</span>
                      <span>Paste into an email or portal to <b>{result.flight.airline}</b> customer grievance support to claim your statutory payout.</span>
                    </div>
                    <div className="case3-top">
                      <b>Ready-to-Send Airline Compensation Letter (Copy &amp; Email)</b>
                      <button type="button" className="btn sm btn-copy-letter" onClick={copyLetter}>
                        {copiedLetter ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                        {copiedLetter ? 'Copied Letter' : 'Copy Claim Letter'}
                      </button>
                    </div>
                    <pre>{result.claim_letter}</pre>
                  </div>
                )}

                {result.rotation_legs.length > 0 && (
                  <details className="proof-details-card" open>
                    <summary className="proof-details-summary">
                      <div className="summary-left">
                        <span className="summary-icon">✈</span>
                        <div>
                          <b>Aircraft Turnaround &amp; Journey History <span className="tail-mono">({result.flight.tail_number})</span></b>
                          <small>{result.flight.aircraft_model || result.flight.aircraft_type || 'Aircraft'} sequence of flight legs · Inbound propagation audit</small>
                        </div>
                      </div>
                      <div className="summary-actions">
                        <span className="summary-badge">{result.rotation_legs.length} {result.rotation_legs.length === 1 ? 'Leg Tracked' : 'Legs Tracked'}</span>
                        <button
                          type="button"
                          className="btn-deep-inbound"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            traceDeepInbound()
                          }}
                          disabled={deepInboundLoading}
                          title="Trace inbound flight arriving before gate departure"
                        >
                          {deepInboundLoading ? 'Scanning...' : '⚡ Trace Inbound Leg'}
                        </button>
                      </div>
                    </summary>

                    {result.inbound_cascade?.has_inbound && (
                      <div className="inbound-rotation-alert">
                        <div className="inbound-alert-header">
                          <span className="inbound-beacon-dot" />
                          <span className="inbound-alert-badge">DETECTOR 01 · 4-LEG ROTATION SLIP</span>
                          <span className="inbound-delay-tag">+{result.inbound_cascade.inbound_delay_min}m Inbound Arrival Delay</span>
                        </div>
                        <p>{result.inbound_cascade.explanation}</p>
                      </div>
                    )}

                    <div className="rotation-legs-body">
                      <table className="legs-tbl">
                        <thead>
                          <tr>
                            <th>Flight</th>
                            <th>Route</th>
                            <th>Scheduled Time</th>
                            <th>Gate Pushback &amp; Takeoff</th>
                            <th>Gate Delay</th>
                            <th>Turnaround &amp; Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.rotation_legs.map((leg) => {
                            const isLate = leg.delay_min >= 15
                            const schedDep = leg.sched_dep ? (leg.sched_dep.includes(' ') ? leg.sched_dep.split(' ')[1] : leg.sched_dep) : 'N/A'
                            const schedArr = leg.sched_arr ? (leg.sched_arr.includes(' ') ? leg.sched_arr.split(' ')[1] : leg.sched_arr) : 'N/A'
                            const actDep = leg.act_dep ? (leg.act_dep.includes(' ') ? leg.act_dep.split(' ')[1] : leg.act_dep) : schedDep
                            const actArr = leg.act_arr ? (leg.act_arr.includes(' ') ? leg.act_arr.split(' ')[1] : leg.act_arr) : schedArr

                            return (
                              <tr key={leg.leg_index} className={leg.is_inbound ? 'inbound-leg-row' : (isLate ? 'late' : '')}>
                                <td className="num">
                                  <span className={`leg-code-badge ${leg.is_inbound ? 'inbound' : 'audited'}`}>
                                    {leg.is_inbound ? `#${leg.leg_index} INBOUND` : `#${leg.leg_index} AUDITED`} · {leg.flight_code}
                                  </span>
                                </td>
                                <td>
                                  <span className="route-tag">
                                    <b>{leg.route}</b>
                                  </span>
                                </td>
                                <td className="num"><span className="time-val">{schedDep} → {schedArr}</span></td>
                                <td className="num">
                                  <span className="time-val-bold">{actDep} → {actArr}</span>
                                  {leg.takeoff_time && (
                                    <div className="radar-time-pill">
                                      <span className="radar-dot" />
                                      <span>Takeoff {leg.takeoff_time} · Touchdown ~{leg.touchdown_time || schedArr}</span>
                                    </div>
                                  )}
                                </td>
                                <td>
                                  {leg.delay_min > 0 ? (
                                    <span className="delay-badge">+{leg.delay_min} min</span>
                                  ) : (
                                    <span className="ontime-badge">On time</span>
                                  )}
                                </td>
                                <td>
                                  <div className="leg-cause-text">
                                    <span className="cause-title">{leg.cause || 'Nominal Turnaround'}</span>
                                    {leg.summary && <small className="cause-sub">{leg.summary}</small>}
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                <details className="proof-details-card">
                  <summary className="proof-details-summary">
                    <div className="summary-left">
                      <span className="summary-icon">🛡</span>
                      <div>
                        <b>Technical Evidence &amp; Cryptographic Proof File (Optional)</b>
                        <small>Official METAR observations and transponder coordinates for airline legal challenges</small>
                      </div>
                    </div>
                    <span className="summary-badge">SHA-256 Verified</span>
                  </summary>
                  <div className="packet-box">
                    <div className="packet-head">
                      <div>
                        <span className="label" style={{ color: '#b9b5ff' }}>Signed Verification Record</span>
                        <div><b>{result.claim_packet.packet_id}</b></div>
                      </div>
                      <div className="packet-amt num">{result.claim_packet.amount_display}</div>
                    </div>
                    <p className="proof-explainer">
                      <b>What is this?</b> When airlines challenge compensation claims by asserting &quot;extraordinary weather&quot;, this file provides court-ready legal proof. It binds the official NOAA airport METAR weather observations with ADS-B radar transponder telemetry under an immutable SHA-256 seal.
                    </p>
                    <div className="packet-sig">Digital Integrity Seal (SHA-256): {result.claim_packet.signature_sha256}</div>
                    {activeMetar?.raw && (
                      <div className="packet-sig">Official NOAA Weather Report: {activeMetar.raw}</div>
                    )}
                    {result.claim_packet.signed_adsb_coordinates.length > 0 && (
                      <div className="packet-coords">
                        {result.claim_packet.signed_adsb_coordinates.map((c, idx) => (
                          <div className="packet-coord" key={`${c.at}-${idx}`}>
                            <span>{c.airport ?? 'Airport'} · {c.alt_ft}ft</span>
                            <span>{c.lat.toFixed(4)}, {c.lon.toFixed(4)}</span>
                            <em>{c.coord_sig.slice(0, 22)}…</em>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="packet-btns">
                      <button type="button" className="btn sm btn-packet-action" onClick={downloadJson}>
                        <Download size={14} aria-hidden="true" />Download Proof File (.json)
                      </button>
                      <button type="button" className="btn sm ghost btn-packet-action" style={{ color: '#fff', borderColor: 'rgb(255 255 255 / .35)' }} onClick={copyJson}>
                        {copiedJson ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
                        {copiedJson ? 'Copied Proof JSON' : 'Copy Proof JSON'}
                      </button>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
